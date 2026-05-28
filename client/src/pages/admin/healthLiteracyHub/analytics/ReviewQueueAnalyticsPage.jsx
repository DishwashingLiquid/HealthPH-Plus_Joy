/* eslint-disable react/prop-types */
import { useState } from "react";
import ModalWithBody from "../../../../components/admin/ModalWithBody";
import {
  useApplyHealthLiteracyContentReviewActionMutation,
  useCreateHealthLiteracyContentMutation,
  useUpdateHealthLiteracyContentMutation,
} from "../../../../features/api/healthLiteracyHubSlice";
import { ContentFormBody } from "../ContentShared";
import {
  AnalyticsMetricCard,
  AnalyticsPanel,
  AnalyticsTable,
  ReviewQueueActionModal,
} from "../AnalyticsShared";
import {
  INITIAL_FORM_DATA,
  REVIEWER_OPTIONS,
  TAB_CONTENT_TYPES,
  UPLOAD_RULES,
  buildReviewQueueRows,
  formatNumber,
  getContentFormValidationError,
  getContentLabel,
  isAllowedMediaType,
  showToast,
} from "../shared";

const ReviewQueueAnalyticsPage = ({ rows, report }) => {
  const [selectedReviewItem, setSelectedReviewItem] = useState(null);
  const [selectedReviewer, setSelectedReviewer] = useState(
    REVIEWER_OPTIONS[1].value
  );
  const [editingReviewItem, setEditingReviewItem] = useState(null);
  const [creatingRelatedFor, setCreatingRelatedFor] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [applyReviewAction, { isLoading: isApplyingReviewAction }] =
    useApplyHealthLiteracyContentReviewActionMutation();
  const [createHealthLiteracyContent, { isLoading: isCreatingContent }] =
    useCreateHealthLiteracyContentMutation();
  const [updateHealthLiteracyContent, { isLoading: isUpdatingContent }] =
    useUpdateHealthLiteracyContentMutation();

  const reviewRows = buildReviewQueueRows(rows);
  const reviewQueueTableRows = reviewRows.map((item) => [
    item.title,
    item.reasons.join("; "),
    item.lastReviewDate,
    item.assignedReviewer,
  ]);
  const activeFormReviewItem = editingReviewItem ?? creatingRelatedFor;
  const activeFormContentTypeLabel = activeFormReviewItem?.contentType ?? "Articles";
  const activeFormContentType =
    TAB_CONTENT_TYPES[activeFormContentTypeLabel] ?? TAB_CONTENT_TYPES.Articles;
  const activeFormUploadRule =
    UPLOAD_RULES[activeFormContentTypeLabel] ?? UPLOAD_RULES.Articles;

  const resetForm = () => {
    setFormData(INITIAL_FORM_DATA);
  };

  const buildContentPayload = ({ includeRemoveMedia = false } = {}) => {
    const payload = new FormData();
    payload.append("title", formData.title);
    payload.append("description", formData.description);
    payload.append(
      "tags",
      JSON.stringify(
        formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      )
    );
    payload.append("publishToMobile", String(formData.publishToMobile));
    payload.append("publishToWebsite", String(formData.publishToWebsite));
    payload.append("isFactCheck", String(formData.isFactCheck));
    payload.append("claim", formData.claim);
    payload.append("claimStatus", formData.claimStatus);
    payload.append("verifiedBy", formData.verifiedBy);

    if (includeRemoveMedia) {
      payload.append("removeMedia", String(formData.removeMedia));
    }

    if (formData.media) {
      payload.append("file", formData.media);
    }

    return payload;
  };

  const validateForm = () => {
    const validationError = getContentFormValidationError(
      formData,
      activeFormContentTypeLabel
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

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const setMediaFile = (file) => {
    if (!file) return;

    if (!isAllowedMediaType(file, activeFormContentTypeLabel)) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message: `${activeFormContentTypeLabel} does not accept this file type`,
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({
        ...prev,
        media: file,
        mediaPreview: reader.result,
        existingMedia: null,
        removeMedia: false,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleMediaChange = (event) => {
    setMediaFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handleMediaDrop = (event) => {
    event.preventDefault();
    setMediaFile(event.dataTransfer.files?.[0]);
  };

  const handleRemoveMedia = () => {
    setFormData((prev) => ({
      ...prev,
      media: null,
      mediaPreview: null,
      existingMedia: null,
      removeMedia: Boolean(editingReviewItem),
    }));
  };

  const openReviewActions = (reviewItem) => {
    const reviewerIsValid = REVIEWER_OPTIONS.some(
      (option) => option.value === reviewItem.item.assignedReviewer
    );

    setSelectedReviewer(
      reviewerIsValid ? reviewItem.item.assignedReviewer : REVIEWER_OPTIONS[1].value
    );
    setSelectedReviewItem(reviewItem);
  };

  const openEditReviewContent = (reviewItem) => {
    const item = reviewItem.item;

    setFormData({
      title: item.title ?? "",
      description: item.description ?? "",
      tags: (item.tags ?? []).join(", "),
      media: null,
      mediaPreview: item.media?.dataUrl ?? null,
      existingMedia: item.media ?? null,
      removeMedia: false,
      publishToMobile: Boolean(item.publishToMobile),
      publishToWebsite: Boolean(item.publishToWebsite),
      isFactCheck: Boolean(item.isFactCheck),
      claim: item.claim ?? "",
      claimStatus: item.claimStatus ?? "Needs Expert Review",
      verifiedBy: item.verifiedBy ?? "Project Researcher",
    });
    setSelectedReviewItem(null);
    setEditingReviewItem(reviewItem);
  };

  const openCreateRelatedContent = (reviewItem) => {
    const item = reviewItem.item;
    const relatedTitle = item.title ? `Related to ${item.title}` : "";

    setFormData({
      ...INITIAL_FORM_DATA,
      title: relatedTitle,
      tags: (item.tags ?? []).join(", "),
    });
    setSelectedReviewItem(null);
    setCreatingRelatedFor(reviewItem);
  };

  const applyReviewQueueAction = async (action) => {
    if (!selectedReviewItem) return;

    try {
      await applyReviewAction({
        contentType: selectedReviewItem.contentTypeKey,
        contentId: selectedReviewItem.id,
        data: {
          action,
          assignedReviewer:
            action === "send_for_review" ? selectedReviewer : undefined,
        },
      }).unwrap();

      const successMessages = {
        send_for_review: "Content assigned for review",
        mark_reviewed: "Content marked as reviewed",
        archive: "Content archived and unpublished",
        pin: "Content pinned to the top of its hub section",
      };

      showToast({
        iconName: "CheckCircle",
        color: "success",
        message: successMessages[action],
      });
      setSelectedReviewItem(null);
    } catch (error) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message:
          error?.data?.detail ?? "Failed to save the review queue action",
      });
    }
  };

  const handleEditSubmit = async () => {
    if (!editingReviewItem || !validateForm()) return;

    try {
      await updateHealthLiteracyContent({
        contentType: activeFormContentType,
        contentId: editingReviewItem.id,
        data: buildContentPayload({ includeRemoveMedia: true }),
      }).unwrap();

      showToast({
        iconName: "CheckCircle",
        color: "success",
        message: `${getContentLabel(activeFormContentTypeLabel)} updated successfully`,
      });
      setEditingReviewItem(null);
      resetForm();
    } catch (error) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message:
          error?.data?.detail ??
          `Failed to update ${getContentLabel(activeFormContentTypeLabel).toLowerCase()}`,
      });
    }
  };

  const handleCreateRelatedSubmit = async () => {
    if (!creatingRelatedFor || !validateForm()) return;

    try {
      await createHealthLiteracyContent({
        contentType: activeFormContentType,
        data: buildContentPayload(),
      }).unwrap();

      showToast({
        iconName: "CheckCircle",
        color: "success",
        message: `Related ${getContentLabel(activeFormContentTypeLabel).toLowerCase()} created successfully`,
      });
      setCreatingRelatedFor(null);
      resetForm();
    } catch (error) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message:
          error?.data?.detail ??
          `Failed to create ${getContentLabel(activeFormContentTypeLabel).toLowerCase()}`,
      });
    }
  };

  return (
    <>
      <div className="flex flex-col gap-[16px]">
        <div className="grid grid-cols-1 gap-[12px] md:grid-cols-3">
          <AnalyticsMetricCard
            label="Items Needing Review"
            value={formatNumber(reviewRows.length)}
          />
          <AnalyticsMetricCard
            label="Overdue Review"
            value={formatNumber(
              reviewRows.filter((row) =>
                row.reasons.some((reason) => reason.startsWith("Overdue review"))
              ).length
            )}
          />
          <AnalyticsMetricCard
            label="Unassigned"
            value={formatNumber(
              reviewRows.filter((row) => row.assignedReviewer === "Unassigned")
                .length
            )}
          />
        </div>
        <AnalyticsPanel title="Review Queue">
          <AnalyticsTable
            columns={report.columns}
            rows={reviewQueueTableRows}
            emptyMessage="No content currently needs review."
            onRowClick={(row, rowIndex) => openReviewActions(reviewRows[rowIndex])}
            getRowLabel={(row) => `Open review actions for ${row[0]}`}
          />
        </AnalyticsPanel>
      </div>
      {selectedReviewItem && (
        <ReviewQueueActionModal
          reviewItem={selectedReviewItem}
          selectedReviewer={selectedReviewer}
          onReviewerChange={setSelectedReviewer}
          onEdit={() => openEditReviewContent(selectedReviewItem)}
          onSendForReview={() => applyReviewQueueAction("send_for_review")}
          onMarkReviewed={() => applyReviewQueueAction("mark_reviewed")}
          onArchive={() => applyReviewQueueAction("archive")}
          onCreateRelatedContent={() => openCreateRelatedContent(selectedReviewItem)}
          onPinToHub={() => applyReviewQueueAction("pin")}
          onClose={() => setSelectedReviewItem(null)}
          isLoading={isApplyingReviewAction}
        />
      )}
      {editingReviewItem && (
        <ModalWithBody
          onConfirm={handleEditSubmit}
          onConfirmLabel="Save"
          onCancel={() => {
            setEditingReviewItem(null);
            resetForm();
          }}
          onLoading={isUpdatingContent}
          onLoadingLabel="Saving..."
          heading={`Edit ${getContentLabel(activeFormContentTypeLabel)}`}
          color="primary"
          additionalClasses="!top-[68px] !h-[calc(100vh-68px)] !pt-[20px]"
        >
          <ContentFormBody
            formData={formData}
            uploadRule={activeFormUploadRule}
            mode="review-edit"
            onFormChange={handleFormChange}
            onMediaChange={handleMediaChange}
            onMediaDrop={handleMediaDrop}
            onRemoveMedia={handleRemoveMedia}
          />
        </ModalWithBody>
      )}
      {creatingRelatedFor && (
        <ModalWithBody
          onConfirm={handleCreateRelatedSubmit}
          onConfirmLabel="Create"
          onCancel={() => {
            setCreatingRelatedFor(null);
            resetForm();
          }}
          onLoading={isCreatingContent}
          onLoadingLabel="Creating..."
          heading={`Create Related ${getContentLabel(activeFormContentTypeLabel)}`}
          color="primary"
          additionalClasses="!top-[68px] !h-[calc(100vh-68px)] !pt-[20px]"
        >
          <ContentFormBody
            formData={formData}
            uploadRule={activeFormUploadRule}
            mode="related-create"
            onFormChange={handleFormChange}
            onMediaChange={handleMediaChange}
            onMediaDrop={handleMediaDrop}
            onRemoveMedia={handleRemoveMedia}
          />
        </ModalWithBody>
      )}
    </>
  );
};

export default ReviewQueueAnalyticsPage;
