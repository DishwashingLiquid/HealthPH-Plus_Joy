/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { getContentMediaSource } from "../shared";
import { createGalleryImageId, galleryValidationError, moveGalleryImage } from "./contentGallery";
import MediaFilePicker from "./MediaFilePicker";

function GalleryPreview({ entry }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!entry.file) { setSrc(getContentMediaSource(entry.media)); return; }
    const url = URL.createObjectURL(entry.file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [entry.file, entry.media]);
  return <img src={src || undefined} alt={entry.decorative ? "" : entry.alt || "Image preview"} className="max-h-[180px] w-full object-contain" />;
}

export default function ArticleGalleryEditor({ images = [], onChange, mode }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const commit = (next, announcement) => {
    const error = galleryValidationError(next);
    setError(error || "");
    setMessage(error ? "" : announcement || "");
    if (!error) onChange(next);
  };
  const update = (id, patch) => onChange(images.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  const add = (files) => {
    if (!files.length) return;
    commit([...images, ...files.map((file) => ({ id: createGalleryImageId(), file, caption: "", alt: "" }))], "Images added.");
  };
  return <section aria-labelledby={`gallery-heading-${mode}`} className="hl-gallery-editor border-t border-[#E5E5E5] pt-[16px]">
    <h3 id={`gallery-heading-${mode}`} className="mb-2 font-semibold">Article images <span className="hl-form-optional">(optional)</span></h3>
    <p className="mb-3 text-sm text-gray-600">Add photos or illustrations to your article.</p>
    <MediaFilePicker id={`gallery-add-${mode}`} label="Add images" multiple accept="image/jpeg,image/png,image/gif,image/webp"
      onFiles={add} disabled={images.length >= 10}
      hint="JPG, PNG, GIF or WebP. Up to 10 images, 26.2 MB each and 78.6 MB of new images per save." />
    <p role="status" aria-live="polite" className="hl-form-hint my-2">{images.length > 0 && `${images.length} of 10 images added.`} {message}</p>
    {error && <p role="alert" className="hl-form-error">{error}</p>}
    <ol className="flex flex-col gap-4">
      {images.map((entry, index) => <li key={entry.id} className="hl-gallery-image rounded-lg border border-[#D5DDE5] p-3">
        <p className="mb-1 text-sm font-semibold">Image {index + 1}</p>
        <p className="hl-upload-filename mb-3">{entry.file?.name || entry.media?.filename}</p>
        <GalleryPreview entry={entry} />
        <label htmlFor={`caption-${mode}-${entry.id}`} className="mt-3 block text-sm font-medium">Caption (optional)</label>
        <p id={`caption-hint-${mode}-${entry.id}`} className="hl-form-hint">Shown below this image in your article.</p>
        <textarea id={`caption-${mode}-${entry.id}`} value={entry.caption || ""} maxLength={1000} rows={2}
          aria-describedby={`caption-hint-${mode}-${entry.id}`}
          onChange={(event) => update(entry.id, { caption: event.target.value })} className="mt-1 w-full rounded border p-2" />
        <label htmlFor={`alt-${mode}-${entry.id}`} className="mt-3 block text-sm font-medium">Image description</label>
        <p id={`alt-hint-${mode}-${entry.id}`} className="hl-form-hint">Describe the important details for people using screen readers.</p>
        <input id={`alt-${mode}-${entry.id}`} type="text" value={entry.decorative ? "" : entry.alt || ""} maxLength={500}
          disabled={Boolean(entry.decorative)} aria-describedby={`alt-hint-${mode}-${entry.id}`}
          onChange={(event) => update(entry.id, { alt: event.target.value })} className="mt-1 w-full rounded border p-2" />
        <label className="hl-decorative-option">
          <input type="checkbox" id={`decorative-${mode}-${entry.id}`} checked={Boolean(entry.decorative)}
            onChange={(event) => update(entry.id, { decorative: event.target.checked })} />
          <span>This image is decorative <span className="hl-form-hint block">It adds no information to the article.</span></span>
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="hl-button hl-secondary" disabled={index === 0} aria-label={`Move image ${index + 1} up`}
            onClick={() => commit(moveGalleryImage(images, entry.id, -1), `Image moved to position ${index}.`)}>Move up</button>
          <button type="button" className="hl-button hl-secondary" disabled={index === images.length - 1} aria-label={`Move image ${index + 1} down`}
            onClick={() => commit(moveGalleryImage(images, entry.id, 1), `Image moved to position ${index + 2}.`)}>Move down</button>
          <MediaFilePicker id={`replace-${mode}-${entry.id}`} label="Replace" ariaLabel={`Replace image ${index + 1}`} compact accept="image/jpeg,image/png,image/gif,image/webp" onFiles={(files) => {
            if (files.length !== 1) { setError("Choose one replacement image."); return; }
            commit(images.map((image) => image.id === entry.id ? { ...image, file: files[0] } : image), "Image replaced. Caption and description kept.");
          }} />
          <button type="button" className="hl-button hl-secondary" aria-label={`Remove image ${index + 1}`}
            onClick={() => commit(images.filter((image) => image.id !== entry.id), "Image removed.")}>Remove</button>
        </div>
      </li>)}
    </ol>
  </section>;
}
