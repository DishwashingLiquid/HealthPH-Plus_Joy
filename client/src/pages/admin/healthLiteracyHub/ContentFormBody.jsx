/* eslint-disable react/prop-types */
import Icon from "../../../components/Icon";
import ContentLanguagePicker from "./ContentLanguagePicker";
import { getContentFormMediaPreviewState } from "./contentMediaPreviewHelpers";
import {
  FACT_CHECK_CLAIM_STATUS_OPTIONS,
  FACT_CHECK_VERIFIED_BY_OPTIONS,
} from "./shared";

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
  onDelete,
  onDeleteDisabled = false,
}) => {
  const uploadInputId = `health-literacy-media-upload-${mode}`;
  const acceptsMedia = contentTypeLabel !== "Articles";
  const { hasMediaPreview, previewType, previewName } =
    getContentFormMediaPreviewState(formData);

  return (
    <div className="flex max-h-[60vh] flex-col gap-[16px] overflow-y-auto p-[20px]">
      <div>
        <label className="mb-[8px] block text-[14px] font-medium text-gray-800">
          Title *
        </label>
        <input
          type="text"
          name="title"
          value={formData.title}
          onChange={onFormChange}
          placeholder="Enter content title"
          className="w-full rounded-[8px] border border-[#E5E5E5] px-[12px] py-[10px] text-[14px] focus:border-[#6A8EB5] focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-[8px] block text-[14px] font-medium text-gray-800">
          Description *
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={onFormChange}
          placeholder="Enter content description"
          className="w-full max-h-[220px] rounded-[8px] border border-[#E5E5E5] px-[12px] py-[10px] text-[14px] focus:border-[#6A8EB5] focus:outline-none"
          rows="5"
        />
      </div>
      {contentTypeLabel !== "Infographics" && (
        <div>
          <ContentLanguagePicker
            selectedTags={formData.tags}
            onTagsChange={onTagsChange}
          />
        </div>
      )}
      {acceptsMedia && (
        <div>
          <label className="mb-[8px] block text-[14px] font-medium text-gray-800">
            {uploadRule.label}
          </label>
          <label
            htmlFor={uploadInputId}
            className="block cursor-pointer rounded-[8px] border-2 border-dashed border-[#E5E5E5] p-[20px] text-center transition-colors hover:bg-[#F9F9F9]"
            onDragOver={(event) => event.preventDefault()}
            onDrop={onMediaDrop}
          >
            {hasMediaPreview ? (
              <div className="flex flex-col items-center">
                {previewType.startsWith("video/") ? (
                  <video
                    src={formData.mediaPreview}
                    className="mb-[8px] h-[100px] w-[140px] rounded-[4px] object-cover"
                    controls
                  />
                ) : (
                  <img
                    src={formData.mediaPreview}
                    alt="Preview"
                    className="mb-[8px] h-[100px] w-[100px] rounded-[4px] object-cover"
                  />
                )}
                {previewName && (
                  <p className="break-all text-[13px] font-medium text-gray-600">
                    {previewName}
                  </p>
                )}
                <p className="mt-[4px] text-[12px] text-gray-500">Click to change</p>
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
                <p className="mt-[4px] text-[12px] text-gray-500">
                  or click to browse
                </p>
                <p className="mt-[8px] text-[11px] text-gray-400">
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
              className="mt-[8px] text-[12px] font-medium text-red-500 hover:text-red-700"
            >
              Remove file
            </button>
          )}
        </div>
      )}
      <div className="border-t border-[#E5E5E5] pt-[16px]">
        <p className="mb-[8px] text-[14px] font-medium text-gray-800">
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
              <label className="mb-[8px] block text-[14px] font-medium text-gray-800">
                Claim *
              </label>
              <textarea
                name="claim"
                value={formData.claim}
                onChange={onFormChange}
                placeholder="Enter the fact-check claim"
                className="w-full max-h-[160px] rounded-[8px] border border-[#E5E5E5] px-[12px] py-[10px] text-[14px] focus:border-[#6A8EB5] focus:outline-none"
                rows="3"
              />
            </div>
            <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
              <div>
                <label className="mb-[8px] block text-[14px] font-medium text-gray-800">
                  Claim Status
                </label>
                <select
                  name="claimStatus"
                  value={formData.claimStatus}
                  onChange={onFormChange}
                  className="w-full rounded-[8px] border border-[#E5E5E5] px-[12px] py-[10px] text-[14px] focus:border-[#6A8EB5] focus:outline-none"
                >
                  {FACT_CHECK_CLAIM_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-[8px] block text-[14px] font-medium text-gray-800">
                  Verified by
                </label>
                <select
                  name="verifiedBy"
                  value={formData.verifiedBy}
                  onChange={onFormChange}
                  className="w-full rounded-[8px] border border-[#E5E5E5] px-[12px] py-[10px] text-[14px] focus:border-[#6A8EB5] focus:outline-none"
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
      {mode === "edit" && (
        <div className="border-t border-[#E5E5E5] pt-[16px]">
          <div className="flex flex-col gap-[12px] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[14px] font-medium text-gray-800">Delete Content</p>
              <p className="text-[12px] text-gray-500">
                Permanently remove this content item from the Health Literacy Hub.
              </p>
            </div>
            <button
              type="button"
              onClick={onDelete}
              disabled={onDeleteDisabled}
              className="inline-flex min-h-[36px] items-center justify-center rounded-[8px] border border-[#F04438] px-[14px] text-[13px] font-semibold text-[#B42318] hover:bg-[#FEF3F2] disabled:cursor-not-allowed disabled:border-[#FECACA] disabled:text-[#FCA5A5]"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
