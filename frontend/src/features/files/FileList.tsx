import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FileItem } from './FileItem';
import type { FileInfo } from './files.api';
import { downloadFiles, type DownloadDeps } from './download';
import { sortFiles, isSortKey, SORT_LABELS, type SortKey } from './sortFiles';
import { formatBytes } from '../../shared/utils/format';
import { Search, List, LayoutGrid, X, Download, Trash2 } from 'lucide-react';

// Virtualize list view when there are more rows than this threshold.
const VIRTUAL_THRESHOLD = 30;

// Row height in px — matches padding + font-size from .file-row CSS.
const ROW_HEIGHT = 53;

// Preferencias de este navegador (no se comparten entre dispositivos).
const VIEW_KEY = 'srvfiles-view-mode';
const SORT_KEY = 'srvfiles-sort';

function readPref<T extends string>(key: string, valid: (v: unknown) => v is T, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return valid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // modo privado o almacenamiento bloqueado: queda el valor en memoria
  }
}

const isViewMode = (v: unknown): v is 'list' | 'grid' => v === 'list' || v === 'grid';

interface FileListProps extends DownloadDeps {
  files: FileInfo[];
  loading: boolean;
  onRequestDelete: (filenames: string[]) => void;
  canDelete: boolean;
  previewMaxMb?: number;
  /** La app de escritorio viendo su propio servidor: los archivos ya están en el disco. */
  isLocal?: boolean;
}

