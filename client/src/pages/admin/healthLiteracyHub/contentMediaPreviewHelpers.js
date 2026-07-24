export const getContentFormMediaPreviewState = (formData) => {
  return {
    hasMediaPreview: Boolean(formData.mediaPreview) && !formData.removeMedia,
    previewType: formData.media?.type ?? formData.existingMedia?.contentType ?? "",
    previewName: formData.media?.name ?? formData.existingMedia?.filename ?? "",
  };
};
