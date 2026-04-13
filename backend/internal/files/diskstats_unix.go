//go:build !windows

package files

import "syscall"

func getDiskStats(path string) (DiskStats, error) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return DiskStats{}, err
	}
	total := stat.Blocks * uint64(stat.Bsize)
	free  := stat.Bavail * uint64(stat.Bsize)
	return DiskStats{
		Total: total,
		Free:  free,
		Used:  total - free,
	}, nil
}
