import {
  getContentMediaSource,
  getContentViewCount,
  getLimitedContentTags,
  normalizeContentTags,
} from "../shared";

export const createEditFormData = ({ item, contentTypeLabel }) => {
  const mainImage = contentTypeLabel === "Articles" && item.media?.fileId && item.media?.contentType?.startsWith("image/")
    ? { id: `main-${item.media.fileId}`, media: item.media, caption: "", alt: "" } : null;
  return {
    title: item.title ?? "",
    description: item.description ?? "",
    shortPreview: item.shortPreview ?? "",
    migrationReviewNotes: item.staticArticleMigration?.reviewNotes ?? [],
    tags: getLimitedContentTags(item.tags).join(", "),
    topics: getLimitedContentTags(item.topics).join(", "),
    diseases: getLimitedContentTags(item.diseases).join(", "),
    language: item.language ?? "en",
    source: item.source ?? "",
    author: item.author ?? "",
    publishedDate: item.publishedDate
      ? String(item.publishedDate).slice(0, 16)
      : "",
    externalUrl: item.externalUrl ?? "",
    imageUrl: item.imageUrl === item.thumbnail?.url || item.imageUrl === item.media?.url
      ? "" : item.imageUrl ?? "",
    mediaUrl: item.mediaUrl === item.media?.url ? "" : item.mediaUrl ?? "",
    media: null,
    mediaPreview: mainImage ? null : getContentMediaSource(item.media) || null,
    existingMedia: mainImage ? null : item.media ?? null,
    galleryImages: [...(item.galleryImages || []), ...(mainImage ? [mainImage] : [])]
      .map((image) => ({ ...image, decorative: !image.alt?.trim() })),
    thumbnail: null,
    existingThumbnail: item.thumbnail ?? null,
    removeThumbnail: false,
    duration: item.duration ?? "",
    removeMedia: Boolean(mainImage),
    publishToMobile: Boolean(item.publishToMobile),
    publishToWebsite: Boolean(item.publishToWebsite),
    isFactCheck: Boolean(item.isFactCheck),
    claim: item.claim ?? "",
    claimStatus: item.claimStatus ?? "Needs Expert Review",
    verifiedBy: item.verifiedBy ?? "Project Researcher",
  };
};

export const createMediaPreviewContent = ({ item, contentTypeLabel }) => {
  return {
    item,
    title: item.title,
    description: item.description,
    media: item.media,
    contentType: contentTypeLabel,
    tags: item.tags ?? [],
    viewCount: getContentViewCount(item),
    uploadDate: item.date,
    publishToMobile: item.publishToMobile,
    publishToWebsite: item.publishToWebsite,
    canEdit: item.contentOrigin === "api",
  };
};

export const getShareUrl = (item) => {
  return (
    item.externalUrl ||
    item.publicUrl ||
    item.shareUrl ||
    (item.publishToWebsite || item.publishToMobile ? item.media?.url : "")
  );
};

export const buildContentFormPayload = ({
  formData,
  contentTypeLabel,
  includeRemoveMedia = false,
}) => {
  const payload = new FormData();
  payload.append("title", formData.title);
  payload.append("description", formData.description);
  if (contentTypeLabel === "Articles") payload.append("shortPreview", formData.shortPreview || "");
  payload.append("tags", JSON.stringify(normalizeContentTags(formData.tags)));
  payload.append("topics", JSON.stringify(normalizeContentTags(formData.topics)));
  payload.append("diseases", JSON.stringify(normalizeContentTags(formData.diseases)));
  payload.append("language", formData.language || "en");
  payload.append("source", formData.source);
  payload.append("author", formData.author);
  payload.append("publishedDate", formData.publishedDate || "");
  payload.append("externalUrl", formData.externalUrl);
  payload.append("imageUrl", formData.imageUrl);
  payload.append("mediaUrl", formData.mediaUrl);
  payload.append("publishToMobile", String(formData.publishToMobile));
  payload.append("publishToWebsite", String(formData.publishToWebsite));
  payload.append("isFactCheck", String(formData.isFactCheck));
  payload.append("claim", formData.claim);
  payload.append("claimStatus", formData.claimStatus);
  payload.append("verifiedBy", formData.verifiedBy);

  if (contentTypeLabel === "Videos") {
    payload.append("duration", formData.duration || "");
  }

  if (contentTypeLabel === "Articles") {
    payload.append("galleryImages", JSON.stringify((formData.galleryImages || []).map((image) => ({
      id: image.id, fileId: image.file ? undefined : image.media?.fileId,
      caption: image.caption || "", alt: image.decorative ? "" : image.alt || "",
    }))));
    for (const image of formData.galleryImages || []) {
      if (image.file) payload.append(`galleryFile_${image.id}`, image.file);
    }
  }

  if (includeRemoveMedia) {
    payload.append("removeMedia", String(formData.removeMedia));
    payload.append("removeThumbnail", String(formData.removeThumbnail));
  }

  if (formData.media) {
    payload.append("file", formData.media);
  }
  if (formData.thumbnail) {
    payload.append("thumbnail", formData.thumbnail);
  }

  return payload;
};
