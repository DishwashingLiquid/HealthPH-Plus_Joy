/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import FeatureDialog from "./FeatureDialog";
import CommentSection from "./CommentSection";
import ArticleMedia from "../about-us/ArticleMedia";
import { attachmentKind, safeMediaSource } from "../../utils/healthLiteracyMedia";
import { formatContentDate, getArticleGalleryImages, getResourceImageSource, getResourcePosterSource } from "../../utils/healthLiteracyWebsiteContent";

export function ContentDetails({ article }) {
  return <header className="hl-details">
    <h1>{article.articleTitle}</h1>
    <p className="hl-meta">{[article.contentTypeLabel, formatContentDate(article.datePublished), article.author].filter(Boolean).join(" · ")}</p>
    {article.articlePreview && <p className="hl-description">{article.articlePreview}</p>}
  </header>;
}

export function VideoPlayer({ src, poster, title, mime, captions = [] }) {
  const ref = useRef(null);
  const [blocked, setBlocked] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const kind = attachmentKind(src, mime, "video");
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    setFailed(false);
    video.src = src;
    video.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
    return () => { video.pause(); video.removeAttribute("src"); video.load(); };
  }, [src, attempt, kind]);
  if (kind === "missing") return <p className="hl-media-message">No video attachment.</p>;
  if (!safeMediaSource(src)) return <p className="hl-media-message">Unsupported video attachment.</p>;
  if (kind !== "video") return <p className="hl-media-message">This video is hosted externally. <a href={src} target="_blank" rel="noopener noreferrer">Watch at source (new tab)</a></p>;
  return <div className="hl-video-player">
    <video key={`${src}-${attempt}`} ref={ref} src={src} poster={poster || undefined} controls playsInline preload="metadata" aria-label={title}
      onPlay={() => setBlocked(false)} onError={() => setFailed(true)}>
      {captions.filter((track) => track.src).map((track, i) => <track key={track.src} kind="captions" src={track.src} srcLang={track.srclang || track.language || "en"} label={track.label || "Captions"} default={i === 0} />)}
    </video>
    {failed ? <p role="status">Video could not be loaded. <button type="button" className="hl-button" onClick={() => { setFailed(false); setAttempt((v) => v + 1); }}>Retry video</button></p>
      : blocked && <button type="button" className="hl-button hl-play-fallback" onClick={() => ref.current?.play().catch(() => setBlocked(true))}>Play video</button>}
  </div>;
}

export function Attachment({ article, onImageOpen }) {
  const src = getResourceImageSource(article);
  const mime = article.media?.contentType || "";
  const kind = attachmentKind(src, mime, article.resourceType);
  if (kind === "missing") return null;
  if (!safeMediaSource(src)) return <p className="hl-media-message">Unsupported attachment type.</p>;
  if (kind === "image") return <ArticleMedia src={src} alt={article.articleTitle} onPreviewClick={onImageOpen} />;
  if (["video", "provider"].includes(kind)) return <VideoPlayer src={src} mime={mime} title={article.articleTitle} captions={article.captions} />;
  return <p className="hl-media-message">{kind === "pdf" ? "PDF document" : "Unsupported attachment type"}. <a href={src} target="_blank" rel="noopener noreferrer">Open attachment (new tab)</a></p>;
}

// These small controls belong only to the photo viewer, not the global icon system.
function PhotoControlIcon({ name }) {
  const paths = {
    fit: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8z",
    fullscreen: "M8 3H3v5m0-5 6 6m7-6h5v5m0-5-6 6M3 16v5h5m-5 0 6-6m12 1v5h-5m5 0-6-6",
    exitFullscreen: "M3 9h6V3M9 9 3 3m12 0v6h6m-6 0 6-6M3 15h6v6m0-6-6 6m12 0v-6h6m-6 0 6 6",
    download: "M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5",
    previous: "m15 5-7 7 7 7",
    next: "m9 5 7 7-7 7",
  };
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === "zoomIn" || name === "zoomOut" ? <><circle cx="10" cy="10" r="6.5" /><path d="m15 15 5 5M7 10h6" />{name === "zoomIn" && <path d="M10 7v6" />}</> : <path d={paths[name]} />}
  </svg>;
}

