const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// LAN HTTP previews may not expose randomUUID; generate once and retain the ID.
export const createGalleryImageId = () => globalThis.crypto?.randomUUID?.()
  ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const moveGalleryImage = (images, id, offset) => {
  const next = [...images];
  const index = next.findIndex((image) => image.id === id);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= next.length) return images;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

export const galleryValidationError = (images = []) => {
  if (images.length > 10) return "An article supports at most 10 gallery images";
  let bytes = 0;
  for (const image of images) {
    if ((image.caption || "").length > 1000) return "Captions support up to 1000 characters";
    if (!image.decorative && (image.alt || "").length > 500) return "Keep the image description under 500 characters";
    if (!image.file) continue;
    if (!IMAGE_TYPES.includes(image.file.type)) return "Choose JPG, PNG, GIF, or WEBP images";
    if (!image.file.size) return "This image is empty. Choose another image.";
    if (image.file.size > 25 * 1024 ** 2) return "This image is too large. Choose an image up to 26.2 MB.";
    bytes += image.file.size;
  }
  return bytes > 75 * 1024 ** 2 ? "These images are too large together. Add fewer images or use smaller files (up to 78.6 MB in total)." : null;
};
