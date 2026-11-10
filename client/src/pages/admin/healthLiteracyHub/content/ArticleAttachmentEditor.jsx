/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import MediaFilePicker from "./MediaFilePicker";
import { getMediaSizeError } from "../shared";

export default function ArticleAttachmentEditor({ formData, mode, onMediaChange, onRemoveMedia }) {
  const hasAttachment = Boolean((formData.media || formData.existingMedia) && !formData.removeMedia);
  const [open, setOpen] = useState(hasAttachment);
  const [error, setError] = useState("");
  useEffect(() => { if (hasAttachment) setOpen(true); }, [hasAttachment]);
  const name = formData.media?.name || formData.existingMedia?.filename;
  const mime = formData.media?.type || formData.existingMedia?.contentType || "";
  const select = (files) => {
    if (!files.length) return;
    if (files.length !== 1) { setError("Choose one video or PDF."); return; }
    const file = files[0];
    if (!["video/mp4", "video/quicktime", "video/webm", "application/pdf"].includes(file.type)) {
      setError(file.type.startsWith("image/") ? "Use Add images above for photos and illustrations." : "Choose an MP4, MOV, WebM video or a PDF.");
      return;
    }
    if (getMediaSizeError(file)) {
      setError(file.size ? "This file is too large. Choose a smaller file within the size limit below." : "This file is empty. Choose another file.");
      return;
    }
    setError("");
    onMediaChange({ target: { files, value: "" } });
  };
  return <details className="hl-attachment-editor" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>Attach a video or PDF <span className="hl-form-optional">(optional)</span></summary>
    <div className="hl-attachment-body">
      <p className="hl-form-hint">Add one supporting video or document to your article.</p>
      {hasAttachment && <div className="hl-upload-preview">
        {formData.mediaPreview && mime.startsWith("video/") && <video src={formData.mediaPreview} controls preload="metadata" />}
        <p className="hl-upload-filename">{name}</p>
        {formData.existingMedia?.migrationRequired && <p role="status" className="hl-form-hint">This file cannot be previewed yet. You can keep it or choose a replacement.</p>}
      </div>}
      <MediaFilePicker id={`health-literacy-media-upload-${mode}`} label={hasAttachment ? "Replace file" : "Choose video or PDF"}
        accept="video/mp4,video/quicktime,video/webm,application/pdf" onFiles={select}
        hint="PDF: up to 26.2 MB. MP4, MOV or WebM video: up to 262.1 MB." />
      {error && <p role="alert" className="hl-form-error">{error}</p>}
      {hasAttachment && <button type="button" className="hl-text-button" onClick={() => { setError(""); onRemoveMedia(); }}>Remove file</button>}
    </div>
  </details>;
}
