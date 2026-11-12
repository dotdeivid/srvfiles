package files

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"

	"srvfiles/internal/auth"
	"srvfiles/internal/config"
	"srvfiles/internal/logger"
)

// OnFilesChanged is called after a successful upload or delete.
// Set by main.go to broadcast "files-changed" over the WebSocket relay.
var OnFilesChanged func()

// freeSpaceMargin: espacio que se deja libre al aceptar una subida.
const freeSpaceMargin = 100 * 1024 * 1024

// ─── List ─────────────────────────────────────────────────────────────────────

// List handles GET /api/files.
func List(w http.ResponseWriter, r *http.Request) {
	files, err := ListFiles()
	if err != nil {
		logger.Log.Error("files.handler.go", "Error al listar archivos", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "No se pudo leer la carpeta de archivos"})
		return
	}
	if files == nil {
		files = []FileInfo{} // always return an array, never null
	}
	writeJSON(w, http.StatusOK, map[string]any{"files": files, "count": len(files)})
}

// ─── Upload ───────────────────────────────────────────────────────────────────

// Upload handles POST /api/files/upload (multipart/form-data, field name "files").
//
// Lee el multipart en streaming y escribe cada archivo directo a disco: no se
// guarda primero en un temporal de Go (antes cada archivo se escribía dos
// veces). Aplica el límite por archivo (MAX_FILE_SIZE_MB), el número máximo de
// archivos y comprueba el espacio libre si el cliente informa el tamaño.
// Responde con los archivos guardados y los que fallaron, con motivo.
func Upload(w http.ResponseWriter, r *http.Request) {
	maxFile := int64(config.MaxFileSizeMB) * 1024 * 1024
	r.Body = http.MaxBytesReader(w, r.Body, maxFile*int64(config.MaxUploadCount)+10*1024*1024)

	if r.ContentLength > 0 {
		if stats, err := GetDiskStats(); err == nil && uint64(r.ContentLength)+freeSpaceMargin > stats.Free {
			writeJSON(w, http.StatusInsufficientStorage, map[string]string{"error": "No hay espacio suficiente en el servidor"})
			return
		}
	}

	reader, err := r.MultipartReader()
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Formulario de subida inválido"})
		return
	}

	var uploaded []UploadedFileInfo
	var failed []FailedFileInfo
	count := 0

	for {
		part, err := reader.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			logger.Log.Warn("files.handler.go", "Upload interrupted", "error", err)
			failed = append(failed, FailedFileInfo{Name: "", Reason: "La subida se interrumpió"})
			break
		}
		if part.FormName() != "files" || part.FileName() == "" {
			_ = part.Close()
			continue
		}
		original := part.FileName()
		count++
		if count > config.MaxUploadCount {
			failed = append(failed, FailedFileInfo{Name: original,
				Reason: fmt.Sprintf("Se permiten como máximo %d archivos por subida", config.MaxUploadCount)})
			_ = part.Close()
			continue
		}

		name, written, err := SaveStream(original, part, maxFile)
		_ = part.Close()
		if err != nil {
			reason := "No se pudo guardar el archivo"
			switch {
			case errors.Is(err, ErrInvalidName):
				reason = "Nombre de archivo inválido"
			case errors.Is(err, ErrTooLarge):
				reason = fmt.Sprintf("Supera el máximo de %d MB por archivo", config.MaxFileSizeMB)
			}
			logger.Log.Warn("files.handler.go", "File not saved", "name", original, "error", err)
			failed = append(failed, FailedFileInfo{Name: original, Reason: reason})
			continue
		}
		uploaded = append(uploaded, UploadedFileInfo{
			Name:         name,
			OriginalName: original,
			Size:         written,
			DownloadUrl:  "/api/files/download/" + url.PathEscape(name),
		})
	}

	if len(uploaded) > 0 {
		InvalidateListCache()
		if OnFilesChanged != nil {
			OnFilesChanged()
		}
	}

	switch {
	case len(uploaded) == 0 && len(failed) == 0:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "No se enviaron archivos"})
	case len(uploaded) == 0:
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "No se pudo guardar ningún archivo", "failed": failed})
	default:
		logger.Log.Info("files.handler.go", "Files uploaded", "count", len(uploaded), "failed", len(failed))
		if failed == nil {
			failed = []FailedFileInfo{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"message": fmt.Sprintf("%d archivo(s) subido(s)", len(uploaded)),
			"files":   uploaded,
			"failed":  failed,
		})
	}
}

