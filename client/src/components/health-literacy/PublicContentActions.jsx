/* eslint-disable react/prop-types */
import { useState } from "react";
import { getResourceImageSource } from "../../utils/healthLiteracyWebsiteContent";
import { attachmentKind, safeMediaSource } from "../../utils/healthLiteracyMedia";
import { downloadPublicContent, sharePublicContent } from "../../utils/publicHealthLiteracyAnalytics";

export default function PublicContentActions({ article, hideDownload = false }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const source = getResourceImageSource(article);
  const downloadable = safeMediaSource(source) && ["image", "video", "pdf"].includes(
    attachmentKind(source, article.media?.contentType, article.resourceType)
  );
  const act = async (action, downloading = false) => {
    setBusy(true); setStatus(""); setDownloadFailed(false);
    try { setStatus(await action()); }
    catch (error) {
      if (error.name !== "AbortError") {
        setStatus("Unable to complete this action. Please try again.");
        setDownloadFailed(downloading);
      }
    }
    finally { setBusy(false); }
  };
  return <div className="hl-details">
    <div className="hl-actions">
      <button type="button" className="public-button" disabled={busy} onClick={() => act(() => sharePublicContent(article))}>Share content</button>
      {!hideDownload && downloadable && <button type="button" className="public-button" disabled={busy} onClick={() => act(async () => {
        await downloadPublicContent(article, source, article.media?.filename);
        return "Download started.";
      }, true)}>Download attachment</button>}
    </div>
    {status && <p role="status" className="hl-meta">{status}{" "}
      {downloadFailed && <a href={source} target="_blank" rel="noopener noreferrer">Open attachment at source (new tab)</a>}
    </p>}
  </div>;
}
