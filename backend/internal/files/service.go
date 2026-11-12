package files

import (
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"

	"golang.org/x/text/unicode/norm"

	"srvfiles/internal/config"
	"srvfiles/internal/logger"
)

// tempPrefix marca los archivos temporales de subidas en curso; no se listan.
const tempPrefix = ".srvfiles-upload-"

// ─── List cache (500 ms TTL, invalidated on upload/delete) ────────────────────

var (
	cacheMu    sync.RWMutex
	cacheData  []FileInfo
	cacheUntil time.Time
	cacheTTL   = 500 * time.Millisecond
)

// InvalidateListCache clears the cached file list so the next call to
// ListFiles() reads fresh data from disk. Called after upload or delete.
func InvalidateListCache() {
	cacheMu.Lock()
	cacheUntil = time.Time{}
	cacheMu.Unlock()
}

// ─── Types ────────────────────────────────────────────────────────────────────

type FileInfo struct {
	Name        string `json:"name"`
	Size        int64  `json:"size"`
	CreatedAt   string `json:"createdAt"`
	DownloadUrl string `json:"downloadUrl"`
}

type UploadedFileInfo struct {
	Name         string `json:"name"`
	OriginalName string `json:"originalName"`
	Size         int64  `json:"size"`
	DownloadUrl  string `json:"downloadUrl"`
}

type FailedFileInfo struct {
	Name   string `json:"name"`
	Reason string `json:"reason"`
}

type DiskStats struct {
	Total uint64 `json:"total"`
	Free  uint64 `json:"free"`
	Used  uint64 `json:"used"`
}

// ErrInvalidName: el nombre contiene rutas o no es un nombre de archivo válido.
var ErrInvalidName = errors.New("invalid filename")

// ErrTooLarge: el archivo supera el límite por archivo.
var ErrTooLarge = errors.New("file too large")

// ─── Names ───────────────────────────────────────────────────────────────────

// Nombres reservados por Windows (sin extensión o con ella).
var windowsReserved = map[string]bool{
	"CON": true, "PRN": true, "AUX": true, "NUL": true,
	"COM1": true, "COM2": true, "COM3": true, "COM4": true, "COM5": true,
	"COM6": true, "COM7": true, "COM8": true, "COM9": true,
	"LPT1": true, "LPT2": true, "LPT3": true, "LPT4": true, "LPT5": true,
	"LPT6": true, "LPT7": true, "LPT8": true, "LPT9": true,
}

// SanitizeFilename turns an uploaded name into a safe file name.
//
// Conserva letras y números de cualquier idioma, espacios y puntuación común
// ("año señal.txt" queda igual). Normaliza a NFC, descarta cualquier ruta
// (solo el último componente), reemplaza caracteres de control y los
// reservados en Windows (\ / : * ? " < > |), y quita puntos y espacios en los
// extremos. Un ".." dentro del nombre ("informe..v2.txt") es válido: sin
// separadores no puede salir del directorio.
func SanitizeFilename(filename string) (string, error) {
	name := norm.NFC.String(filename)
	name = name[strings.LastIndexAny(name, `/\`)+1:]

	var b strings.Builder
	for _, r := range name {
		switch {
		case unicode.IsControl(r), strings.ContainsRune(`:*?"<>|`, r):
			b.WriteRune('_')
		default:
			b.WriteRune(r)
		}
	}
	sanitized := strings.Trim(b.String(), ". ")
	if sanitized == "" {
		return "", ErrInvalidName
	}
	if len(sanitized) > 240 {
		ext := filepath.Ext(sanitized)
		if len(ext) > 20 {
			ext = ""
		}
		sanitized = strings.TrimRight(truncateUTF8(sanitized, 240-len(ext)), ". ") + ext
	}
	base := strings.ToUpper(strings.SplitN(sanitized, ".", 2)[0])
	if windowsReserved[base] {
		sanitized = "_" + sanitized
	}
	return sanitized, nil
}

func truncateUTF8(s string, max int) string {
	if len(s) <= max {
		return s
	}
	for max > 0 && !utf8RuneStart(s[max]) {
		max--
	}
	return s[:max]
}

func utf8RuneStart(b byte) bool { return b&0xC0 != 0x80 }

// ResolvePath validates (without transforming) a requested file name and
// returns its absolute path inside the uploads directory and whether it exists.
//
// Antes se volvía a sanear el nombre, y los archivos copiados a mano con
// acentos aparecían en la lista pero daban 404 al descargar o borrar.
func ResolvePath(filename string) (string, bool, error) {
	if filename == "" || filename == "." || filename == ".." ||
		strings.ContainsAny(filename, "/\\\x00") || strings.HasPrefix(filename, tempPrefix) {
		return "", false, ErrInvalidName
	}
	base, err := filepath.Abs(config.UploadsDir)
	if err != nil {
		return "", false, err
	}
	filePath := filepath.Join(base, filename)
	rel, err := filepath.Rel(base, filePath)
	if err != nil || rel != filename {
		return "", false, ErrInvalidName
	}
	info, statErr := os.Stat(filePath)
	return filePath, statErr == nil && !info.IsDir(), nil
}

