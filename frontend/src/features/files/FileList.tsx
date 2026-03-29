import { useState, useMemo } from 'react';
import { FileItem } from './FileItem';
import type { FileInfo } from './files.api';
import { Search, List, LayoutGrid } from 'lucide-react';

interface FileListProps {
  files: FileInfo[];
  loading: boolean;
  onRequestDelete: (filename: string) => void;
  getDownloadUrl: (filename: string) => string;
  canDelete: boolean;
  previewMaxMb?: number;
}

export function FileList({ files, loading, onRequestDelete, getDownloadUrl, canDelete, previewMaxMb }: FileListProps) {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [search, setSearch] = useState('');

  // Filter files by search query (frontend only)
  const filteredFiles = useMemo(() => {
    if (!search.trim()) return files;
    const query = search.toLowerCase();
    return files.filter((f) => f.name.toLowerCase().includes(query));
  }, [files, search]);

  if (loading) {
    return (
      <div className="file-list__loading">
        <div className="spinner" />
        <p>Cargando archivos...</p>
      </div>
    );
  }

  return (
    <div className="file-list-container">
      {/* Toolbar: search + view toggle */}
      <div className="file-list__toolbar" id="file-toolbar">
        <div className="file-list__search">
          <Search className="file-list__search-icon" size={18} />
          <input
            type="text"
            placeholder="Buscar archivos..."
            className="file-list__search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            id="search-input"
          />
          {search && (
            <button
              className="file-list__search-clear"
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="file-list__view-toggle">
          <button
            className={`btn-icon ${viewMode === 'list' ? 'btn-icon--active' : ''}`}
            onClick={() => setViewMode('list')}
            title="Vista lista"
            id="view-list-btn"
          >
            <List size={18} />
          </button>
          <button
            className={`btn-icon ${viewMode === 'grid' ? 'btn-icon--active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Vista grilla"
            id="view-grid-btn"
          >
            <LayoutGrid size={18} />
          </button>
        </div>
      </div>

      {/* File count */}
      <div className="file-list__info">
        <span>
          {filteredFiles.length} archivo{filteredFiles.length !== 1 ? 's' : ''}
          {search && ` (filtrando de ${files.length})`}
        </span>
      </div>

      {/* Empty state */}
      {filteredFiles.length === 0 && (
        <div className="file-list__empty">
          {search ? (
            <>
              <p className="file-list__empty-icon">🔍</p>
              <p>No se encontraron archivos que coincidan con "{search}"</p>
            </>
          ) : (
            <>
              <p className="file-list__empty-icon">📂</p>
              <p>No hay archivos aún</p>
              <p className="file-list__empty-hint">Arrastrá archivos al área de arriba para empezar</p>
            </>
          )}
        </div>
      )}

      {/* List view */}
      {filteredFiles.length > 0 && viewMode === 'list' && (
        <div className="file-list__table-wrapper">
          <table className="file-list__table" id="file-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tamaño</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((file) => (
                <FileItem
                  key={file.name}
                  file={file}
                  onRequestDelete={onRequestDelete}
                  viewMode="list"
                  getDownloadUrl={getDownloadUrl}
                  canDelete={canDelete}
                  previewMaxMb={previewMaxMb}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Grid view */}
      {filteredFiles.length > 0 && viewMode === 'grid' && (
        <div className="file-list__grid" id="file-grid">
          {filteredFiles.map((file) => (
            <FileItem
              key={file.name}
              file={file}
              onRequestDelete={onRequestDelete}
              viewMode="grid"
              getDownloadUrl={getDownloadUrl}
              canDelete={canDelete}
              previewMaxMb={previewMaxMb}
            />
          ))}
        </div>
      )}
    </div>
  );
}