export function PhotoViewerBody({ article, images, initialIndex = 0, children }) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenAvailable, setFullscreenAvailable] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const viewer = useRef(null);
  const stage = useRef(null);
  const drag = useRef(null);
  const image = images[index];
  const fit = () => { setZoom(1); stage.current?.scrollTo(0, 0); };
  const go = (next) => { setIndex(next); fit(); };
  useEffect(() => {
    // Fullscreen a child container: browsers do not allow requestFullscreen on <dialog>.
    const container = viewer.current?.closest(".hl-dialog-content");
    setFullscreenAvailable(Boolean(document.fullscreenEnabled && container?.requestFullscreen));
    const changed = () => setFullscreen(document.fullscreenElement === container);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  const toggleFullscreen = async () => {
    const container = viewer.current?.closest(".hl-dialog-content");
    setFullscreenError("");
    try {
      if (document.fullscreenElement === container) await document.exitFullscreen();
      else await container.requestFullscreen();
    } catch {
      setFullscreenError("Browser fullscreen is unavailable. The viewer already fills this window.");
    }
  };
  return <div ref={viewer} className="hl-photo-viewer">
    <div className="hl-photo-area">
      <div className="hl-photo-controls" role="group" aria-label="Image controls">
        <button className="hl-photo-icon-button" type="button" aria-label="Zoom out" title="Zoom out" disabled={zoom <= 1} onClick={() => setZoom((v) => Math.max(1, v - .5))}><PhotoControlIcon name="zoomOut" /></button>
        <button className="hl-photo-icon-button" type="button" aria-label="Zoom in" title="Zoom in" disabled={zoom >= 4} onClick={() => setZoom((v) => Math.min(4, v + .5))}><PhotoControlIcon name="zoomIn" /></button>
        <button className="hl-photo-icon-button" type="button" aria-label="Fit to screen" title="Fit to screen" onClick={fit}><PhotoControlIcon name="fit" /></button>
        <button className="hl-photo-icon-button" type="button" aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"} title={fullscreenAvailable ? fullscreen ? "Exit fullscreen" : "Enter fullscreen" : "Fullscreen unavailable in this browser"}
          aria-pressed={fullscreen} disabled={!fullscreenAvailable} onClick={toggleFullscreen}><PhotoControlIcon name={fullscreen ? "exitFullscreen" : "fullscreen"} /></button>
        <a className="hl-photo-icon-button" aria-label="Download image" title="Download image" href={image.src} download={image.filename || "health-literacy-image"} target="_blank" rel="noopener noreferrer"><PhotoControlIcon name="download" /></a>
      </div>
      {fullscreenError && <p className="hl-photo-fullscreen-status" role="status">{fullscreenError}</p>}
      <div ref={stage} className={`hl-photo-stage${zoom > 1 ? " hl-photo-stage-zoomed" : ""}`} tabIndex={0} aria-label="Image stage. Use arrow keys to pan when zoomed."
        onPointerDown={(e) => { if (zoom <= 1) return; drag.current = { x: e.clientX, y: e.clientY, left: e.currentTarget.scrollLeft, top: e.currentTarget.scrollTop }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (drag.current) { e.currentTarget.scrollLeft = drag.current.left - e.clientX + drag.current.x; e.currentTarget.scrollTop = drag.current.top - e.clientY + drag.current.y; } }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <div className="hl-photo-canvas" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
          <ArticleMedia key={image.id || image.src} src={image.src} alt={image.alt ?? article.articleTitle} />
        </div>
      </div>
      <output className="hl-photo-zoom" aria-label="Image zoom" aria-live="polite">{Math.round(zoom * 100)}%</output>
      {images.length > 1 && <><button className="hl-photo-icon-button hl-photo-previous" type="button" aria-label="Previous image" title="Previous image" disabled={index === 0} onClick={() => go(index - 1)}><PhotoControlIcon name="previous" /></button>
        <button className="hl-photo-icon-button hl-photo-next" type="button" aria-label="Next image" title="Next image" disabled={index === images.length - 1} onClick={() => go(index + 1)}><PhotoControlIcon name="next" /></button></>}
    </div>
    <aside className="hl-photo-information" tabIndex={0} aria-label="Photo details and comments"><ContentDetails article={article} />
      {image.caption && <p className="hl-description">{image.caption}</p>}{children}</aside>
  </div>;
}

export default function MediaViewer({ article, onClose, images, initialIndex = 0, dashboardActions }) {
  const src = getResourceImageSource(article);
  const gallery = getArticleGalleryImages(article);
  const photo = images || (gallery.length ? gallery : null) || (article.resourceType === "infographic" && attachmentKind(src, article.media?.contentType) === "image"
    ? [{ src, alt: article.articleTitle, filename: article.media?.filename }] : null);
  const discussion = dashboardActions ? <>{dashboardActions}
    {article.publishToWebsite && article.isPublished !== false && !article.isArchived
      ? <CommentSection article={article} readOnly /> : <p className="hl-media-message">Public comments are available when this content is published to the website.</p>}
  </> : <CommentSection article={article} />;
  return <FeatureDialog title={article.articleTitle} onClose={onClose} photo={Boolean(photo)} publicButtons={!dashboardActions}>
    {photo ? <PhotoViewerBody article={article} images={photo} initialIndex={initialIndex}>
      {dashboardActions && article.media && <Attachment article={article} />}{discussion}</PhotoViewerBody>
      : <div className="hl-video-viewer">
        {article.resourceType === "video" ? <VideoPlayer src={src} poster={getResourcePosterSource(article)} mime={article.media?.contentType} title={article.articleTitle} captions={article.captions} />
          : <Attachment article={article} />}
        <ContentDetails article={article} />{discussion}
      </div>}
  </FeatureDialog>;
}
