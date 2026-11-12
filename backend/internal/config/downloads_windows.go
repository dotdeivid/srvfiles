//go:build windows

package config

import "golang.org/x/sys/windows"

// downloadsDir pide la carpeta Descargas al sistema (Known Folder): puede
// estar movida a otro disco o tener otro nombre, igual que la que usa la app
// de escritorio.
func downloadsDir() string {
	dir, err := windows.KnownFolderPath(windows.FOLDERID_Downloads, windows.KF_FLAG_DEFAULT)
	if err != nil {
		return ""
	}
	return dir
}
