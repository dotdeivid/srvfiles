package cert

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"os"
	"path/filepath"
	"time"

	"srvfiles/internal/logger"
)

// GetOrCreateCert returns the TLS certificate for the HTTPS server.
//
//   - If certsDir already contains key.pem + cert.pem, loads them from disk.
//   - Otherwise generates a new RSA-2048 self-signed certificate valid for
//     10 years, persists both files, and returns the bundle.
//
// Equivalent to getOrCreateCert() in lib/cert.ts (selfsigned → crypto/x509).
func GetOrCreateCert(certsDir string) (tls.Certificate, error) {
	keyPath  := filepath.Join(certsDir, "key.pem")
	certPath := filepath.Join(certsDir, "cert.pem")

	// ── Load existing cert ────────────────────────────────────────────
	if fileExists(keyPath) && fileExists(certPath) {
		logger.Log.Debug("cert.go", "Loading existing TLS certificate", "certsDir", certsDir)
		return tls.LoadX509KeyPair(certPath, keyPath)
	}

	// ── Generate new self-signed cert ─────────────────────────────────
	logger.Log.Info("cert.go", "Generating self-signed TLS certificate", "certsDir", certsDir)

	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return tls.Certificate{}, err
	}

	notBefore := time.Now()
	notAfter  := notBefore.AddDate(10, 0, 0) // 10 years — same as cert.ts

	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "SrvFiles"},
		NotBefore:    notBefore,
		NotAfter:     notAfter,
		KeyUsage:     x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
	}

	certDER, err := x509.CreateCertificate(rand.Reader, template, template, &privateKey.PublicKey, privateKey)
	if err != nil {
		return tls.Certificate{}, err
	}

	// ── Encode to PEM ─────────────────────────────────────────────────
	keyPEM  := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(privateKey)})
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER})

	// ── Persist to disk ───────────────────────────────────────────────
	if err := os.MkdirAll(certsDir, 0755); err != nil {
		return tls.Certificate{}, err
	}
	// Private key: mode 0600 (owner read/write only) — same as cert.ts
	if err := os.WriteFile(keyPath, keyPEM, 0600); err != nil {
		return tls.Certificate{}, err
	}
	if err := os.WriteFile(certPath, certPEM, 0644); err != nil {
		return tls.Certificate{}, err
	}

	logger.Log.Info("cert.go", "TLS certificate saved", "keyPath", keyPath, "certPath", certPath)

	return tls.X509KeyPair(certPEM, keyPEM)
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
