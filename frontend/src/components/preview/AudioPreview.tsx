interface Props {
  src: string;
  fileName: string;
}

export function AudioPreview({ src, fileName }: Props) {
  return (
    <div className="preview-audio-wrap">
      <span className="preview-audio-icon">🎵</span>
      <p className="preview-audio-name">{fileName}</p>
      <audio src={src} controls className="preview-audio" />
    </div>
  );
}
