package files

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"srvfiles/internal/config"
)

func useTempUploads(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	old := config.UploadsDir
	config.UploadsDir = dir
	InvalidateListCache()
	t.Cleanup(func() {
		config.UploadsDir = old
		InvalidateListCache()
	})
	return dir
}

func TestSanitizeFilename(t *testing.T) {
	cases := map[string]string{
		"año señal.txt":    "año señal.txt",   // antes: a_o_se_al.txt
		"informe..v2.txt":  "informe..v2.txt", // antes: rechazado con 500
		"foo[1](2).txt":    "foo[1](2).txt",
		"../../etc/passwd": "passwd",
		`..\..\boot.ini`:   "boot.ini",
		"a:b*c?.txt":       "a_b_c_.txt",
		"  .oculto.  ":     "oculto",
		"CON.txt":          "_CON.txt",
		"desktop.ini":      "_desktop.ini",
		"DESKTOP.INI":      "_DESKTOP.INI",
		"thumbs.db":        "_thumbs.db",
		"Thumbs.db":        "_Thumbs.db",
		"emoji 🎉.png":      "emoji 🎉.png",
		"café.txt":        "café.txt", // NFD → NFC
	}
	for in, want := range cases {
		got, err := SanitizeFilename(in)
		if err != nil || got != want {
			t.Errorf("SanitizeFilename(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	for _, bad := range []string{"", "..", "/", " . "} {
		if _, err := SanitizeFilename(bad); !errors.Is(err, ErrInvalidName) {
			t.Errorf("SanitizeFilename(%q) should fail", bad)
		}
	}
}

func TestResolvePathValidatesWithoutTransforming(t *testing.T) {
	dir := useTempUploads(t)
	// Un archivo copiado a mano con acentos debe poder descargarse tal cual.
	if err := os.WriteFile(filepath.Join(dir, "Canción ñ.mp3"), []byte("x"), 0644); err != nil {
		t.Fatal(err)
	}
	if _, exists, err := ResolvePath("Canción ñ.mp3"); err != nil || !exists {
		t.Fatalf("existing accented file not resolved: exists=%v err=%v", exists, err)
	}
	for _, bad := range []string{"../secret", "..", "a/b", `a\b`, "", tempPrefix + "x", ".DS_Store", "desktop.ini", "thumbs.db"} {
		if _, _, err := ResolvePath(bad); !errors.Is(err, ErrInvalidName) {
			t.Errorf("ResolvePath(%q) should be rejected", bad)
		}
	}
}

func TestHiddenFilesAreExcludedFromListAndRejected(t *testing.T) {
	dir := useTempUploads(t)

	hiddenNames := []string{
		".DS_Store",
		".gitkeep",
		".hidden_file",
		"desktop.ini",
		"DESKTOP.INI",
		"thumbs.db",
		"Thumbs.db",
	}

	for _, name := range hiddenNames {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("hidden"), 0644); err != nil {
			t.Fatal(err)
		}
	}

	if err := os.WriteFile(filepath.Join(dir, "visible.txt"), []byte("visible"), 0644); err != nil {
		t.Fatal(err)
	}

	files, err := ListFiles()
	if err != nil {
		t.Fatalf("ListFiles failed: %v", err)
	}

	if len(files) != 1 {
		t.Fatalf("ListFiles returned %d files, expected 1 (got: %+v)", len(files), files)
	}
	if files[0].Name != "visible.txt" {
		t.Fatalf("ListFiles returned %s, expected visible.txt", files[0].Name)
	}

	for _, name := range hiddenNames {
		if !IsHidden(name, nil) {
			t.Errorf("IsHidden(%q, nil) = false, want true", name)
		}
		if _, _, err := ResolvePath(name); !errors.Is(err, ErrInvalidName) {
			t.Errorf("ResolvePath(%q) = %v, want ErrInvalidName", name, err)
		}
	}

	if IsHidden("visible.txt", nil) {
		t.Errorf("IsHidden(visible.txt, nil) = true, want false")
	}
	if _, exists, err := ResolvePath("visible.txt"); err != nil || !exists {
		t.Errorf("ResolvePath(visible.txt) exists=%v, err=%v", exists, err)
	}
}

func TestSaveStreamUniqueNamesUnderConcurrency(t *testing.T) {
	useTempUploads(t)
	const n = 8
	names := make([]string, n)
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			name, _, err := SaveStream("doc.pdf", strings.NewReader("contenido"), 0)
			if err != nil {
				t.Errorf("save %d: %v", i, err)
			}
			names[i] = name
		}(i)
	}
	wg.Wait()

	seen := map[string]bool{}
	for _, name := range names {
		if seen[name] {
			t.Fatalf("two uploads got the same name %q (overwrite)", name)
		}
		seen[name] = true
	}
	if !seen["doc.pdf"] || !seen["doc (1).pdf"] {
		t.Fatalf("unexpected names: %v", names)
	}
	files, _ := ListFiles()
	if len(files) != n {
		t.Fatalf("listing shows %d files, want %d (temp files must be hidden)", len(files), n)
	}
}

func TestSaveStreamEnforcesPerFileLimit(t *testing.T) {
	dir := useTempUploads(t)
	_, _, err := SaveStream("big.bin", strings.NewReader(strings.Repeat("x", 101)), 100)
	if !errors.Is(err, ErrTooLarge) {
		t.Fatalf("want ErrTooLarge, got %v", err)
	}
	entries, _ := os.ReadDir(dir)
	if len(entries) != 0 {
		t.Fatalf("nothing must be left on disk, found %d entries", len(entries))
	}
}