export function FileList({
  files, loading, onRequestDelete, getLinkedUrl, getPlainDownloadUrl, token, canDelete, previewMaxMb, isLocal = false,
}: FileListProps) {
  const [viewMode, setViewModeState] = useState<'list' | 'grid'>(() => readPref(VIEW_KEY, isViewMode, 'list'));
  const [sortKey, setSortKeyState]   = useState<SortKey>(() => readPref(SORT_KEY, isSortKey, 'newest'));
  const [inputValue, setInputValue]  = useState('');
  const [search, setSearch]          = useState('');
  const [selected, setSelected]      = useState<Set<string>>(() => new Set());
  const tableWrapperRef              = useRef<HTMLDivElement>(null);
  const selectAllRef                 = useRef<HTMLInputElement>(null);

  const setViewMode = (mode: 'list' | 'grid') => { setViewModeState(mode); writePref(VIEW_KEY, mode); };
  const setSortKey = (key: SortKey) => { setSortKeyState(key); writePref(SORT_KEY, key); };

  // Debounce: only update the search query 200 ms after the user stops typing.
  useEffect(() => {
    const id = setTimeout(() => setSearch(inputValue), 200);
    return () => clearTimeout(id);
  }, [inputValue]);

  const visibleFiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matching = query ? files.filter((f) => f.name.toLowerCase().includes(query)) : files;
    return sortFiles(matching, sortKey);
  }, [files, search, sortKey]);

  // La selección solo cuenta archivos que siguen existiendo (otro dispositivo
  // pudo borrarlos) y que se ven con la búsqueda actual: nunca se actúa sobre
  // algo que no está en pantalla.
  const selectedFiles = useMemo(
    () => visibleFiles.filter((f) => selected.has(f.name)),
    [visibleFiles, selected],
  );
  const allVisibleSelected = visibleFiles.length > 0 && selectedFiles.length === visibleFiles.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedFiles.length > 0 && !allVisibleSelected;
    }
  }, [selectedFiles.length, allVisibleSelected, viewMode]);

  const toggleSelected = useCallback((name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const toggleAll = () => {
    setSelected(allVisibleSelected ? new Set() : new Set(visibleFiles.map((f) => f.name)));
  };

  const useVirtual = viewMode === 'list' && visibleFiles.length > VIRTUAL_THRESHOLD;

  const rowVirtualizer = useVirtualizer({
    count:           useVirtual ? visibleFiles.length : 0,
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

  const selectedNames = selectedFiles.map((f) => f.name);
  const selectAllLabel = allVisibleSelected ? 'Quitar todos de la selección' : 'Seleccionar todos';

  const renderItem = (file: FileInfo, mode: 'list' | 'grid') => (
    <FileItem
      key={file.name}
      file={file}
      onRequestDelete={onRequestDelete}
      viewMode={mode}
      getLinkedUrl={getLinkedUrl}
      getPlainDownloadUrl={getPlainDownloadUrl}
      token={token}
      canDelete={canDelete}
      isLocal={isLocal}
      previewMaxMb={previewMaxMb}
      selected={selected.has(file.name)}
      onToggleSelected={toggleSelected}
    />
  );

  return (
    <div className="file-list-container">
      {/* Toolbar: search + sort + view toggle */}
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

        <div className="file-list__controls">
          <select
            className="file-list__sort"
            value={sortKey}
            onChange={(e) => { if (isSortKey(e.target.value)) setSortKey(e.target.value); }}
            aria-label="Ordenar por"
          >
            {Object.entries(SORT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

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
      </div>

      {/* Acciones sobre la selección */}
      {selectedFiles.length > 0 && (
        <div className="selection-bar" role="toolbar" aria-label="Archivos seleccionados">
          {viewMode === 'grid' && (
            <label className="file-select" title={selectAllLabel}>
              <input ref={selectAllRef} type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label={selectAllLabel} />
            </label>
          )}
          <span className="selection-bar__count" role="status">
            {selectedFiles.length} seleccionado{selectedFiles.length !== 1 ? 's' : ''}
            <span className="selection-bar__size"> · {formatBytes(selectedFiles.reduce((s, f) => s + f.size, 0))}</span>
          </span>
          <div className="selection-bar__actions">
            {!isLocal && (
              <button
                className="btn btn--secondary btn--sm"
                onClick={() => void downloadFiles(selectedNames, { getLinkedUrl, getPlainDownloadUrl, token })}
              >
                <Download size={15} aria-hidden="true" />
                Descargar
              </button>
            )}
            {canDelete && (
              <button className="btn btn--danger-ghost btn--sm" onClick={() => onRequestDelete(selectedNames)}>
                <Trash2 size={15} aria-hidden="true" />
                Eliminar
              </button>
            )}
            <button className="btn-icon" onClick={() => setSelected(new Set())} title="Quitar selección" aria-label="Quitar selección">
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}

      {/* El total va en el título de la sección; acá solo el resultado de la búsqueda. */}
      {search && (
        <div className="file-list__info" role="status">
          {visibleFiles.length} de {files.length} archivo{files.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Empty state */}
      {visibleFiles.length === 0 && (
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
      {visibleFiles.length > 0 && viewMode === 'list' && (
        <div
          ref={tableWrapperRef}
          className={`file-list__table-wrapper${useVirtual ? ' file-list__table-wrapper--virtual' : ''}`}
        >
          <table className="file-list__table" id="file-table">
            <thead>
              <tr>
                <th className="file-list__th-select">
                  <label className="file-select" title={selectAllLabel}>
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAll}
                      aria-label={selectAllLabel}
                    />
                  </label>
                </th>
                <th>Nombre</th>
                <th>Tamaño</th>
                <th className="file-list__th-date">Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {useVirtual ? (
                <>
                  {/* Top spacer */}
                  <tr style={{ height: rowVirtualizer.getVirtualItems()[0]?.start ?? 0 }} />
                  {rowVirtualizer.getVirtualItems().map((vRow) => renderItem(visibleFiles[vRow.index], 'list'))}
                  {/* Bottom spacer */}
                  {(() => {
                    const items = rowVirtualizer.getVirtualItems();
                    const lastEnd = items.length > 0 ? items[items.length - 1].end : 0;
                    return <tr style={{ height: rowVirtualizer.getTotalSize() - lastEnd }} />;
                  })()}
                </>
              ) : (
                visibleFiles.map((file) => renderItem(file, 'list'))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Grid view */}
      {visibleFiles.length > 0 && viewMode === 'grid' && (
        <div className="file-list__grid" id="file-grid">
          {visibleFiles.map((file) => renderItem(file, 'grid'))}
        </div>
      )}
    </div>
  );
}
