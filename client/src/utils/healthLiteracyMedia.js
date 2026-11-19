// Only Health Literacy Hub and public Articles use this module.
export const GENERIC_ARTICLE_THUMBNAIL = "/assets/articles/generic-article.png";

export const safeMediaSource = (src) => {
  try { return ["http:", "https:", "blob:"].includes(new URL(src, "https://local.invalid").protocol) ? src : ""; }
  catch { return ""; }
};

export const attachmentKind = (src, mime = "", resourceType = "") => {
  if (!src) return "missing";
  let url;
  try { url = new URL(src, "https://local.invalid"); } catch { return "unsupported"; }
  if (!["https:", "http:", "blob:"].includes(url.protocol)) return "unsupported";
  if (/(^|\.)(youtube\.com|youtu\.be|vimeo\.com)$/.test(url.hostname)) return "provider";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf" || /\.pdf$/i.test(url.pathname)) return "pdf";
  if (mime) return "unsupported";
  if (/\.(mp4|webm|ogg|mov)$/i.test(url.pathname)) return "video";
  if (/\.(png|jpe?g|gif|webp|avif)$/i.test(url.pathname)) return "image";
  if (resourceType === "video") return "provider"; // Unknown external URLs get an honest link.
  return "unsupported";
};

let activePreview;
export const stopCardPreviews = () => activePreview?.();

// Injected scheduling keeps lifecycle behavior testable without a media network.
export const createHoverPreview = ({ video, src, delay = setTimeout, cancel = clearTimeout,
  allowed = () => true, show = () => {} }) => {
  let timer;
  let finish;
  let stopped = true;
  let generation = 0;
  const stop = () => {
    generation += 1;
    stopped = true;
    cancel(timer);
    cancel(finish);
    video.pause();
    video.removeAttribute("src");
    video.load();
    show(false);
    if (activePreview === stop) activePreview = undefined;
  };
  const start = () => {
    if (!allowed() || !src) return;
    stopCardPreviews();
    activePreview = stop;
    stopped = false;
    const current = ++generation;
    timer = delay(async () => {
      if (stopped || !allowed()) return stop();
      video.src = src;
      video.muted = true;
      try {
        await video.play();
        if (stopped || current !== generation) return;
        show(true);
        finish = delay(stop, 6000);
      } catch { if (current === generation) stop(); }
    }, 500);
  };
  return { start, stop };
};
