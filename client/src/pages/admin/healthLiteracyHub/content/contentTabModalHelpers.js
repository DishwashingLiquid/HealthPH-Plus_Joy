import {
  getContentMediaSource,
  getContentViewCount,
  getLimitedContentTags,
  normalizeContentTags,
} from "../shared";

export const createEditFormData = ({ item }) => {
  return {
    title: item.title ?? "",
    description: item.description ?? "",
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
    mediaPreview: getContentMediaSource(item.media) || null,
    existingMedia: item.media ?? null,
    thumbnail: null,
    existingThumbnail: item.thumbnail ?? null,
    removeThumbnail: false,
    duration: item.duration ?? "",
    removeMedia: false,
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
