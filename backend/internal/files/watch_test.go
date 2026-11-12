package files

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestWatchDirNotifiesWhenAFileAppears(t *testing.T) {
	dir := t.TempDir()
	changed := make(chan struct{}, 4)
	stop := make(chan struct{})
	defer close(stop)
	go watchDir(dir, 20*time.Millisecond, stop, func() { changed <- struct{}{} })

	// Algunos sistemas de archivos tienen resolución de mtime gruesa.
	time.Sleep(50 * time.Millisecond)
	if err := os.WriteFile(filepath.Join(dir, "recibido.txt"), []byte("hola"), 0o644); err != nil {
		t.Fatal(err)
	}
	select {
	case <-changed:
	case <-time.After(3 * time.Second):
		t.Fatal("a new file in the folder must be notified")
	}
}