// ─── List ─────────────────────────────────────────────────────────────────────

// ListFiles returns all uploaded files sorted newest first.
// Results are cached for cacheTTL; the cache is invalidated by
// InvalidateListCache() after any write operation (upload or delete).
func ListFiles() ([]FileInfo, error) {
	cacheMu.RLock()
	if time.Now().Before(cacheUntil) {
		result := make([]FileInfo, len(cacheData))
		copy(result, cacheData)
		cacheMu.RUnlock()
		return result, nil
	}
	cacheMu.RUnlock()

	files, err := listFilesFromDisk()
	if err != nil {
		return nil, err
	}

	cacheMu.Lock()
	cacheData = files
	cacheUntil = time.Now().Add(cacheTTL)
	cacheMu.Unlock()

	return files, nil
}

// listFilesFromDisk reads the uploads directory directly — no caching.
func listFilesFromDisk() ([]FileInfo, error) {
	entries, err := os.ReadDir(config.UploadsDir)
	if err != nil {
		return nil, err
	}

	var files []FileInfo
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() || name == ".gitkeep" || strings.HasPrefix(name, tempPrefix) {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		files = append(files, FileInfo{
			Name:        name,
			Size:        info.Size(),
			CreatedAt:   info.ModTime().UTC().Format(time.RFC3339),
			DownloadUrl: "/api/files/download/" + url.PathEscape(name),
		})
	}

	sort.Slice(files, func(i, j int) bool {
		return files[i].CreatedAt > files[j].CreatedAt
	})

	return files, nil
}

// ─── Delete ───────────────────────────────────────────────────────────────────

// DeleteFile deletes a file from the uploads directory.
// Returns (false, nil) if the file does not exist, (true, nil) on success.
func DeleteFile(filename string) (bool, error) {
	filePath, exists, err := ResolvePath(filename)
	if err != nil {
		return false, err
	}
	if !exists {
		logger.Log.Warn("files.service.go", "Delete requested for non-existent file", "filename", filename)
		return false, nil
	}
	if err := os.Remove(filePath); err != nil {
		return false, err
	}
	logger.Log.Info("files.service.go", "File deleted", "filename", filename)
	return true, nil
}

// ─── Stats ───────────────────────────────────────────────────────────────────

// GetDiskStats returns disk usage for the uploads volume.
// The platform-specific implementation lives in diskstats_unix.go / diskstats_windows.go.
func GetDiskStats() (DiskStats, error) {
	stats, err := getDiskStats(config.UploadsDir)
	if err != nil {
		logger.Log.Error("files.service.go", "Failed to get disk stats", "error", err)
	}
	return stats, err
}

// ─── Save uploaded file ───────────────────────────────────────────────────────

// SaveStream writes src to the uploads directory under a sanitized, unique
// name and returns the final name and size.
//
// Se escribe a un temporal oculto y al terminar se "publica" con os.Link, que
// falla si el nombre ya existe: así dos subidas simultáneas con el mismo
// nombre nunca se pisan (se usa "nombre (1).ext"). Si maxBytes > 0 y el
// contenido lo supera, devuelve ErrTooLarge y no deja nada en disco.
func SaveStream(originalName string, src io.Reader, maxBytes int64) (string, int64, error) {
	sanitized, err := SanitizeFilename(originalName)
	if err != nil {
		return "", 0, err
	}

	tmp, err := os.CreateTemp(config.UploadsDir, tempPrefix+"*")
	if err != nil {
		return "", 0, err
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath) // tras os.Link el contenido sigue en el nombre final

	reader := src
	if maxBytes > 0 {
		reader = io.LimitReader(src, maxBytes+1)
	}
	written, err := io.Copy(tmp, reader)
	closeErr := tmp.Close()
	if err == nil {
		err = closeErr
	}
	if err != nil {
		return "", 0, err
	}
	if maxBytes > 0 && written > maxBytes {
		return "", 0, ErrTooLarge
	}

	ext := filepath.Ext(sanitized)
	stem := strings.TrimSuffix(sanitized, ext)
	if stem == "" { // ".gitignore": todo es "extensión"
		stem, ext = sanitized, ""
	}
	for i := 0; i < 10000; i++ {
		name := sanitized
		if i > 0 {
			name = fmt.Sprintf("%s (%d)%s", stem, i, ext)
		}
		finalPath := filepath.Join(config.UploadsDir, name)
		err := os.Link(tmpPath, finalPath)
		if err == nil {
			return name, written, nil
		}
		if os.IsExist(err) {
			continue
		}
		// Sistema de archivos sin hard links: rename como alternativa.
		if _, statErr := os.Lstat(finalPath); statErr == nil {
			continue
		}
		if err := os.Rename(tmpPath, finalPath); err != nil {
			return "", 0, err
		}
		return name, written, nil
	}
	return "", 0, fmt.Errorf("could not find a free name for %q", sanitized)
}
