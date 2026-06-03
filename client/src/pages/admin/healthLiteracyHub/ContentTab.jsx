/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import Input from "../../../components/Input";
import Icon from "../../../components/Icon";
import ModalWithBody from "../../../components/admin/ModalWithBody";
import {
  useCreateHealthLiteracyAnalyticsEventMutation,
  useCreateHealthLiteracyContentMutation,
  useFetchHealthLiteracyContentQuery,
  useUpdateHealthLiteracyContentMutation,
} from "../../../features/api/healthLiteracyHubSlice";
import { ContentFormBody, ContentGrid, MediaPreviewModal } from "./ContentShared";
import {
  INITIAL_FORM_DATA,
  TAB_CONTENT_TYPES,
  UPLOAD_RULES,
  getAnalyticsRegionValue,
  getContentFormValidationError,
  getContentLabel,
  getContentMediaSource,
  getContentViewCount,
  getHealthLiteracyVisitorId,
  getLimitedContentTags,
  formatVideoDuration,
  isAllowedMediaType,
  normalizeContentTags,
  normalizeApiContent,
  showToast,
} from "./shared";

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const getVideoFileDuration = (file) =>
  new Promise((resolve) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = formatVideoDuration(video.duration);
      cleanup();
      resolve(duration);
    };
    video.onerror = () => {
      cleanup();
      resolve("");
    };
    video.src = objectUrl;
  });

