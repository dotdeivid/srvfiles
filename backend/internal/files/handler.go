package files

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"

	"srvfiles/internal/config"
	"srvfiles/internal/logger"
)

// OnFilesChanged is called after a successful upload or delete.
// Set by main.go when the WebSocket relay is initialized (Phase 4).
var OnFilesChanged func()

// ─── List ─────────────────────────────────────────────────────────────────────

// List handles GET /api/files.
func List(w http.ResponseWriter, r *http.Request) {
	files, err := ListFiles()
	if err != nil {
		logger.Log.Error("files.handler.go", "Error al listar archivos", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to list files"})
		return
	}
	if files == nil {
		files = []FileInfo{} // always return an array, never null
	}
	writeJSON(w, http.StatusOK, map[string]any{"files": files, "count": len(files)})
}

// ─── Upload ───────────────────────────────────────────────────────────────────

// Upload handles POST /api/files/upload (multipart/form-data, field name "files").
func Upload(w http.ResponseWriter, r *http.Request) {
	maxBytes := int64(config.MaxFileSizeMB) * 1024 * 1024 * int64(config.MaxUploadCount)
	r.Body = http.MaxBytesReader(w, r.Body, maxBytes)

	if err := r.ParseMultipartForm(32 << 20); err != nil {
		logger.Log.Warn("files.handler.go", "Failed to parse multipart form", "error", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid multipart form"})
		return
	}

	formFiles := r.MultipartForm.File["files"]
	if len(formFiles) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "No files provided"})
		return
	}
	if len(formFiles) > config.MaxUploadCount {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("Too many files. Max %d allowed.", config.MaxUploadCount),
		})
		return
	}

	var uploaded []UploadedFileInfo
	var originalNames []string

	for _, fh := range formFiles {
		safeName, err := SafeName(fh.Filename)
		if err != nil {
			logger.Log.Warn("files.handler.go", "Rejected file with invalid name",
				"name", fh.Filename, "error", err)
			continue
		}

		src, err := fh.Open()
		if err != nil {
			logger.Log.Error("files.handler.go", "Failed to open uploaded file", "error", err)
			continue
		}

		destPath := filepath.Join(config.UploadsDir, safeName)
		dst, err := os.Create(destPath)
		if err != nil {
			src.Close()
			logger.Log.Error("files.handler.go", "Failed to create file on disk", "path", destPath, "error", err)
			continue
		}

		written, err := io.Copy(dst, src)
		src.Close()
		dst.Close()

		if err != nil {
			_ = os.Remove(destPath) // clean up partial write
			logger.Log.Error("files.handler.go", "Error writing file to disk", "name", safeName, "error", err)
			continue
		}

		uploaded = append(uploaded, UploadedFileInfo{
			Name:         safeName,
			OriginalName: fh.Filename,
			Size:         written,
			DownloadUrl:  "/api/files/download/" + safeName,
		})
		originalNames = append(originalNames, fh.Filename)
	}

	if len(uploaded) == 0 {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to upload files"})
		return
	}

	logger.Log.Info("files.handler.go", "Files uploaded",
		"count", len(uploaded), "names", originalNames)

	writeJSON(w, http.StatusOK, map[string]any{
		"message": fmt.Sprintf("%d file(s) uploaded successfully", len(uploaded)),
		"files":   uploaded,
	})

	InvalidateListCache()
	if OnFilesChanged != nil {
		OnFilesChanged()
	}
}

// ─── Download ─────────────────────────────────────────────────────────────────

// Download handles GET /api/files/download/{filename}.
// Uses http.ServeFile which leverages the sendfile syscall on Linux/macOS.
func Download(w http.ResponseWriter, r *http.Request) {
	filename := chi.URLParam(r, "filename")

	filePath, exists, err := ResolvePath(filename)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid filename"})
		return
	}
	if !exists {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "File not found"})
		return
	}

	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	http.ServeFile(w, r, filePath)
}

// ─── Preview ─────────────────────────────────────────────────────────────────

// Preview handles GET /api/files/preview/{filename}.
// Serves the file inline (no Content-Disposition: attachment).
func Preview(w http.ResponseWriter, r *http.Request) {
	filename := chi.URLParam(r, "filename")

	filePath, exists, err := ResolvePath(filename)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid filename"})
		return
	}
	if !exists {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "File not found"})
		return
	}

	http.ServeFile(w, r, filePath)
}

// ─── Delete ───────────────────────────────────────────────────────────────────

// Delete handles DELETE /api/files/{filename}.
func Delete(w http.ResponseWriter, r *http.Request) {
	filename := chi.URLParam(r, "filename")

	deleted, err := DeleteFile(filename)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid filename"})
		return
	}
	if !deleted {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "File not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf(`File "%s" deleted successfully`, filename),
	})

	InvalidateListCache()
	if OnFilesChanged != nil {
		OnFilesChanged()
	}
}

// ─── Stats ────────────────────────────────────────────────────────────────────

// Stats handles GET /api/files/stats.
func Stats(w http.ResponseWriter, r *http.Request) {
	stats, err := GetDiskStats()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to get disk stats"})
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

// ─── Helper ───────────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
