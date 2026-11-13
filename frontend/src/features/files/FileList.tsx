import { useState, useMemo, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FileItem } from './FileItem';
import type { FileInfo } from './files.api';
import { Search, List, LayoutGrid, X } from 'lucide-react';

// Virtualize list view when there are more rows than this threshold.
const VIRTUAL_THRESHOLD = 30;

// Row height in px — matches padding + font-size from .file-row CSS.
const ROW_HEIGHT = 53;

interface FileListProps {
  files: FileInfo[];
  loading: boolean;
  onRequestDelete: (filename: string) => void;
  getLinkedUrl: (filename: string, kind: 'download' | 'preview') => Promise<string>;
  getPlainDownloadUrl: (filename: string) => string;
  token: string | null;
  canDelete: boolean;
  previewMaxMb?: number;
  /** La app de escritorio viendo su propio servidor: los archivos ya están en el disco. */
  isLocal?: boolean;
}

export function FileList({
  files, loading, onRequestDelete, getLinkedUrl, getPlainDownloadUrl, token, canDelete, previewMaxMb, isLocal = false,
}: FileListProps) {
  const [viewMode, setViewMode]   = useState<'list' | 'grid'>('list');
  const [inputValue, setInputValue] = useState('');
  const [search, setSearch]       = useState('');
  const tableWrapperRef           = useRef<HTMLDivElement>(null);

  // Debounce: only update the search query 200 ms after the user stops typing.
  useEffect(() => {
    const id = setTimeout(() => setSearch(inputValue), 200);
    return () => clearTimeout(id);
  }, [inputValue]);

  const filteredFiles = useMemo(() => {
    if (!search.trim()) return files;
    const query = search.toLowerCase();
    return files.filter((f) => f.name.toLowerCase().includes(query));
  }, [files, search]);

  const useVirtual = viewMode === 'list' && filteredFiles.length > VIRTUAL_THRESHOLD;

  const rowVirtualizer = useVirtualizer({
    count:           useVirtual ? filteredFiles.length : 0,
    getScrollElement: () => tableWrapperRef.current,
    estimateSize:    () => ROW_HEIGHT,
    overscan:        8,
    enabled:         useVirtual,
  });

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
          <Search className="file-list__search-icon" size={18} aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar archivos..."
            aria-label="Buscar archivos"
            className="file-list__search-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            id="search-input"
          />
          {inputValue && (
            <button
              className="btn-icon file-list__search-clear"
              onClick={() => { setInputValue(''); setSearch(''); }}
              aria-label="Limpiar búsqueda"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          )}
        </div>

        <div className="file-list__view-toggle" role="group" aria-label="Vista">
          <button
            className={`btn-icon ${viewMode === 'list' ? 'btn-icon--active' : ''}`}
            onClick={() => setViewMode('list')}
            title="Vista lista"
            aria-label="Vista lista"
            aria-pressed={viewMode === 'list'}
            id="view-list-btn"
          >
            <List size={18} />
          </button>
          <button
            className={`btn-icon ${viewMode === 'grid' ? 'btn-icon--active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Vista grilla"
            aria-label="Vista grilla"
            aria-pressed={viewMode === 'grid'}
            id="view-grid-btn"
          >
            <LayoutGrid size={18} />
          </button>
        </div>
      </div>

      {/* El total va en el título de la sección; acá solo el resultado de la búsqueda. */}
      {search && (
        <div className="file-list__info" role="status">
          {filteredFiles.length} de {files.length} archivo{files.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Empty state */}
      {filteredFiles.length === 0 && (
        <div className="file-list__empty">
          {search ? (
            <>
              <p className="file-list__empty-icon" aria-hidden="true">🔍</p>
              <p>No se encontraron archivos que coincidan con "{search}"</p>
            </>
          ) : (
            <>
              <p className="file-list__empty-icon" aria-hidden="true">📂</p>
              <p>No hay archivos aún</p>
              <p className="file-list__empty-hint">Lo que subas acá lo ven todos los dispositivos de la red.</p>
            </>
          )}
        </div>
      )}

      {/* List view */}
      {filteredFiles.length > 0 && viewMode === 'list' && (
        <div
          ref={tableWrapperRef}
          className={`file-list__table-wrapper${useVirtual ? ' file-list__table-wrapper--virtual' : ''}`}
        >
          <table className="file-list__table" id="file-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tamaño</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {useVirtual ? (
                <>
                  {/* Top spacer */}
                  <tr style={{ height: rowVirtualizer.getVirtualItems()[0]?.start ?? 0 }} />
                  {rowVirtualizer.getVirtualItems().map((vRow) => (
                    <FileItem
                      key={filteredFiles[vRow.index].name}
                      file={filteredFiles[vRow.index]}
                      onRequestDelete={onRequestDelete}
                      viewMode="list"
                      getLinkedUrl={getLinkedUrl}
                      getPlainDownloadUrl={getPlainDownloadUrl}
                      token={token}
                      canDelete={canDelete}
                      isLocal={isLocal}
                      previewMaxMb={previewMaxMb}
                    />
                  ))}
                  {/* Bottom spacer */}
                  {(() => {
                    const items = rowVirtualizer.getVirtualItems();
                    const lastEnd = items.length > 0 ? items[items.length - 1].end : 0;
                    return <tr style={{ height: rowVirtualizer.getTotalSize() - lastEnd }} />;
                  })()}
                </>
              ) : (
                filteredFiles.map((file) => (
                  <FileItem
                    key={file.name}
                    file={file}
                    onRequestDelete={onRequestDelete}
                    viewMode="list"
                    getLinkedUrl={getLinkedUrl}
                    getPlainDownloadUrl={getPlainDownloadUrl}
                    token={token}
                    canDelete={canDelete}
                    isLocal={isLocal}
                    previewMaxMb={previewMaxMb}
                  />
                ))
              )}
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
              getLinkedUrl={getLinkedUrl}
              getPlainDownloadUrl={getPlainDownloadUrl}
              token={token}
              canDelete={canDelete}
              isLocal={isLocal}
              previewMaxMb={previewMaxMb}
            />
          ))}
        </div>
      )}
    </div>
  );
}
