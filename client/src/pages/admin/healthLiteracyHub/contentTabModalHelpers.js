import {
  getContentMediaSource,
  getContentViewCount,
  getLimitedContentTags,
  normalizeContentTags,
} from "./shared";

export const createEditFormData = ({ item, contentTypeLabel }) => {
  return {
    title: item.title ?? "",
    description: item.description ?? "",
    tags:
      contentTypeLabel === "Infographics"
        ? []
        : getLimitedContentTags(item.tags),
    media: null,
    mediaPreview: getContentMediaSource(item.media) || null,
    existingMedia: item.media ?? null,
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
    canEdit:
      item.source === "api" &&
      ["Videos", "Infographics"].includes(contentTypeLabel),
  };
};

export const getShareUrl = (item) => {
  return item.publicUrl || item.shareUrl || getContentMediaSource(item.media);
};

export const buildContentFormPayload = ({
  formData,
  contentTypeLabel,
  includeRemoveMedia = false,
}) => {
  const payload = new FormData();
  payload.append("title", formData.title);
  payload.append("description", formData.description);
  payload.append(
    "tags",
    JSON.stringify(
      contentTypeLabel === "Infographics"
        ? []
        : normalizeContentTags(formData.tags)
    )
  );
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
  }

  if (contentTypeLabel !== "Articles" && formData.media) {
    payload.append("file", formData.media);
  }

  return payload;
};
