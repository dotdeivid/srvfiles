package files

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"srvfiles/internal/config"
	"srvfiles/internal/logger"
)

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

type DiskStats struct {
	Total uint64 `json:"total"`
	Free  uint64 `json:"free"`
	Used  uint64 `json:"used"`
}

// ─── Sanitize ────────────────────────────────────────────────────────────────

var (
	unsafeChars = regexp.MustCompile(`[^\w\s.\-()\[\]]`)
	whitespace  = regexp.MustCompile(`\s+`)
	edgeDots    = regexp.MustCompile(`^[.\s]+|[.\s]+$`)
)

// SanitizeFilename replicates the logic from shared/utils/sanitize.ts.
// Returns an error if the filename contains path traversal sequences.
func SanitizeFilename(filename string) (string, error) {
	if strings.Contains(filename, "..") ||
		strings.Contains(filename, "/") ||
		strings.Contains(filename, "\\") {
		return "", fmt.Errorf("invalid filename: %q contains forbidden characters", filename)
	}

	sanitized := unsafeChars.ReplaceAllString(filename, "_")
	sanitized = whitespace.ReplaceAllString(sanitized, "_")
	sanitized = edgeDots.ReplaceAllString(sanitized, "")

	if sanitized == "" {
		sanitized = fmt.Sprintf("file_%d", time.Now().UnixMilli())
	}
	return sanitized, nil
}

// resolveConflict returns a non-colliding filename.
// If name already exists in dir, appends a Unix timestamp before the extension.
func resolveConflict(dir, name string) string {
	if _, err := os.Stat(filepath.Join(dir, name)); os.IsNotExist(err) {
		return name
	}
	ext  := filepath.Ext(name)
	base := strings.TrimSuffix(name, ext)
	return fmt.Sprintf("%s_%d%s", base, time.Now().UnixMilli(), ext)
}

// ─── List ─────────────────────────────────────────────────────────────────────

// ListFiles returns all uploaded files sorted newest first.
// Results are cached for cacheTTL to avoid hammering the filesystem on every
// poll request. The cache is invalidated by InvalidateListCache() after any
// write operation (upload or delete).
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
		if e.IsDir() || e.Name() == ".gitkeep" {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		name := e.Name()
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

// ─── Resolve path ─────────────────────────────────────────────────────────────

// ResolvePath sanitizes the filename and returns its absolute path.
// Returns an error if sanitization fails.
func ResolvePath(filename string) (string, bool, error) {
	safe, err := SanitizeFilename(filename)
	if err != nil {
		return "", false, err
	}
	filePath := filepath.Join(config.UploadsDir, safe)
	_, statErr := os.Stat(filePath)
	return filePath, !os.IsNotExist(statErr), nil
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

// SaveFile sanitizes the original name, resolves conflicts, and returns the
// final name to use when saving. Does not perform the actual write.
func SafeName(originalName string) (string, error) {
	sanitized, err := SanitizeFilename(originalName)
	if err != nil {
		return "", err
	}
	return resolveConflict(config.UploadsDir, sanitized), nil
}
