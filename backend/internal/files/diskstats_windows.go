//go:build windows

package files

import "syscall"

func getDiskStats(path string) (DiskStats, error) {
	pathPtr, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return DiskStats{}, err
	}
	var freeBytesAvailable, totalBytes, totalFreeBytes uint64
	err = syscall.GetDiskFreeSpaceEx(pathPtr, &freeBytesAvailable, &totalBytes, &totalFreeBytes)
	if err != nil {
		return DiskStats{}, err
	}
	return DiskStats{
		Total: totalBytes,
		Free:  totalFreeBytes,
		Used:  totalBytes - totalFreeBytes,
	}, nil
}
