//go:build windows

package files

import "golang.org/x/sys/windows"

func getDiskStats(path string) (DiskStats, error) {
	pathPtr, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return DiskStats{}, err
	}
	var freeBytesAvailable, totalBytes, totalFreeBytes uint64
	err = windows.GetDiskFreeSpaceEx(pathPtr, &freeBytesAvailable, &totalBytes, &totalFreeBytes)
	if err != nil {
		return DiskStats{}, err
	}
	return DiskStats{
		Total: totalBytes,
		Free:  totalFreeBytes,
		Used:  totalBytes - totalFreeBytes,
	}, nil
}
