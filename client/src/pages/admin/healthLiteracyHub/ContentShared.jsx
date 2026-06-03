/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import Icon from "../../../components/Icon";
import {
  FACT_CHECK_CLAIM_STATUS_OPTIONS,
  FACT_CHECK_VERIFIED_BY_OPTIONS,
  getContentMediaSource,
  getContentDownloadCount,
  getContentLikeCount,
  getContentViewCount,
  getLimitedContentTags,
  getTagOptionsWithSelectedTags,
  formatNumber,
  formatVideoDuration,
} from "./shared";

const LanguagesPicker = ({ selectedTags = [], onTagsChange }) => {
  const [searchValue, setSearchValue] = useState("");
  const selectedTagList = getLimitedContentTags(selectedTags);
  const selectedTagKeys = new Set(
    selectedTagList.map((tag) => tag.toLowerCase())
  );
  const searchText = searchValue.trim();
  const searchKey = searchText.toLowerCase();
  const tagOptions = getTagOptionsWithSelectedTags();
  const filteredOptions = tagOptions.filter((option) =>
    option.label.toLowerCase().includes(searchKey)
  );

  const updateTags = (nextTags) => {
    onTagsChange(getLimitedContentTags(nextTags));
  };

  const toggleTag = (tag) => {
    const isSelected = selectedTagKeys.has(tag.toLowerCase());

    if (isSelected) {
      updateTags(selectedTagList.filter((selectedTag) => selectedTag !== tag));
      return;
    }

    if (selectedTagList.length >= tagOptions.length) return;

    updateTags([...selectedTagList, tag]);
  };

  return (
    <div>
      <label className="block text-[14px] font-medium text-gray-800 mb-[8px]">
        Languages *
      </label>
      <div className="rounded-[8px] border border-[#E5E5E5] bg-white p-[10px] focus-within:border-[#6A8EB5]">
        <div className="flex flex-wrap gap-[6px]">
          {selectedTagList.map((tag) => (
            <span
              key={tag}
              className="inline-flex min-h-[28px] items-center gap-[6px] rounded-[6px] bg-[#EAF3FF] px-[8px] text-[12px] font-semibold text-[#175CD3]"
            >
              {tag}
              <button
                type="button"
                onClick={() => toggleTag(tag)}
                className="flex h-[18px] w-[18px] items-center justify-center rounded-full hover:bg-[#D6E8FF] focus:outline-none focus:ring-2 focus:ring-[#6A8EB5]/30"
                aria-label={`Remove ${tag}`}
              >
                <Icon iconName="Close" height="12px" width="12px" stroke="#175CD3" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-[8px] flex items-center gap-[8px]">
          <Icon iconName="Search" height="18px" width="18px" stroke="#667085" />
          <input
            type="text"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
              }
            }}
            placeholder={
              selectedTagList.length >= tagOptions.length
                ? "All languages selected"
                : "Search languages"
            }
            disabled={selectedTagList.length >= tagOptions.length}
            className="min-h-[34px] flex-1 text-[14px] text-gray-800 placeholder:text-gray-400 focus:outline-none disabled:bg-white"
          />
        </div>
      </div>
      <div className="mt-[8px] flex flex-col gap-[8px] rounded-[8px] border border-[#E5E5E5] bg-[#F8FAFC] p-[8px]">
        <div className="max-h-[190px] overflow-y-auto pr-[4px]">
          <div className="grid grid-cols-1 gap-[6px] sm:grid-cols-2">
            {filteredOptions.map((option) => {
              const isSelected = selectedTagKeys.has(option.value.toLowerCase());
              const isDisabled =
                !isSelected && selectedTagList.length >= tagOptions.length;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleTag(option.value)}
                  disabled={isDisabled}
                  className={`flex min-h-[38px] items-center gap-[8px] rounded-[6px] px-[10px] py-[7px] text-left text-[13px] font-medium transition focus:outline-none focus:ring-2 focus:ring-[#6A8EB5]/30 ${
                    isSelected
                      ? "bg-[#EAF3FF] text-[#175CD3]"
                      : "bg-white text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                  }`}
                >
                  <span
                    className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[4px] border ${
                      isSelected
                        ? "border-[#175CD3] bg-[#175CD3]"
                        : "border-[#D0D5DD] bg-white"
                    }`}
                  >
                    {isSelected && (
                      <Icon iconName="Check" height="14px" width="14px" fill="#FFF" />
                    )}
                  </span>
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-[12px] font-medium text-gray-500">
          {selectedTagList.length}/{tagOptions.length} selected
        </p>
      </div>
    </div>
  );
};

export const ContentFormBody = ({
  formData,
  uploadRule,
  mode,
  contentTypeLabel,
  onFormChange,
  onTagsChange,
  onMediaChange,
  onMediaDrop,
  onRemoveMedia,
}) => {
  const uploadInputId = `health-literacy-media-upload-${mode}`;
  const hasMediaPreview = Boolean(formData.mediaPreview) && !formData.removeMedia;
  const acceptsMedia = contentTypeLabel !== "Articles";
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
      {contentTypeLabel !== "Infographics" && (
        <div>
          <LanguagesPicker
            selectedTags={formData.tags}
            onTagsChange={onTagsChange}
          />
        </div>
      )}
      {acceptsMedia && (
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
      )}
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
  onShareClick,
  onDownloadClick,
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
    <div
      className={
        contentType === "Articles"
          ? "flex w-full flex-col gap-[16px]"
          : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[20px]"
      }
    >
      {content.map((item) => (
        <ContentCard
          key={`${item.source ?? "content"}-${item.id}`}
          item={item}
          onMediaClick={onMediaClick}
          onEditClick={onEditClick}
          onShareClick={onShareClick}
          onDownloadClick={onDownloadClick}
        />
      ))}
    </div>
  );
};

const ContentCard = ({
  item,
  onMediaClick,
  onEditClick,
  onShareClick,
  onDownloadClick,
}) => {
  const media = item.media;
  const mediaType = media?.contentType ?? "";
  const mediaSource = getContentMediaSource(media);
  const hasPreviewMedia = Boolean(mediaSource);
  const isArticle = item.contentType === "Articles";
  const isVideo = item.contentType === "Videos";
  const isInfographic = item.contentType === "Infographics";
  const canEdit = item.source === "api" && (isArticle || isVideo || isInfographic);
  const MediaPreviewWrapper = hasPreviewMedia ? "button" : "div";

  if (isArticle) {
    return (
      <ArticleContentCard
        item={item}
        canEdit={canEdit}
        onEditClick={onEditClick}
        onShareClick={onShareClick}
      />
    );
  }

  if (isVideo) {
    return (
      <VideoContentCard
        item={item}
        mediaType={mediaType}
        mediaSource={mediaSource}
        hasPreviewMedia={hasPreviewMedia}
        canEdit={canEdit}
        onMediaClick={onMediaClick}
        onEditClick={onEditClick}
      />
    );
  }

  if (isInfographic) {
    return (
      <InfographicContentCard
        item={item}
        canEdit={canEdit}
        mediaType={mediaType}
        mediaSource={mediaSource}
        hasPreviewMedia={hasPreviewMedia}
        onMediaClick={onMediaClick}
        onEditClick={onEditClick}
        onDownloadClick={onDownloadClick}
      />
    );
  }

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
        {mediaSource && mediaType.startsWith("image/") ? (
          <img
            src={mediaSource}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : mediaSource && mediaType.startsWith("video/") ? (
          <video
            src={mediaSource}
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

        {!isInfographic && (
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
        )}

        <div className="mb-[12px] flex flex-wrap items-center justify-between gap-[8px] rounded-[8px] bg-[#F8FAFC] px-[10px] py-[8px] text-[12px] font-medium text-gray-600">
          {(isArticle || isVideo) && (
            <span>Likes: {formatNumber(getContentLikeCount(item))}</span>
          )}
          {isInfographic && (
            <span>Downloads: {formatNumber(getContentDownloadCount(item))}</span>
          )}
          <div className="ml-auto flex flex-wrap gap-[6px]">
            {isArticle && (
              <button
                type="button"
                onClick={() => onShareClick(item)}
                className="inline-flex min-h-[30px] items-center justify-center gap-[6px] rounded-[6px] border border-[#D0D5DD] bg-white px-[9px] text-[12px] font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6A8EB5]"
              >
                <Icon iconName="ArrowUpRight" height="14px" width="14px" stroke="#344054" />
                <span>Share</span>
              </button>
            )}
            {isInfographic && (
              <button
                type="button"
                onClick={() => onDownloadClick(item)}
                disabled={!hasPreviewMedia}
                className="inline-flex min-h-[30px] items-center justify-center gap-[6px] rounded-[6px] border border-[#D0D5DD] bg-white px-[9px] text-[12px] font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6A8EB5] disabled:cursor-not-allowed disabled:text-gray-400"
              >
                <Icon iconName="Download" height="14px" width="14px" fill="#344054" />
                <span>Download</span>
              </button>
            )}
          </div>
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

const InfographicContentCard = ({
  item,
  canEdit,
  mediaType,
  mediaSource,
  hasPreviewMedia,
  onMediaClick,
  onEditClick,
  onDownloadClick,
}) => {
  const openPreview = () => onMediaClick(item);

  const handleKeyDown = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    openPreview();
  };

  const handleDownloadClick = (event) => {
    event.stopPropagation();
    onDownloadClick(item);
  };

  const handleEditClick = (event) => {
    event.stopPropagation();
    onEditClick(item);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openPreview}
      onKeyDown={handleKeyDown}
      className="grid h-[360px] w-full cursor-pointer grid-rows-[2fr_1fr] overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white text-left transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#6A8EB5] focus:ring-offset-2"
      aria-label={`Open ${item.title} infographic preview`}
    >
      <div className="flex min-h-0 w-full items-center justify-center overflow-hidden bg-[#F8FAFC] p-[8px]">
        {mediaSource && mediaType.startsWith("image/") ? (
          <img
            src={mediaSource}
            alt={item.title}
            className="h-full w-full object-contain"
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
      </div>

      <div className="flex min-h-0 flex-col justify-between overflow-hidden p-[14px]">
        <h3 className="line-clamp-2 text-left text-[16px] font-semibold leading-[22px] text-gray-800">
          {item.title}
        </h3>

        <div className="mt-[10px] flex min-h-[32px] items-center justify-between gap-[10px]">
          <span className="min-w-0 text-left text-[12px] font-semibold text-gray-600">
            Downloads: {formatNumber(getContentDownloadCount(item))}
          </span>
          <div className="flex flex-shrink-0 items-center justify-end gap-[6px]">
            <button
              type="button"
              onClick={handleDownloadClick}
              disabled={!hasPreviewMedia}
              className="inline-flex min-h-[32px] items-center justify-center gap-[6px] rounded-[6px] border border-[#D0D5DD] bg-white px-[9px] text-[12px] font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6A8EB5] disabled:cursor-not-allowed disabled:text-gray-400"
            >
              <Icon iconName="Download" height="14px" width="14px" fill="#344054" />
              <span>Download</span>
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={handleEditClick}
                className="inline-flex min-h-[32px] items-center justify-center rounded-[6px] border border-[#D0D5DD] bg-white px-[10px] text-[12px] font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6A8EB5]"
              >
                Edit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const VideoContentCard = ({
  item,
  mediaType,
  mediaSource,
  hasPreviewMedia,
  canEdit,
  onMediaClick,
  onEditClick,
}) => {
  const tags = item.tags ?? [];
  const [detectedDuration, setDetectedDuration] = useState("");
  const displayDuration = item.duration || detectedDuration;
  const openPreview = () => {
    if (!hasPreviewMedia) return;

    onMediaClick(item);
  };

  const handleKeyDown = (event) => {
    if (!hasPreviewMedia || (event.key !== "Enter" && event.key !== " ")) return;

    event.preventDefault();
    openPreview();
  };

  const handleEditClick = (event) => {
    event.stopPropagation();
    onEditClick(item);
  };

  useEffect(() => {
    if (item.duration || !mediaSource || !mediaType.startsWith("video/")) {
      setDetectedDuration("");
      return undefined;
    }

    const video = document.createElement("video");

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      setDetectedDuration(formatVideoDuration(video.duration));
    };
    video.onerror = () => {
      setDetectedDuration("");
    };
    video.src = mediaSource;

    return () => {
      video.removeAttribute("src");
      video.load();
    };
  }, [item.duration, mediaSource, mediaType]);

  return (
    <div
      role={hasPreviewMedia ? "button" : undefined}
      tabIndex={hasPreviewMedia ? 0 : undefined}
      onClick={openPreview}
      onKeyDown={handleKeyDown}
      className={`grid h-[440px] w-full grid-rows-[240px_1fr] overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white text-left transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#6A8EB5] focus:ring-offset-2 ${
        hasPreviewMedia ? "cursor-pointer" : "cursor-default opacity-80"
      }`}
      aria-label={hasPreviewMedia ? `Open ${item.title} video preview` : undefined}
    >
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#6A8EB5] to-[#78C6B2]">
        {mediaSource && mediaType.startsWith("video/") ? (
          <video
            src={mediaSource}
            className="h-full w-full object-cover"
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
      </div>

      <div className="flex min-h-0 flex-col p-[14px]">
        <h3 className="line-clamp-2 text-left text-[16px] font-semibold leading-[22px] text-gray-800">
          {item.title}
        </h3>

        <div className="mt-[8px] flex items-center justify-between gap-[12px] text-[12px] font-semibold text-gray-600">
          <span className="min-w-0 truncate text-left">
            {displayDuration ? `Duration: ${displayDuration}` : "Duration: --"}
          </span>
          <span className="flex-shrink-0 text-right">
            Views: {formatNumber(getContentViewCount(item))}
          </span>
        </div>

        {tags.length > 0 && (
          <div className="mt-[10px] flex flex-wrap items-center justify-start gap-[6px] overflow-hidden">
            {tags.map((tag, index) => (
              <span
                key={`${tag}-${index}`}
                className="inline-flex min-h-[24px] items-center rounded-[6px] bg-[#16A34A] px-[8px] text-[11px] font-semibold text-white"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-[10px] flex min-h-[32px] items-end justify-end">
          {canEdit && (
            <button
              type="button"
              onClick={handleEditClick}
              className="inline-flex min-h-[32px] items-center justify-center rounded-[6px] border border-[#D0D5DD] bg-white px-[10px] text-[12px] font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6A8EB5]"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const ArticleContentCard = ({ item, canEdit, onEditClick, onShareClick }) => {
  const subtitle = String(item.description ?? "").slice(0, 75);
  const tags = item.tags ?? [];

  return (
    <div className="w-full rounded-[8px] border border-[#E5E5E5] bg-white p-[18px] text-left transition-shadow hover:shadow-sm">
      <h3 className="text-left text-[18px] font-bold leading-[26px] text-gray-900">
        {item.title}
      </h3>
      <p className="mt-[6px] text-left text-[14px] leading-[20px] text-gray-600">
        {subtitle}
      </p>

      {tags.length > 0 && (
        <div className="mt-[12px] flex flex-wrap items-center justify-start gap-[8px]">
          {tags.map((tag, index) => (
            <span
              key={`${tag}-${index}`}
              className="inline-flex min-h-[28px] items-center rounded-[6px] bg-[#16A34A] px-[10px] text-[12px] font-semibold text-white"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-[14px] flex flex-col gap-[10px] border-t border-[#E5E5E5] pt-[12px] sm:flex-row sm:items-center sm:justify-between">
        <span className="text-left text-[13px] font-semibold text-gray-700">
          Views: {formatNumber(getContentViewCount(item))}
        </span>
        <div className="flex flex-wrap items-center gap-[8px] sm:justify-end">
          <button
            type="button"
            onClick={() => onShareClick(item)}
            className="inline-flex min-h-[34px] items-center justify-center gap-[6px] rounded-[6px] border border-[#D0D5DD] bg-white px-[10px] text-[12px] font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6A8EB5]"
          >
            <Icon iconName="ArrowUpRight" height="14px" width="14px" stroke="#344054" />
            <span>Share</span>
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => onEditClick(item)}
              className="inline-flex min-h-[34px] items-center justify-center rounded-[6px] border border-[#D0D5DD] bg-white px-[12px] text-[12px] font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6A8EB5]"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const MediaPreviewModal = ({
  item,
  title,
  description,
  media,
  contentType,
  tags = [],
  viewCount,
  uploadDate,
  publishToMobile,
  publishToWebsite,
  canEdit = false,
  onDownloadClick,
  onEditClick,
  onClose,
}) => {
  const mediaType = media?.contentType ?? "";
  const mediaSource = getContentMediaSource(media);
  const isVideo = mediaType.startsWith("video/");
  const isInfographic = contentType === "Infographics";
  const publishTargets = [
    publishToMobile ? "Mobile" : null,
    publishToWebsite ? "Website" : null,
  ]
    .filter(Boolean)
    .join(", ");
  const publishStatus = publishTargets || "Not selected";

  if (isInfographic) {
    return (
      <div className="fixed bottom-0 left-0 right-0 top-[68px] z-20 flex items-center justify-center bg-transparent px-[16px] py-[20px]">
        <div
          className="absolute inset-0 bg-[rgba(52,64,84,0.6)] backdrop-blur-[8px]"
          onClick={onClose}
        ></div>
        <div className="relative z-10 flex max-h-[calc(100vh-40px)] w-full max-w-[960px] flex-col rounded-[8px] border-2 border-gray-50 bg-white shadow-2xl">
          <div className="flex flex-col gap-[12px] border-b-2 border-gray-50 p-[16px] sm:flex-row sm:items-start sm:justify-between sm:p-[20px]">
            <h2 className="line-clamp-2 min-w-0 text-left text-[18px] font-semibold text-gray-900">
              {title}
            </h2>
            <div className="flex flex-shrink-0 flex-wrap items-center justify-start gap-[8px] sm:justify-end">
              <button
                type="button"
                onClick={() => onDownloadClick?.(item)}
                disabled={!mediaSource}
                className="inline-flex min-h-[34px] items-center justify-center gap-[6px] rounded-[6px] border border-[#D0D5DD] bg-white px-[10px] text-[12px] font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6A8EB5] disabled:cursor-not-allowed disabled:text-gray-400"
              >
                <Icon iconName="Download" height="14px" width="14px" fill="#344054" />
                <span>Download</span>
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onEditClick?.(item)}
                  className="inline-flex min-h-[34px] items-center justify-center rounded-[6px] border border-[#D0D5DD] bg-white px-[12px] text-[12px] font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6A8EB5]"
                >
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-[8px] hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#6A8EB5]"
                aria-label="Close infographic preview"
              >
                <Icon
                  iconName="Close"
                  height="22px"
                  width="22px"
                  stroke="#344054"
                />
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-gray-900 p-[12px] sm:p-[20px]">
            {mediaSource && mediaType.startsWith("image/") ? (
              <img
                src={mediaSource}
                alt={title}
                className="max-h-[calc(100vh-300px)] w-auto max-w-full object-contain"
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
                  This infographic cannot be previewed.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col items-start gap-[8px] border-t-2 border-gray-50 p-[16px] text-left sm:p-[20px]">
            <p className="max-h-[110px] overflow-y-auto pr-[4px] text-[14px] text-gray-700">
              {description}
            </p>
            <p className="text-[12px] font-medium text-gray-500">
              Date Created: {uploadDate || "--"}
            </p>
            <p className="text-[12px] font-medium text-gray-500">
              Publish Status: {publishStatus}
            </p>
          </div>
        </div>
      </div>
    );
  }

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
          <div className="flex flex-shrink-0 items-center justify-end gap-[8px]">
            {canEdit && (
              <button
                type="button"
                onClick={() => onEditClick?.(item)}
                className="inline-flex min-h-[34px] items-center justify-center rounded-[6px] border border-[#D0D5DD] bg-white px-[12px] text-[12px] font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6A8EB5]"
              >
                Edit
              </button>
            )}
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
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-gray-900 p-[12px] sm:p-[20px]">
          {mediaSource && mediaType.startsWith("image/") ? (
            <img
              src={mediaSource}
              alt={title}
              className="max-h-[calc(100vh-220px)] w-auto max-w-full object-contain"
            />
          ) : mediaSource && mediaType.startsWith("video/") ? (
            <video
              key={mediaSource}
              src={mediaSource}
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
          {isVideo ? (
            <div className="mt-[14px] flex flex-col gap-[12px] sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col items-start gap-[10px]">
                <p className="text-left text-[12px] font-medium text-gray-500">
                  Publish: {publishStatus}
                </p>
                {tags.length > 0 && (
                  <div className="flex flex-wrap items-center justify-start gap-[6px]">
                    {tags.map((tag, index) => (
                      <span
                        key={`${tag}-${index}`}
                        className="inline-flex min-h-[26px] items-center rounded-[6px] bg-[#16A34A] px-[9px] text-[11px] font-semibold text-white"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-start gap-[6px] text-[12px] font-semibold text-gray-600 sm:items-end">
                <span>Views: {formatNumber(viewCount)}</span>
                {uploadDate && <span>Uploaded: {uploadDate}</span>}
              </div>
            </div>
          ) : (
            <p className="mt-[10px] text-[12px] font-medium text-gray-500">
              Publish: {publishStatus}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};



