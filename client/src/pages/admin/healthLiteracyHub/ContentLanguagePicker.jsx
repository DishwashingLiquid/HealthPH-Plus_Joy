/* eslint-disable react/prop-types */
import { useState } from "react";
import Icon from "../../../components/Icon";
import {
  getLimitedContentTags,
  getTagOptionsWithSelectedTags,
} from "./shared";

const ContentLanguagePicker = ({ selectedTags = [], onTagsChange }) => {
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
      <label className="mb-[8px] block text-[14px] font-medium text-gray-800">
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
                <Icon
                  iconName="Close"
                  height="12px"
                  width="12px"
                  stroke="#175CD3"
                />
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
                      ? "bg-[#32418C] text-white hover:bg-[#2A3776]"
                      : "bg-white text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                  }`}
                >
                  <span
                    className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[4px] border ${
                      isSelected
                        ? "border-[#32418C] bg-[#32418C]"
                        : "border-[#D0D5DD] bg-white"
                    }`}
                  >
                    {isSelected && (
                      <Icon
                        iconName="Check"
                        height="14px"
                        width="14px"
                        fill="#FFF"
                      />
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

export default ContentLanguagePicker;
