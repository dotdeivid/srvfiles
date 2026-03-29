interface Props {
  src: string;
}

export function VideoPreview({ src }: Props) {
  return (
    <div className="preview-media-wrap">
      <video src={src} controls className="preview-video" />
    </div>
  );
}
