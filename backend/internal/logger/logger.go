package logger

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

// ─── Level ───────────────────────────────────────────────────────────────────

type level int

const (
	levelDebug level = iota
	levelInfo
	levelWarn
	levelError
)

func (l level) String() string {
	switch l {
	case levelDebug:
		return "DEBUG"
	case levelInfo:
		return "INFO "
	case levelWarn:
		return "WARN "
	case levelError:
		return "ERROR"
	default:
		return "?????"
	}
}

// maxFileSize: al superarlo, errors.txt se rota a errors.1.txt.
const maxFileSize = 2 * 1024 * 1024

// ─── Logger ───────────────────────────────────────────────────────────────────

// Logger writes structured log lines:
//
//	2026-01-01 12:00:00 INFO  [source] message — {"key":"value"}
//
// File transport: WARN+ only, in LOGS_DIR/errors.txt (default ./logs), with
// size-based rotation. Console transport: all levels, unless APP_ENV=production.
// Under `go test` nothing is written to disk.
type Logger struct {
	mu      sync.Mutex
	path    string
	fileOut io.WriteCloser
	size    int64
	isDev   bool
}

// Log is the global logger instance.
var Log = newLogger()

func newLogger() *Logger {
	l := &Logger{isDev: os.Getenv("APP_ENV") != "production"}
	if testing.Testing() {
		return l
	}
	dir := os.Getenv("LOGS_DIR")
	if dir == "" {
		dir = filepath.Join(".", "logs")
	}
	if err := os.MkdirAll(dir, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "logger: cannot create %s: %v\n", dir, err)
		return l
	}
	l.path = filepath.Join(dir, "errors.txt")
	l.open()
	return l
}

func (l *Logger) open() {
	f, err := os.OpenFile(l.path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		fmt.Fprintf(os.Stderr, "logger: cannot open %s: %v\n", l.path, err)
		l.fileOut = nil
		return
	}
	l.fileOut = f
	if info, err := f.Stat(); err == nil {
		l.size = info.Size()
	}
}

func (l *Logger) rotate() {
	_ = l.fileOut.Close()
	_ = os.Rename(l.path, l.path[:len(l.path)-len(".txt")]+".1.txt")
	l.size = 0
	l.open()
}

func (l *Logger) write(lvl level, source, msg string, args ...any) {
	ts := time.Now().Format("2006-01-02 15:04:05")
	src := ""
	if source != "" {
		src = fmt.Sprintf("[%s] ", source)
	}

	// Build context string from key-value pairs
	ctx := ""
	if len(args) >= 2 {
		m := make(map[string]any, len(args)/2)
		for i := 0; i+1 < len(args); i += 2 {
			m[fmt.Sprintf("%v", args[i])] = args[i+1]
		}
		if b, err := json.Marshal(m); err == nil {
			ctx = " — " + string(b)
		}
	}

	line := fmt.Sprintf("%s %s %s%s%s\n", ts, lvl, src, msg, ctx)

	l.mu.Lock()
	defer l.mu.Unlock()
	if lvl >= levelWarn {
		if l.fileOut != nil {
			if l.size > maxFileSize {
				l.rotate()
			}
			if l.fileOut != nil {
				n, _ := io.WriteString(l.fileOut, line)
				l.size += int64(n)
			}
		} else if !l.isDev {
			_, _ = io.WriteString(os.Stderr, line)
		}
	}
	if l.isDev {
		_, _ = io.WriteString(os.Stdout, line)
	}
}

func (l *Logger) Debug(source, msg string, args ...any) { l.write(levelDebug, source, msg, args...) }
func (l *Logger) Info(source, msg string, args ...any)  { l.write(levelInfo, source, msg, args...) }
func (l *Logger) Warn(source, msg string, args ...any)  { l.write(levelWarn, source, msg, args...) }
func (l *Logger) Error(source, msg string, args ...any) { l.write(levelError, source, msg, args...) }
