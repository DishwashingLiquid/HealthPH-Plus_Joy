/* eslint-disable react/prop-types */
import VideoCardPreview from "../../../../components/health-literacy/VideoCardPreview";
import { attachmentKind, GENERIC_ARTICLE_THUMBNAIL } from "../../../../utils/healthLiteracyMedia";
import Icon from "../../../../components/Icon";
import {
  getContentDownloadCount,
  getContentLikeCount,
  getContentMediaSource,
  getContentViewCount,
  formatNumber,
} from "../shared";

export const ContentGrid = ({
  content,
  contentType,
  isLoading,
  onMediaClick,
  onEditClick,
  onShareClick,
  onDownloadClick,
}) => {
  if (isLoading && (contentType !== "Videos" || content.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[12px] border border-[#E5E5E5] bg-white p-[40px] text-center">
        <p className="text-[16px] font-medium text-gray-600">
          Loading {contentType.toLowerCase()}...
        </p>
      </div>
    );
  }

  if (content.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[12px] border border-[#E5E5E5] bg-white p-[40px] text-center">
        <Icon
          iconName="Search"
          height="48px"
          width="48px"
          fill="#D0D5DD"
          className="mb-[16px]"
        />
        <p className="mb-[8px] text-[16px] font-medium text-gray-600">
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
          ? "flex w-full flex-col gap-[10px]"
          : "grid grid-cols-1 gap-[10px] md:grid-cols-2 lg:grid-cols-3"
      }
    >
      {content.map((item) => (
        <ContentCard
          key={`${item.contentOrigin ?? "content"}-${item.id}`}
          item={item}
          isLoading={isLoading && contentType === "Videos"}
          onMediaClick={onMediaClick}
          onEditClick={onEditClick}
          onShareClick={onShareClick}
          onDownloadClick={onDownloadClick}
        />
      ))}
    </div>
  );
};

const VideoContentCardLoading = () => (
  <div
    className="flex h-[440px] w-full items-center justify-center overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-[#E4E7EB]"
    role="status"
    aria-label="Loading video content"
  >
    <Icon iconName="Video" height="48px" width="48px" stroke="#6B7280" />
  </div>
);

const ContentCard = ({
  isLoading,
  item,
  onMediaClick,
  onEditClick,
  onShareClick,
  onDownloadClick,
}) => {
  const media = item.media;
  const mediaType = media?.contentType ?? "";
  const mediaSource = getContentMediaSource(media) || (item.contentType === "Videos" ? item.mediaUrl : item.imageUrl) || "";
  const hasPreviewMedia = Boolean(mediaSource);
  const isArticle = item.contentType === "Articles";
  const isVideo = item.contentType === "Videos";
  const isInfographic = item.contentType === "Infographics";
  const canEdit =
    item.contentOrigin === "api" && (isArticle || isVideo || isInfographic);
  const MediaPreviewWrapper = hasPreviewMedia ? "button" : "div";

  if (isArticle) {
    return (
      <ArticleContentCard
        item={item}
        canEdit={canEdit}
        onEditClick={onEditClick}
        onShareClick={onShareClick}
        onMediaClick={onMediaClick}
      />
    );
  }

  if (isVideo) {
    return (
      <VideoContentCard
        isLoading={isLoading}
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
    <div className="overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white transition-shadow hover:shadow-lg">
      <MediaPreviewWrapper
        type={hasPreviewMedia ? "button" : undefined}
        onClick={hasPreviewMedia ? () => onMediaClick(item) : undefined}
        className={`flex h-[180px] w-full items-center justify-center bg-gradient-to-br from-[#6A8EB5] to-[#78C6B2] ${
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
            className="h-full w-full object-cover"
          />
        ) : mediaSource && mediaType.startsWith("video/") ? (
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
      </MediaPreviewWrapper>

      <div className="p-[16px]">
        <div className="mb-[8px] flex items-start justify-between gap-[12px]">
          <h3 className="line-clamp-2 text-[16px] font-semibold text-gray-800">
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
        <p className="mb-[12px] h-[58px] overflow-y-auto pr-[4px] text-[13px] text-gray-600">
          {item.description}
        </p>

        {!isInfographic && (
          <div className="mb-[12px] flex flex-wrap gap-[6px]">
            {(item.tags ?? []).slice(0, 2).map((tag, index) => (
              <span
                key={index}
                className="inline-block rounded-[4px] bg-[#F5F5F5] px-[8px] py-[4px] text-[11px] font-medium text-gray-600"
              >
                {tag}
              </span>
            ))}
            {(item.tags ?? []).length > 2 && (
              <span className="inline-block rounded-[4px] bg-[#F5F5F5] px-[8px] py-[4px] text-[11px] font-medium text-gray-600">
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
                <Icon
                  iconName="ArrowUpRight"
                  height="14px"
                  width="14px"
                  stroke="#344054"
                />
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
                <Icon
                  iconName="Download"
                  height="14px"
                  width="14px"
                  fill="#344054"
                />
                <span>Download</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-[4px] text-[12px] text-gray-500">
          {item.date && <span>Date: {item.date}</span>}
          {item.duration && <span>Duration: {item.duration}</span>}
          {item.contentOrigin === "api" && (
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

const InfographicContentCard = ({ item, canEdit, mediaType, mediaSource, hasPreviewMedia, onMediaClick, onEditClick, onDownloadClick }) => {
  const open = () => onMediaClick(item);
  return <div className="overflow-hidden rounded-[12px] border border-gray-100 bg-white text-left">
    <button type="button" onClick={open} aria-label={`View Infographic: ${item.title}`} className="block h-[240px] w-full bg-gray-10 p-2">
      {attachmentKind(mediaSource, mediaType) === "image" ? <img src={mediaSource} alt={item.title} className="h-full w-full object-contain" />
        : <span className="text-primary-800">Open infographic details</span>}
    </button>
    <div className="p-[16px]">
      <h3 className="text-[18px] font-semibold text-primary-800">{item.title}</h3>
      <p className="hl-meta">Downloads: {formatNumber(getContentDownloadCount(item))}</p>
      <div className="hl-actions">
        <button type="button" className="hl-button" onClick={open}>View Infographic</button>
        <button type="button" className="hl-button hl-secondary" disabled={!hasPreviewMedia} onClick={() => onDownloadClick(item)}>Download</button>
        {canEdit && <button type="button" className="hl-button hl-secondary" onClick={() => onEditClick(item)}>Edit</button>}
      </div>
    </div>
  </div>;
};

const VideoContentCard = ({ isLoading, item, mediaSource, canEdit, onMediaClick, onEditClick }) => {
  if (isLoading) return <VideoContentCardLoading />;
  return <div className="overflow-hidden rounded-[12px] border border-gray-100 bg-white text-left">
    <div className="h-[240px]"><VideoCardPreview src={mediaSource || item.mediaUrl} mime={item.media?.contentType}
      poster={getContentMediaSource(item.thumbnail) || item.imageUrl} title={item.title} onOpen={() => onMediaClick(item)} /></div>
    <div className="p-[16px]">
      <h3 className="text-[18px] font-semibold text-primary-800">{item.title}</h3>
      <p className="hl-meta">{item.duration ? `Duration: ${item.duration} · ` : ""}Views: {formatNumber(getContentViewCount(item))}</p>
      <div className="hl-actions"><button type="button" className="hl-button" onClick={() => onMediaClick(item)}>Watch Video</button>
        {canEdit && <button type="button" className="hl-button hl-secondary" onClick={() => onEditClick(item)}>Edit</button>}</div>
    </div>
  </div>;
};

const ArticleContentCard = ({ item, canEdit, onEditClick, onShareClick, onMediaClick }) => {
  const subtitle = String(item.description ?? "").slice(0, 75);
  const tags = item.tags ?? [];
  const galleryImage = item.galleryImages?.[0];
  const mainSource = getContentMediaSource(item.media) || item.imageUrl;
  const imageSource = getContentMediaSource(galleryImage?.media) ||
    (attachmentKind(mainSource, item.media?.contentType || "") === "image" ? mainSource : GENERIC_ARTICLE_THUMBNAIL);

  return (
    <div className="w-full rounded-[8px] border border-[#E5E5E5] bg-white p-[18px] text-left transition-shadow hover:shadow-sm">
      <button type="button" aria-label={`Read article: ${item.title}`} onClick={() => onMediaClick(item)} className="mb-4 block w-full">
        <img className="max-h-[220px] w-full rounded-lg object-contain" alt={item.title}
          src={imageSource} />
      </button>
      <button type="button" className="hl-text-button" onClick={() => onMediaClick(item)}>Read More</button>
      <h3 className="text-left text-[18px] font-semibold leading-[26px] text-gray-800">
        {item.title}
      </h3>
      <p
        className="mt-[6px] text-left text-[14px] leading-[20px] text-gray-500"
      >
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
            <Icon
              iconName="ArrowUpRight"
              height="14px"
              width="14px"
              stroke="#344054"
            />
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
