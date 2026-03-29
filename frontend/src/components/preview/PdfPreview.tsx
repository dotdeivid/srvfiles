interface Props {
  src: string;
}

export function PdfPreview({ src }: Props) {
  return (
    <iframe
      src={src}
      className="preview-pdf"
      title="Vista previa PDF"
    />
  );
}
