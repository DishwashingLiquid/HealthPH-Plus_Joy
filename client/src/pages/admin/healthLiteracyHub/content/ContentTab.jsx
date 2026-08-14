/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import Icon from "../../../../components/Icon";
import { ToolbarSearch } from "../../../../components/ToolbarControls";
import ModalWithBody from "../../../../components/admin/ModalWithBody";
import {
  useCreateHealthLiteracyAnalyticsEventMutation,
  useCreateHealthLiteracyContentMutation,
  useDeleteHealthLiteracyContentMutation,
  useFetchHealthLiteracyContentQuery,
  useUpdateHealthLiteracyContentMutation,
} from "../../../../features/api/healthLiteracyHubSlice";
import { ContentGrid } from "./ContentCards";
import { ContentFormBody } from "./ContentFormBody";
import ContentMediaPreviewBody from "./ContentMediaPreviewBody";
import {
  downloadMediaFile,
  getVideoFileDuration,
  readFileAsDataUrl,
} from "./contentTabFileMedia";
import { getFilteredContentItems } from "./contentTabFiltering";
import {
  buildContentFormPayload,
  createEditFormData,
  createMediaPreviewContent,
  getShareUrl,
} from "./contentTabModalHelpers";
import {
  INITIAL_FORM_DATA,
  TAB_CONTENT_TYPES,
  UPLOAD_RULES,
  getAnalyticsRegionValue,
  getContentFormValidationError,
  getContentLabel,
  getContentMediaSource,
  getHealthLiteracyVisitorId,
  isAllowedMediaType,
  showToast,
} from "../shared";

const ContentTab = ({ contentTypeLabel }) => {
  const user = useSelector((state) => state.auth.user);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
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
  const [deleteHealthLiteracyContent, { isLoading: isDeletingContent }] =
    useDeleteHealthLiteracyContentMutation();
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

  const closeEditModal = () => {
    setIsDeleteModalOpen(false);
    setIsEditModalOpen(false);
    setEditingContent(null);
    resetForm();
  };

  const handleCreateClick = () => {
    resetForm();
    setEditingContent(null);
    setIsCreateModalOpen(true);
  };

  const handleEditClick = (item) => {
    if (item.contentOrigin !== "api") return;

    setEditingContent(item);
    setFormData(createEditFormData({ item }));
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

    setSelectedMediaContent(createMediaPreviewContent({ item, contentTypeLabel }));
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

    downloadMediaFile({
      url: mediaSource,
      filename: item.media?.filename || `${item.title || "infographic"}`,
    });
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
        data: buildContentFormPayload({ formData, contentTypeLabel }),
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
        data: buildContentFormPayload({
          formData,
          contentTypeLabel,
          includeRemoveMedia: true,
        }),
      }).unwrap();

      showToast({
        iconName: "CheckCircle",
        color: "success",
        message: `${getContentLabel(contentTypeLabel)} updated successfully`,
      });

      closeEditModal();
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

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleDeleteSubmit = async () => {
    if (!editingContent) return;

    try {
      await deleteHealthLiteracyContent({
        contentType,
        contentId: editingContent.id,
      }).unwrap();

      showToast({
        iconName: "CheckCircle",
        color: "success",
        message: `${getContentLabel(contentTypeLabel)} deleted successfully`,
      });

      closeEditModal();
    } catch (error) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message:
          error?.data?.detail ??
          `Failed to delete ${getContentLabel(contentTypeLabel).toLowerCase()}`,
      });
    }
  };

  const setMediaFile = async (file) => {
    if (!file) return;

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

  const handleMediaChange = async (event) => {
    const file = event.target.files?.[0];
    await setMediaFile(file);
    event.target.value = "";
  };

  const handleMediaDrop = async (event) => {
    event.preventDefault();
    await setMediaFile(event.dataTransfer.files?.[0]);
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

  const filteredContent = getFilteredContentItems({
    fetchedContent,
    contentTypeLabel,
    searchQuery,
  });

  return (
    <>
      <div className="flex flex-col items-start gap-[12px] sm:flex-row sm:items-center">
        <ToolbarSearch
          placeholder={`Search ${contentTypeLabel.toLowerCase()}...`}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <button
          onClick={handleCreateClick}
          className="prod-btn-base admin-module-brand-btn flex items-center justify-center whitespace-nowrap"
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
        content={filteredContent}
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
          additionalClasses="health-literacy-content-modal admin-brand-modal !top-[68px] !h-[calc(100vh-68px)] !pt-[20px]"
        >
          <ContentFormBody
            formData={formData}
            uploadRule={uploadRule}
            mode="create"
            onFormChange={handleFormChange}
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
          onCancel={closeEditModal}
          onLoading={isUpdatingContent}
          onLoadingLabel="Saving..."
          heading={`Edit ${getContentLabel(contentTypeLabel)}`}
          color="primary"
          additionalClasses="health-literacy-content-modal admin-brand-modal !top-[68px] !h-[calc(100vh-68px)] !pt-[20px]"
        >
          <ContentFormBody
            formData={formData}
            uploadRule={uploadRule}
            mode="edit"
            onFormChange={handleFormChange}
            onMediaChange={handleMediaChange}
            onMediaDrop={handleMediaDrop}
            onRemoveMedia={handleRemoveMedia}
            onDelete={() => setIsDeleteModalOpen(true)}
            onDeleteDisabled={isUpdatingContent || isDeletingContent}
          />
        </ModalWithBody>
      )}

      {isDeleteModalOpen && editingContent && (
        <ModalWithBody
          onConfirm={handleDeleteSubmit}
          onConfirmLabel="Delete"
          onCancel={() => setIsDeleteModalOpen(false)}
          onLoading={isDeletingContent}
          onLoadingLabel="Deleting..."
          heading="Delete Content"
          color="destructive"
          additionalClasses="!z-[70]"
        >
          <div className="p-[20px]">
            <p className="text-[14px] text-gray-700">
              Are you sure you want to delete this content?
            </p>
          </div>
        </ModalWithBody>
      )}

      {selectedMediaContent && (
        <ModalWithBody
          onConfirm={() => setSelectedMediaContent(null)}
          onConfirmLabel="Close"
          onCancel={() => setSelectedMediaContent(null)}
          heading={selectedMediaContent.title}
          color="primary"
          additionalClasses="health-literacy-content-modal admin-brand-modal !top-[68px] !h-[calc(100vh-68px)] !pt-[20px]"
        >
          <ContentMediaPreviewBody
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
          />
        </ModalWithBody>
      )}
    </>
  );
};

export default ContentTab;
