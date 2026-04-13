package logger

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
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

// ─── Logger ───────────────────────────────────────────────────────────────────

// Logger writes structured log lines matching the format of the Node.js winston logger:
//
//	2026-01-01 12:00:00 INFO  [source] message — {"key":"value"}
//
// File transport: WARN+ only (logs/errors.txt).
// Console transport: all levels, only when APP_ENV != "production".
type Logger struct {
	fileOut *os.File
	isDev   bool
}

// Log is the global logger instance.
var Log = newLogger()

func newLogger() *Logger {
	logsDir := filepath.Join(".", "logs")
	_ = os.MkdirAll(logsDir, 0755)

	f, err := os.OpenFile(
		filepath.Join(logsDir, "errors.txt"),
		os.O_APPEND|os.O_CREATE|os.O_WRONLY,
		0644,
	)
	if err != nil {
		f = os.Stderr
	}

	return &Logger{
		fileOut: f,
		isDev:   os.Getenv("APP_ENV") != "production",
	}
}

func (l *Logger) write(lvl level, source, msg string, args ...any) {
	ts  := time.Now().Format("2006-01-02 15:04:05")
	src := ""
	if source != "" {
		src = fmt.Sprintf("[%s] ", source)
	}

	// Build context string from key-value pairs (same as winston meta)
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

	if lvl >= levelWarn {
		_, _ = fmt.Fprint(l.fileOut, line)
	}
	if l.isDev {
		_, _ = fmt.Fprint(os.Stdout, line)
	}
}

func (l *Logger) Debug(source, msg string, args ...any) { l.write(levelDebug, source, msg, args...) }
func (l *Logger) Info(source, msg string, args ...any)  { l.write(levelInfo, source, msg, args...) }
func (l *Logger) Warn(source, msg string, args ...any)  { l.write(levelWarn, source, msg, args...) }
func (l *Logger) Error(source, msg string, args ...any) { l.write(levelError, source, msg, args...) }
