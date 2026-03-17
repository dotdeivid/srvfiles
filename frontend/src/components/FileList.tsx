import { useState, useMemo } from 'react';
import { FileItem } from './FileItem';
import type { FileInfo } from '../api/files.api';

interface FileListProps {
  files: FileInfo[];
  loading: boolean;
  onDelete: (filename: string) => Promise<boolean>;
  onRequestDelete: (filename: string) => void;
}

/**
 * File listing component with search filter and list/grid toggle.
 */
export function FileList({ files, loading, onDelete, onRequestDelete }: FileListProps) {
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
          <svg className="file-list__search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
          <button
            className={`btn-icon ${viewMode === 'grid' ? 'btn-icon--active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Vista grilla"
            id="view-grid-btn"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
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
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((file) => (
                <FileItem
                  key={file.name}
                  file={file}
                  onDelete={onDelete}
                  onRequestDelete={onRequestDelete}
                  viewMode="list"
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
              onDelete={onDelete}
              onRequestDelete={onRequestDelete}
              viewMode="grid"
            />
          ))}
        </div>
      )}
    </div>
  );
}
