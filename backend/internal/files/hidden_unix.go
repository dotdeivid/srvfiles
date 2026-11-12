//go:build !windows

package files

import "os"

// isHiddenPlatform returns true if the file has platform-specific hidden attributes.
// On Unix/macOS, hidden files are indicated by a leading dot (handled in IsHidden).
func isHiddenPlatform(info os.FileInfo) bool {
	return false
}
