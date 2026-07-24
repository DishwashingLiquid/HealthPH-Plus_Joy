/* eslint-disable react/prop-types */
import Icon from "../../../components/Icon";
import { formatNumber, getContentMediaSource } from "./shared";

const ContentMediaPreviewBody = ({
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
      <div className="flex max-h-[calc(100vh-230px)] flex-col overflow-y-auto">
        <div className="flex flex-wrap items-center justify-end gap-[8px] border-b-2 border-gray-50 p-[16px] sm:p-[20px]">
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
        </div>

        <div className="flex min-h-[280px] items-center justify-center overflow-auto bg-gray-900 p-[12px] sm:p-[20px]">
          {mediaSource && mediaType.startsWith("image/") ? (
            <img
              src={mediaSource}
              alt={title}
              className="max-h-[calc(100vh-360px)] w-auto max-w-full object-contain"
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
    );
  }

  return (
    <div className="flex max-h-[calc(100vh-230px)] flex-col overflow-y-auto">
      {canEdit && (
        <div className="flex items-center justify-end border-b-2 border-gray-50 p-[16px] sm:p-[20px]">
          <button
            type="button"
            onClick={() => onEditClick?.(item)}
            className="inline-flex min-h-[34px] items-center justify-center rounded-[6px] border border-[#D0D5DD] bg-white px-[12px] text-[12px] font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6A8EB5]"
          >
            Edit
          </button>
        </div>
      )}

      <div className="flex min-h-[280px] items-center justify-center overflow-auto bg-gray-900 p-[12px] sm:p-[20px]">
        {mediaSource && mediaType.startsWith("image/") ? (
          <img
            src={mediaSource}
            alt={title}
            className="max-h-[calc(100vh-320px)] w-auto max-w-full object-contain"
          />
        ) : mediaSource && mediaType.startsWith("video/") ? (
          <video
            key={mediaSource}
            src={mediaSource}
            className="max-h-[calc(100vh-320px)] w-full max-w-full rounded-[4px] bg-black"
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
  );
};

export default ContentMediaPreviewBody;