// ─── Link tokens ──────────────────────────────────────────────────────────────

// Link handles POST /api/files/link {"name": "..."} → {"token", "expiresIn"}.
// El token autoriza descargar/previsualizar solo ese archivo durante unos
// minutos, y es lo que va en las URLs (?dl=) en lugar del token de sesión.
func Link(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Pedido inválido"})
		return
	}
	if _, exists, err := ResolvePath(body.Name); err != nil || !exists {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Archivo no encontrado"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"token":     auth.CreateLinkToken(body.Name),
		"expiresIn": int(auth.LinkTokenTTL.Seconds()),
	})
}

// ─── Download / Preview ───────────────────────────────────────────────────────

// fileParam returns the {filename} route parameter decoded.
//
// chi enruta sobre RawPath cuando la URL trae escapes no canónicos (p. ej.
// "%5B" en "foo[1].txt") y entonces el parámetro llega sin decodificar.
func fileParam(r *http.Request) string {
	raw := chi.URLParam(r, "filename")
	if r.URL.RawPath == "" {
		return raw
	}
	if decoded, err := url.PathUnescape(raw); err == nil {
		return decoded
	}
	return raw
}

// Download handles GET /api/files/download/{filename}.
// http.ServeFile maneja Range (reanudar, buscar en video) y usa sendfile.
func Download(w http.ResponseWriter, r *http.Request) {
	filePath, ok := resolveForRead(w, r)
	if !ok {
		return
	}
	name := filepath.Base(filePath)
	h := w.Header()
	h.Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": name}))
	h.Set("Content-Security-Policy", "sandbox; default-src 'none'")
	http.ServeFile(w, r, filePath)
}

// Preview handles GET /api/files/preview/{filename}: el archivo inline para
// la vista previa de la app (img, video, audio, iframe de PDF, texto).
//
// HTML, XML y JS se sirven como texto plano, y todo (salvo PDF) lleva CSP
// sandbox: si alguien abre el enlace directo no puede correr scripts en el
// origen del servidor (XSS almacenado). El SVG conserva su tipo para que se
// vea en <img>; el sandbox bloquea sus scripts si se abre directo.
func Preview(w http.ResponseWriter, r *http.Request) {
	filePath, ok := resolveForRead(w, r)
	if !ok {
		return
	}
	ctype := mime.TypeByExtension(strings.ToLower(filepath.Ext(filePath)))
	h := w.Header()
	if isActiveContent(ctype) {
		h.Set("Content-Type", "text/plain; charset=utf-8")
	}
	if !strings.HasPrefix(ctype, "application/pdf") {
		// El visor de PDF del navegador no funciona dentro de un sandbox.
		h.Set("Content-Security-Policy", "sandbox; default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'")
	}
	h.Set("Content-Disposition", mime.FormatMediaType("inline", map[string]string{"filename": filepath.Base(filePath)}))
	http.ServeFile(w, r, filePath)
}

func isActiveContent(ctype string) bool {
	for _, t := range []string{"text/html", "application/xhtml", "text/xml", "application/xml", "javascript"} {
		if strings.Contains(ctype, t) {
			return true
		}
	}
	return false
}

func resolveForRead(w http.ResponseWriter, r *http.Request) (string, bool) {
	filePath, exists, err := ResolvePath(fileParam(r))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Nombre de archivo inválido"})
		return "", false
	}
	if !exists {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Archivo no encontrado"})
		return "", false
	}
	return filePath, true
}

// ─── Delete ───────────────────────────────────────────────────────────────────

// Delete handles DELETE /api/files/{filename}.
func Delete(w http.ResponseWriter, r *http.Request) {
	filename := fileParam(r)

	deleted, err := DeleteFile(filename)
	if err != nil {
		status := http.StatusInternalServerError
		msg := "No se pudo eliminar el archivo"
		if errors.Is(err, ErrInvalidName) {
			status, msg = http.StatusBadRequest, "Nombre de archivo inválido"
		}
		writeJSON(w, status, map[string]string{"error": msg})
		return
	}
	if !deleted {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Archivo no encontrado"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Archivo eliminado"})

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
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "No se pudo leer el espacio en disco"})
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
