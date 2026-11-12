//go:build windows

package files

import (
	"os"
	"syscall"
)

// isHiddenPlatform returns true if the file has Windows HIDDEN or SYSTEM attributes.
func isHiddenPlatform(info os.FileInfo) bool {
	if info == nil {
		return false
	}
	if data, ok := info.Sys().(*syscall.Win32FileAttributeData); ok {
		const mask = syscall.FILE_ATTRIBUTE_HIDDEN | syscall.FILE_ATTRIBUTE_SYSTEM
		return data.FileAttributes&mask != 0
	}
	return false
}
