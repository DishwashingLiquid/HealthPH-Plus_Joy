/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import { attachmentKind, createHoverPreview, GENERIC_ARTICLE_THUMBNAIL } from "../../utils/healthLiteracyMedia";

export default function VideoCardPreview({ src, poster, mime, title, onOpen }) {
  const video = useRef(null);
  const target = useRef(null);
  const preview = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  useEffect(() => setPosterFailed(false), [poster]);
  useEffect(() => {
    const node = video.current;
    let visible = true;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    preview.current = createHoverPreview({ video: node, src,
      allowed: () => visible && !document.hidden && !motion.matches &&
        window.matchMedia("(hover: hover) and (pointer: fine)").matches && attachmentKind(src, mime, "video") === "video",
      show: setPlaying });
    const stop = () => preview.current.stop();
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (!visible) stop(); });
    observer.observe(target.current);
    document.addEventListener("visibilitychange", stop);
    motion.addEventListener("change", stop);
    return () => { stop(); observer.disconnect(); document.removeEventListener("visibilitychange", stop); motion.removeEventListener("change", stop); };
  }, [src, mime]);
  return <button ref={target} className="hl-video-card" type="button" aria-label={`Watch Video: ${title}`}
    onPointerEnter={(e) => { if (e.pointerType !== "touch") preview.current?.start(); }}
    onPointerLeave={() => preview.current?.stop()} onBlur={() => preview.current?.stop()}
    onClick={() => { preview.current?.stop(); onOpen(); }}>
    <img src={poster && !posterFailed ? poster : GENERIC_ARTICLE_THUMBNAIL} alt={title}
      onError={() => setPosterFailed(true)} />
    <video ref={video} className={playing ? "is-playing" : ""} muted playsInline preload="none" aria-hidden="true" tabIndex={-1} />
  </button>;
}
