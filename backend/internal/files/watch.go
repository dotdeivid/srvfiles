package files

import (
	"os"
	"time"

	"srvfiles/internal/config"
)

// WatchUploadsDir avisa a los clientes (OnFilesChanged) cuando la carpeta de
// archivos cambia sin pasar por la API: lo que recibe la app de escritorio
// por P2P, descargas desde otros servidores o archivos copiados a mano.
//
// Compara la fecha de modificación de la carpeta, que cambia al crear,
// borrar o renombrar archivos dentro de ella, en Windows, macOS y Linux.
// Los archivos en curso se escriben con un nombre temporal oculto y se
// renombran al terminar, así que el aviso llega con el archivo completo.
func WatchUploadsDir(interval time.Duration) {
	watchDir(config.UploadsDir, interval, nil, func() {
		InvalidateListCache()
		if OnFilesChanged != nil {
			OnFilesChanged()
		}
	})
}

func watchDir(dir string, interval time.Duration, stop <-chan struct{}, onChange func()) {
	last := dirModTime(dir)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			if mt := dirModTime(dir); !mt.Equal(last) {
				last = mt
				onChange()
			}
		}
	}
}

func dirModTime(dir string) time.Time {
	info, err := os.Stat(dir)
	if err != nil {
		return time.Time{}
	}
	return info.ModTime()
}
