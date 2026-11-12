package cert

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"time"

	"srvfiles/internal/logger"
)

const (
	validity     = 2 * 365 * 24 * time.Hour
	renewBefore  = 30 * 24 * time.Hour
	keyFileName  = "key.pem"
	certFileName = "cert.pem"
)

// GetOrCreateCert returns the TLS certificate for the HTTPS server.
//
// Reutiliza el certificado guardado en certsDir mientras siga vigente y cubra
// todas las IPs actuales (lanIPs). Si no, genera uno nuevo autofirmado:
//   - número de serie aleatorio de 128 bits (cada instalación es distinta;
//     un serial fijo hacía que Firefox rechazara el segundo servidor visitado);
//   - SAN con las IPs LAN, 127.0.0.1, ::1, localhost y el hostname;
//   - clave ECDSA P-256, validez de 2 años.
func GetOrCreateCert(certsDir string, lanIPs []string) (tls.Certificate, error) {
	keyPath := filepath.Join(certsDir, keyFileName)
	certPath := filepath.Join(certsDir, certFileName)

	if existing, err := tls.LoadX509KeyPair(certPath, keyPath); err == nil {
		if leaf, err := x509.ParseCertificate(existing.Certificate[0]); err == nil && stillValid(leaf, lanIPs) {
			logger.Log.Debug("cert.go", "Loading existing TLS certificate", "certsDir", certsDir)
			return existing, nil
		}
		logger.Log.Info("cert.go", "TLS certificate outdated (expiring or IP changed) — regenerating")
	}

	logger.Log.Info("cert.go", "Generating self-signed TLS certificate", "certsDir", certsDir)

	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return tls.Certificate{}, err
	}
	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return tls.Certificate{}, err
	}

	ips := []net.IP{net.ParseIP("127.0.0.1"), net.ParseIP("::1")}
	for _, s := range lanIPs {
		if ip := net.ParseIP(s); ip != nil {
			ips = append(ips, ip)
		}
	}
	dnsNames := []string{"localhost"}
	if host, err := os.Hostname(); err == nil && host != "" {
		dnsNames = append(dnsNames, host)
	}

	notBefore := time.Now().Add(-time.Hour)
	template := &x509.Certificate{
		SerialNumber:          serial,
		Subject:               pkix.Name{CommonName: "SrvFiles", Organization: []string{"SrvFiles (autofirmado)"}},
		NotBefore:             notBefore,
		NotAfter:              notBefore.Add(validity),
		KeyUsage:              x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		IPAddresses:           ips,
		DNSNames:              dnsNames,
	}

	certDER, err := x509.CreateCertificate(rand.Reader, template, template, &privateKey.PublicKey, privateKey)
	if err != nil {
		return tls.Certificate{}, err
	}
	keyDER, err := x509.MarshalPKCS8PrivateKey(privateKey)
	if err != nil {
		return tls.Certificate{}, err
	}

	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: keyDER})
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER})

	if err := os.MkdirAll(certsDir, 0755); err != nil {
		return tls.Certificate{}, err
	}
	// Private key: mode 0600 (owner read/write only)
	if err := os.WriteFile(keyPath, keyPEM, 0600); err != nil {
		return tls.Certificate{}, err
	}
	if err := os.WriteFile(certPath, certPEM, 0644); err != nil {
		return tls.Certificate{}, err
	}

	logger.Log.Info("cert.go", "TLS certificate saved", "certPath", certPath, "ips", lanIPs)
	return tls.X509KeyPair(certPEM, keyPEM)
}

// stillValid: no vence en los próximos 30 días y cubre todas las IPs actuales.
func stillValid(leaf *x509.Certificate, lanIPs []string) bool {
	if time.Now().Add(renewBefore).After(leaf.NotAfter) {
		return false
	}
	for _, s := range lanIPs {
		ip := net.ParseIP(s)
		if ip == nil {
			continue
		}
		found := false
		for _, have := range leaf.IPAddresses {
			if have.Equal(ip) {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}
