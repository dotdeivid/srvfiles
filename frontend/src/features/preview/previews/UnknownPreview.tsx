interface Props {
  onDownload: () => void;
}

export function UnknownPreview({ onDownload }: Props) {
  return (
    <div className="preview-unknown">
      <span className="preview-unknown__icon">📁</span>
      <p className="preview-unknown__text">
        Este tipo de archivo no se puede previsualizar.
      </p>
      <button className="btn btn--primary" onClick={onDownload}>
        Descargar
      </button>
    </div>
  );
}
