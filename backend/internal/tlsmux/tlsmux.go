// Package tlsmux sirve TLS y HTTP plano en el mismo puerto.
//
// Si alguien escribe 192.168.1.5:3002 en el navegador sin "https://", el
// navegador habla HTTP a un puerto TLS y la conexión falla sin explicación.
// Mirando el primer byte (0x16 = handshake TLS) se separan las conexiones:
// las TLS van al servidor HTTPS y las demás a un servidor que redirige a
// https:// en el mismo puerto.
package tlsmux

import (
	"bufio"
	"crypto/tls"
	"net"
	"sync"
	"time"
)

// tlsHandshake es el primer byte de un ClientHello.
const tlsHandshake = 0x16

// peekTimeout limita cuánto se espera el primer byte de una conexión nueva.
const peekTimeout = 10 * time.Second

// Split envuelve ln y devuelve dos listeners: uno con las conexiones TLS (ya
// envueltas con cfg) y otro con las de HTTP plano. Cerrar cualquiera de los
// dos cierra ln.
func Split(ln net.Listener, cfg *tls.Config) (tlsLn, plainLn net.Listener) {
	m := &mux{
		ln:    ln,
		tls:   make(chan net.Conn),
		plain: make(chan net.Conn),
		done:  make(chan struct{}),
	}
	go m.acceptLoop(cfg)
	return &child{m: m, ch: m.tls}, &child{m: m, ch: m.plain}
}

type mux struct {
	ln    net.Listener
	tls   chan net.Conn
	plain chan net.Conn
	done  chan struct{}
	once  sync.Once
}

func (m *mux) close() error {
	var err error
	m.once.Do(func() {
		close(m.done)
		err = m.ln.Close()
	})
	return err
}

func (m *mux) acceptLoop(cfg *tls.Config) {
	for {
		c, err := m.ln.Accept()
		if err != nil {
			_ = m.close()
			return
		}
		// Clasificar en otra goroutine: un cliente que no manda nada no
		// bloquea a los demás.
		go m.classify(c, cfg)
	}
}

func (m *mux) classify(c net.Conn, cfg *tls.Config) {
	_ = c.SetReadDeadline(time.Now().Add(peekTimeout))
	br := bufio.NewReader(c)
	first, err := br.Peek(1)
	_ = c.SetReadDeadline(time.Time{})
	if err != nil {
		_ = c.Close()
		return
	}
	conn := &peekedConn{Conn: c, r: br}
	var out net.Conn = conn
	ch := m.plain
	if first[0] == tlsHandshake {
		out, ch = tls.Server(conn, cfg), m.tls
	}
	select {
	case ch <- out:
	case <-m.done:
		_ = c.Close()
	}
}

// child es uno de los dos listeners que devuelve Split.
type child struct {
	m  *mux
	ch chan net.Conn
}

func (l *child) Accept() (net.Conn, error) {
	select {
	case c := <-l.ch:
		return c, nil
	case <-l.m.done:
		return nil, net.ErrClosed
	}
}

func (l *child) Close() error   { return l.m.close() }
func (l *child) Addr() net.Addr { return l.m.ln.Addr() }

// peekedConn devuelve primero los bytes ya leídos para clasificar.
type peekedConn struct {
	net.Conn
	r *bufio.Reader
}

func (c *peekedConn) Read(p []byte) (int, error) { return c.r.Read(p) }