const ContentTab = ({ contentTypeLabel }) => {
  const user = useSelector((state) => state.auth.user);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMediaContent, setSelectedMediaContent] = useState(null);
  const [editingContent, setEditingContent] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  const contentType = TAB_CONTENT_TYPES[contentTypeLabel];

  const { data: fetchedContent = [], isFetching: isFetchingContent } =
    useFetchHealthLiteracyContentQuery(contentType, {
      skip: !contentType,
    });

  const [createHealthLiteracyContent, { isLoading: isCreatingContent }] =
    useCreateHealthLiteracyContentMutation();
  const [updateHealthLiteracyContent, { isLoading: isUpdatingContent }] =
    useUpdateHealthLiteracyContentMutation();
  const [createHealthLiteracyAnalyticsEvent] =
    useCreateHealthLiteracyAnalyticsEventMutation();

  const uploadRule = UPLOAD_RULES[contentTypeLabel] ?? UPLOAD_RULES.Articles;

  useEffect(() => {
    const topic = searchQuery.trim();

    if (!contentType || topic.length < 2) return undefined;

    const timeoutId = window.setTimeout(() => {
      createHealthLiteracyAnalyticsEvent({
        eventType: "search",
        contentType: contentTypeLabel,
        region: "all",
        topic,
        visitorId: getHealthLiteracyVisitorId(user?.id),
      }).catch(() => {});
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [
    contentType,
    contentTypeLabel,
    createHealthLiteracyAnalyticsEvent,
    searchQuery,
    user?.id,
  ]);

  const resetForm = () => {
    setFormData(INITIAL_FORM_DATA);
  };

  const filterContent = (content) => {
    if (!searchQuery) return content;

    const searchTerms = searchQuery
      .toLowerCase()
      .split(" ")
      .filter((term) => term.length > 0);

    return content.filter((item) => {
      const searchableText = `${item.title} ${item.description} ${
        item.tags ? item.tags.join(" ") : ""
      }`.toLowerCase();

      return searchTerms.some((term) => searchableText.includes(term));
    });
  };

  const handleCreateClick = () => {
    resetForm();
    setEditingContent(null);
    setIsCreateModalOpen(true);
  };

  const handleEditClick = (item) => {
    if (item.source !== "api") return;

    setEditingContent(item);
    setFormData({
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
    });
    setIsEditModalOpen(true);
  };

  const handleMediaPreviewClick = (item) => {
    if (!getContentMediaSource(item.media) && contentTypeLabel !== "Infographics") {
      return;
    }

    createHealthLiteracyAnalyticsEvent({
      eventType: "content_opened",
      contentId: item.id ? String(item.id) : undefined,
      contentTitle: item.title,
      contentType: contentTypeLabel,
      region: item.region ?? getAnalyticsRegionValue(contentTypeLabel, item),
      visitorId: getHealthLiteracyVisitorId(user?.id),
    }).catch(() => {});

    setSelectedMediaContent({
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
    });
  };

  const getShareUrl = (item) => {
    return item.publicUrl || item.shareUrl || getContentMediaSource(item.media);
  };

  const handleShareClick = async (item) => {
    const shareUrl = getShareUrl(item);

    if (!shareUrl) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message: "No share URL is available for this article",
      });
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: item.title,
          text: item.description,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        showToast({
          iconName: "CheckCircle",
          color: "success",
          message: "Article link copied to clipboard",
        });
      }
    } catch (error) {
      if (error?.name === "AbortError") return;

      showToast({
        iconName: "Error",
        color: "destructive",
        message: "Failed to share article",
      });
    }
  };

  const handleDownloadClick = (item) => {
    const mediaSource = getContentMediaSource(item.media);

    if (!mediaSource) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message: "No infographic file is available to download",
      });
      return;
    }

    const filename = item.media?.filename || `${item.title || "infographic"}`;
    const downloadLink = document.createElement("a");
    downloadLink.href = mediaSource;
    downloadLink.download = filename;
    downloadLink.rel = "noopener noreferrer";
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const buildContentPayload = ({ includeRemoveMedia = false } = {}) => {
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

  const validateForm = () => {
    const validationError = getContentFormValidationError(
      formData,
      contentTypeLabel
    );

    if (validationError) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message: validationError,
      });
      return false;
    }

    return true;
  };

  const handleCreateSubmit = async () => {
    if (!validateForm()) return;

    try {
      await createHealthLiteracyContent({
        contentType,
        data: buildContentPayload(),
      }).unwrap();

      showToast({
        iconName: "CheckCircle",
        color: "success",
        message: `New ${getContentLabel(contentTypeLabel)} created successfully`,
      });

      setIsCreateModalOpen(false);
      resetForm();
    } catch (error) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message:
          error?.data?.detail ??
          `Failed to create ${getContentLabel(contentTypeLabel).toLowerCase()}`,
      });
    }
  };

  const handleEditSubmit = async () => {
    if (!editingContent || !validateForm()) return;

    try {
      await updateHealthLiteracyContent({
        contentType,
        contentId: editingContent.id,
        data: buildContentPayload({ includeRemoveMedia: true }),
      }).unwrap();

      showToast({
        iconName: "CheckCircle",
        color: "success",
        message: `${getContentLabel(contentTypeLabel)} updated successfully`,
      });

      setIsEditModalOpen(false);
      setEditingContent(null);
      resetForm();
    } catch (error) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message:
          error?.data?.detail ??
          `Failed to update ${getContentLabel(contentTypeLabel).toLowerCase()}`,
      });
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleTagsChange = (tags) => {
    setFormData((prev) => ({
      ...prev,
      tags: getLimitedContentTags(tags),
    }));
  };

  const setMediaFile = async (file) => {
    if (!file) return;

    if (contentTypeLabel === "Articles") {
      showToast({
        iconName: "Error",
        color: "destructive",
        message: "Articles only accept text content",
      });
      return;
    }

    if (!isAllowedMediaType(file, contentTypeLabel)) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message: `${contentTypeLabel} does not accept this file type`,
      });
      return;
    }

    try {
      const mediaPreview = await readFileAsDataUrl(file);
      const duration =
        contentTypeLabel === "Videos" ? await getVideoFileDuration(file) : "";

      setFormData((prev) => ({
        ...prev,
        media: file,
        mediaPreview,
        existingMedia: null,
        duration: contentTypeLabel === "Videos" ? duration : "",
        removeMedia: false,
      }));
    } catch {
      showToast({
        iconName: "Error",
        color: "destructive",
        message: "Failed to read the selected media file",
      });
    }
  };

  const handleMediaChange = async (e) => {
    const file = e.target.files?.[0];
    await setMediaFile(file);
    e.target.value = "";
  };

  const handleMediaDrop = async (e) => {
    e.preventDefault();
    await setMediaFile(e.dataTransfer.files?.[0]);
  };

  const handleRemoveMedia = () => {
    setFormData((prev) => ({
      ...prev,
      media: null,
      mediaPreview: null,
      existingMedia: null,
      duration: contentTypeLabel === "Videos" ? "" : prev.duration,
      removeMedia: Boolean(isEditModalOpen),
    }));
  };

  const getFilteredContent = () => {
    const apiContent = normalizeApiContent(fetchedContent).map((item) => ({
      ...item,
      contentType: contentTypeLabel,
      region: getAnalyticsRegionValue(contentTypeLabel, item),
      tags: contentTypeLabel === "Infographics" ? [] : item.tags,
    }));

    return filterContent(apiContent);
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-[12px] items-start sm:items-center">
        <Input
          size="input-md"
          id={`search-${contentTypeLabel.toLowerCase()}`}
          additionalClasses="flex-1"
          placeholder={`Search ${contentTypeLabel.toLowerCase()}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leadingIcon="Search"
          trailingIcon={searchQuery.length > 0 ? "Close" : undefined}
          onClickTrailing={
            searchQuery.length > 0 ? () => setSearchQuery("") : undefined
          }
        />
        <button
          onClick={handleCreateClick}
          className="prod-btn-base prod-btn-primary flex justify-center items-center whitespace-nowrap"
        >
          <span>Create New Content</span>
          <Icon
            iconName="Plus"
            height="20px"
            width="20px"
            fill="#FFF"
            className="ms-[8px]"
          />
        </button>
      </div>

      <ContentGrid
        content={getFilteredContent()}
        contentType={contentTypeLabel}
        isLoading={isFetchingContent}
        onMediaClick={handleMediaPreviewClick}
        onEditClick={handleEditClick}
        onShareClick={handleShareClick}
        onDownloadClick={handleDownloadClick}
      />

      {isCreateModalOpen && (
        <ModalWithBody
          onConfirm={handleCreateSubmit}
          onConfirmLabel="Create"
          onCancel={() => {
            setIsCreateModalOpen(false);
            resetForm();
          }}
          onLoading={isCreatingContent}
          onLoadingLabel="Creating..."
          heading={`Create New ${getContentLabel(contentTypeLabel)}`}
          color="primary"
          additionalClasses="health-literacy-content-modal !top-[68px] !h-[calc(100vh-68px)] !pt-[20px]"
        >
          <ContentFormBody
            formData={formData}
            uploadRule={uploadRule}
            mode="create"
            contentTypeLabel={contentTypeLabel}
            onFormChange={handleFormChange}
            onTagsChange={handleTagsChange}
            onMediaChange={handleMediaChange}
            onMediaDrop={handleMediaDrop}
            onRemoveMedia={handleRemoveMedia}
          />
        </ModalWithBody>
      )}

      {isEditModalOpen && (
        <ModalWithBody
          onConfirm={handleEditSubmit}
          onConfirmLabel="Save"
          onCancel={() => {
            setIsEditModalOpen(false);
            setEditingContent(null);
            resetForm();
          }}
          onLoading={isUpdatingContent}
          onLoadingLabel="Saving..."
          heading={`Edit ${getContentLabel(contentTypeLabel)}`}
          color="primary"
          additionalClasses={`${
            ["Articles", "Infographics"].includes(contentTypeLabel)
              ? "health-literacy-content-modal "
              : ""
          }!top-[68px] !h-[calc(100vh-68px)] !pt-[20px]`}
        >
          <ContentFormBody
            formData={formData}
            uploadRule={uploadRule}
            mode="edit"
            contentTypeLabel={contentTypeLabel}
            onFormChange={handleFormChange}
            onTagsChange={handleTagsChange}
            onMediaChange={handleMediaChange}
            onMediaDrop={handleMediaDrop}
            onRemoveMedia={handleRemoveMedia}
          />
        </ModalWithBody>
      )}

      {selectedMediaContent && (
        <MediaPreviewModal
          item={selectedMediaContent.item}
          title={selectedMediaContent.title}
          description={selectedMediaContent.description}
          media={selectedMediaContent.media}
          contentType={selectedMediaContent.contentType}
          tags={selectedMediaContent.tags}
          viewCount={selectedMediaContent.viewCount}
          uploadDate={selectedMediaContent.uploadDate}
          publishToMobile={selectedMediaContent.publishToMobile}
          publishToWebsite={selectedMediaContent.publishToWebsite}
          canEdit={selectedMediaContent.canEdit}
          onDownloadClick={handleDownloadClick}
          onEditClick={(item) => {
            setSelectedMediaContent(null);
            handleEditClick(item);
          }}
          onClose={() => setSelectedMediaContent(null)}
        />
      )}
    </>
  );
};

export default ContentTab;

