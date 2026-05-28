/* eslint-disable react/prop-types */
import Icon from "../../../components/Icon";
import {
  FACT_CHECK_CLAIM_STATUS_OPTIONS,
  FACT_CHECK_VERIFIED_BY_OPTIONS,
} from "./shared";
export const ContentFormBody = ({
  formData,
  uploadRule,
  mode,
  onFormChange,
  onMediaChange,
  onMediaDrop,
  onRemoveMedia,
}) => {
  const uploadInputId = `health-literacy-media-upload-${mode}`;
  const hasMediaPreview = Boolean(formData.mediaPreview) && !formData.removeMedia;
  const previewType =
    formData.media?.type ?? formData.existingMedia?.contentType ?? "";
  const previewName =
    formData.media?.name ?? formData.existingMedia?.filename ?? "";

  return (
    <div className="p-[20px] flex flex-col gap-[16px] max-h-[60vh] overflow-y-auto">
      <div>
        <label className="block text-[14px] font-medium text-gray-800 mb-[8px]">
          Title *
        </label>
        <input
          type="text"
          name="title"
          value={formData.title}
          onChange={onFormChange}
          placeholder="Enter content title"
          className="w-full px-[12px] py-[10px] border border-[#E5E5E5] rounded-[8px] text-[14px] focus:outline-none focus:border-[#6A8EB5]"
        />
      </div>
      <div>
        <label className="block text-[14px] font-medium text-gray-800 mb-[8px]">
          Description *
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={onFormChange}
          placeholder="Enter content description"
          className="w-full max-h-[220px] px-[12px] py-[10px] border border-[#E5E5E5] rounded-[8px] text-[14px] focus:outline-none focus:border-[#6A8EB5]"
          rows="5"
        />
      </div>
      <div>
        <label className="block text-[14px] font-medium text-gray-800 mb-[8px]">
          Tags (comma-separated)
        </label>
        <input
          type="text"
          name="tags"
          value={formData.tags}
          onChange={onFormChange}
          placeholder="e.g., health, education, wellness"
          className="w-full px-[12px] py-[10px] border border-[#E5E5E5] rounded-[8px] text-[14px] focus:outline-none focus:border-[#6A8EB5]"
        />
      </div>
      <div>
        <label className="block text-[14px] font-medium text-gray-800 mb-[8px]">
          {uploadRule.label}
        </label>
        <label
          htmlFor={uploadInputId}
          className="block border-2 border-dashed border-[#E5E5E5] rounded-[8px] p-[20px] text-center cursor-pointer hover:bg-[#F9F9F9] transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onMediaDrop}
        >
          {hasMediaPreview ? (
            <div className="flex flex-col items-center">
              {previewType.startsWith("video/") ? (
                <video
                  src={formData.mediaPreview}
                  className="w-[140px] h-[100px] object-cover rounded-[4px] mb-[8px]"
                  controls
                />
              ) : (
                <img
                  src={formData.mediaPreview}
                  alt="Preview"
                  className="w-[100px] h-[100px] object-cover rounded-[4px] mb-[8px]"
                />
              )}
              {previewName && (
                <p className="text-[13px] text-gray-600 font-medium break-all">
                  {previewName}
                </p>
              )}
              <p className="text-[12px] text-gray-500 mt-[4px]">
                Click to change
              </p>
            </div>
          ) : (
            <div>
              <Icon
                iconName="Upload"
                height="32px"
                width="32px"
                fill="#D0D5DD"
                className="mx-auto mb-[8px]"
              />
              <p className="text-[14px] font-medium text-gray-800">
                Drag and drop your file
              </p>
              <p className="text-[12px] text-gray-500 mt-[4px]">
                or click to browse
              </p>
              <p className="text-[11px] text-gray-400 mt-[8px]">
                {uploadRule.helperText}
              </p>
            </div>
          )}
        </label>
        <input
          id={uploadInputId}
          type="file"
          accept={uploadRule.accept}
          onChange={onMediaChange}
          className="hidden"
        />
        {hasMediaPreview && (
          <button
            type="button"
            onClick={onRemoveMedia}
            className="text-[12px] text-red-500 hover:text-red-700 mt-[8px] font-medium"
          >
            Remove file
          </button>
        )}
      </div>
      <div className="border-t border-[#E5E5E5] pt-[16px]">
        <p className="text-[14px] font-medium text-gray-800 mb-[8px]">
          Publish Options
        </p>
        <div className="flex flex-col gap-[10px]">
          <label className="flex items-center gap-[10px] text-[14px] text-gray-700">
            <input
              type="checkbox"
              name="publishToMobile"
              checked={formData.publishToMobile}
              onChange={onFormChange}
              className="h-[16px] w-[16px]"
            />
            Publish to mobile application
          </label>
          <label className="flex items-center gap-[10px] text-[14px] text-gray-700">
            <input
              type="checkbox"
              name="publishToWebsite"
              checked={formData.publishToWebsite}
              onChange={onFormChange}
              className="h-[16px] w-[16px]"
            />
            Publish to website
          </label>
        </div>
      </div>
      <div className="border-t border-[#E5E5E5] pt-[16px]">
        <label className="flex items-center gap-[10px] text-[14px] font-medium text-gray-800">
          <input
            type="checkbox"
            name="isFactCheck"
            checked={formData.isFactCheck}
            onChange={onFormChange}
            className="h-[16px] w-[16px]"
          />
          Mark as fact-check content
        </label>
        {formData.isFactCheck && (
          <div className="mt-[14px] grid grid-cols-1 gap-[12px]">
            <div>
              <label className="block text-[14px] font-medium text-gray-800 mb-[8px]">
                Claim *
              </label>
              <textarea
                name="claim"
                value={formData.claim}
                onChange={onFormChange}
                placeholder="Enter the fact-check claim"
                className="w-full max-h-[160px] px-[12px] py-[10px] border border-[#E5E5E5] rounded-[8px] text-[14px] focus:outline-none focus:border-[#6A8EB5]"
                rows="3"
              />
            </div>
            <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
              <div>
                <label className="block text-[14px] font-medium text-gray-800 mb-[8px]">
                  Claim Status
                </label>
                <select
                  name="claimStatus"
                  value={formData.claimStatus}
                  onChange={onFormChange}
                  className="w-full px-[12px] py-[10px] border border-[#E5E5E5] rounded-[8px] text-[14px] focus:outline-none focus:border-[#6A8EB5]"
                >
                  {FACT_CHECK_CLAIM_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[14px] font-medium text-gray-800 mb-[8px]">
                  Verified by
                </label>
                <select
                  name="verifiedBy"
                  value={formData.verifiedBy}
                  onChange={onFormChange}
                  className="w-full px-[12px] py-[10px] border border-[#E5E5E5] rounded-[8px] text-[14px] focus:outline-none focus:border-[#6A8EB5]"
                >
                  {FACT_CHECK_VERIFIED_BY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const ContentGrid = ({
  content,
  contentType,
  isLoading,
  onMediaClick,
  onEditClick,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[40px] flex flex-col items-center justify-center text-center">
        <p className="text-[16px] font-medium text-gray-600">
          Loading {contentType.toLowerCase()}...
        </p>
      </div>
    );
  }

  if (content.length === 0) {
    return (
      <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[40px] flex flex-col items-center justify-center text-center">
        <Icon
          iconName="Search"
          height="48px"
          width="48px"
          fill="#D0D5DD"
          className="mb-[16px]"
        />
        <p className="text-[16px] font-medium text-gray-600 mb-[8px]">
          No {contentType.toLowerCase()} found
        </p>
        <p className="text-[14px] text-gray-500">
          Try adjusting your search terms or create new content
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[20px]">
      {content.map((item) => (
        <ContentCard
          key={`${item.source ?? "content"}-${item.id}`}
          item={item}
          onMediaClick={onMediaClick}
          onEditClick={onEditClick}
        />
      ))}
    </div>
  );
};

const ContentCard = ({ item, onMediaClick, onEditClick }) => {
  const media = item.media;
  const mediaType = media?.contentType ?? "";
  const hasPreviewMedia = Boolean(media?.dataUrl);
  const canEdit = item.source === "api";
  const MediaPreviewWrapper = hasPreviewMedia ? "button" : "div";

  return (
    <div className="bg-white rounded-[12px] border border-[#E5E5E5] overflow-hidden hover:shadow-lg transition-shadow">
      <MediaPreviewWrapper
        type={hasPreviewMedia ? "button" : undefined}
        onClick={hasPreviewMedia ? () => onMediaClick(item) : undefined}
        className={`bg-gradient-to-br from-[#6A8EB5] to-[#78C6B2] h-[180px] w-full flex items-center justify-center ${
          hasPreviewMedia
            ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6A8EB5] focus:ring-offset-2"
            : ""
        }`}
        aria-label={hasPreviewMedia ? `Open ${item.title} media preview` : undefined}
      >
        {media?.dataUrl && mediaType.startsWith("image/") ? (
          <img
            src={media.dataUrl}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : media?.dataUrl && mediaType.startsWith("video/") ? (
          <video
            src={media.dataUrl}
            className="w-full h-full object-cover"
            muted
            playsInline
          />
        ) : (
          <Icon
            iconName="Image"
            height="64px"
            width="64px"
            fill="#FFFFFF"
            opacity="0.5"
          />
        )}
      </MediaPreviewWrapper>

      <div className="p-[16px]">
        <div className="flex items-start justify-between gap-[12px] mb-[8px]">
          <h3 className="text-[16px] font-semibold text-gray-800 line-clamp-2">
            {item.title}
          </h3>
          {canEdit && (
            <button
              type="button"
              onClick={() => onEditClick(item)}
              className="flex-shrink-0 rounded-[6px] border border-[#E5E5E5] px-[10px] py-[6px] text-[12px] font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6A8EB5]"
            >
              Edit
            </button>
          )}
        </div>
        <p className="h-[58px] overflow-y-auto text-[13px] text-gray-600 mb-[12px] pr-[4px]">
          {item.description}
        </p>

        <div className="flex flex-wrap gap-[6px] mb-[12px]">
          {(item.tags ?? []).slice(0, 2).map((tag, index) => (
            <span
              key={index}
              className="inline-block px-[8px] py-[4px] bg-[#F5F5F5] rounded-[4px] text-[11px] text-gray-600 font-medium"
            >
              {tag}
            </span>
          ))}
          {(item.tags ?? []).length > 2 && (
            <span className="inline-block px-[8px] py-[4px] bg-[#F5F5F5] rounded-[4px] text-[11px] text-gray-600 font-medium">
              +{item.tags.length - 2}
            </span>
          )}
        </div>

        <div className="text-[12px] text-gray-500 flex flex-col gap-[4px]">
          {item.date && <span>Date: {item.date}</span>}
          {item.duration && <span>Duration: {item.duration}</span>}
          {item.source === "api" && (
            <span>
              Publish:{" "}
              {[
                item.publishToMobile ? "Mobile" : null,
                item.publishToWebsite ? "Website" : null,
              ]
                .filter(Boolean)
                .join(", ") || "Not selected"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const MediaPreviewModal = ({
  title,
  description,
  media,
  publishToMobile,
  publishToWebsite,
  onClose,
}) => {
  const mediaType = media?.contentType ?? "";
  const publishTargets = [
    publishToMobile ? "Mobile" : null,
    publishToWebsite ? "Website" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="fixed bottom-0 left-0 right-0 top-[68px] z-20 flex items-center justify-center bg-transparent px-[16px] py-[20px]">
      <div
        className="absolute inset-0 bg-[rgba(52,64,84,0.6)] backdrop-blur-[8px]"
        onClick={onClose}
      ></div>
      <div className="relative z-10 flex max-h-[calc(100vh-40px)] w-full max-w-[960px] flex-col rounded-[8px] border-2 border-gray-50 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-[16px] border-b-2 border-gray-50 p-[16px] sm:p-[20px]">
          <h2 className="text-[18px] font-semibold text-gray-900 line-clamp-2">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-[8px] hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#6A8EB5]"
            aria-label="Close media preview"
          >
            <Icon
              iconName="Close"
              height="22px"
              width="22px"
              stroke="#344054"
            />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-gray-900 p-[12px] sm:p-[20px]">
          {mediaType.startsWith("image/") ? (
            <img
              src={media.dataUrl}
              alt={title}
              className="max-h-[calc(100vh-220px)] w-auto max-w-full object-contain"
            />
          ) : mediaType.startsWith("video/") ? (
            <video
              key={media.dataUrl}
              src={media.dataUrl}
              className="max-h-[calc(100vh-220px)] w-full max-w-full rounded-[4px] bg-black"
              controls
            />
          ) : (
            <div className="flex min-h-[260px] flex-col items-center justify-center text-center text-white">
              <Icon
                iconName="Image"
                height="64px"
                width="64px"
                fill="#FFFFFF"
                opacity="0.5"
                className="mb-[12px]"
              />
              <p className="text-[14px] font-medium">
                This media type cannot be previewed.
              </p>
            </div>
          )}
        </div>
        <div className="border-t-2 border-gray-50 p-[16px] sm:p-[20px]">
          <p className="max-h-[110px] overflow-y-auto pr-[4px] text-[14px] text-gray-700">
            {description}
          </p>
          <p className="mt-[10px] text-[12px] font-medium text-gray-500">
            Publish: {publishTargets || "Not selected"}
          </p>
        </div>
      </div>
    </div>
  );
};



