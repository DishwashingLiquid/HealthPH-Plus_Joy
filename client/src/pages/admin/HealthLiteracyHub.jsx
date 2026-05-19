/* eslint-disable react/prop-types */
import { useState } from "react";
import { toast } from "react-toastify";
import Input from "../../components/Input";
import Icon from "../../components/Icon";
import Snackbar from "../../components/Snackbar";
import ModalWithBody from "../../components/admin/ModalWithBody";
import {
  useCreateHealthLiteracyContentMutation,
  useFetchHealthLiteracyContentQuery,
  useUpdateHealthLiteracyContentMutation,
} from "../../features/api/healthLiteracyHubSlice";

const TAB_CONTENT_TYPES = {
  Articles: "articles",
  Videos: "videos",
  Infographics: "infographics",
};

const UPLOAD_RULES = {
  Articles: {
    label: "Media Upload (Image/Video)",
    accept: "image/*,video/*",
    helperText: "JPG, PNG, GIF, WEBP, MP4, MOV",
    allowedTypes: ["image/", "video/"],
  },
  Infographics: {
    label: "Image Upload",
    accept: "image/*",
    helperText: "JPG, PNG, GIF, WEBP",
    allowedTypes: ["image/"],
  },
  Videos: {
    label: "Video Upload",
    accept: "video/*",
    helperText: "MP4, MOV, WEBM",
    allowedTypes: ["video/"],
  },
};

const INITIAL_FORM_DATA = {
  title: "",
  description: "",
  tags: "",
  media: null,
  mediaPreview: null,
  existingMedia: null,
  removeMedia: false,
  publishToMobile: false,
  publishToWebsite: false,
};

const MOCK_ARTICLES = [
  {
    id: 1,
    title: "Understanding Hypertension",
    description:
      "Learn about high blood pressure and its management strategies to maintain a healthy lifestyle",
    tags: ["health", "hypertension", "prevention"],
    thumbnail: "article1.jpg",
    date: "May 10, 2026",
  },
  {
    id: 2,
    title: "Diabetes Prevention Guide",
    description:
      "Comprehensive guide to preventing type 2 diabetes through diet, exercise, and lifestyle changes",
    tags: ["diabetes", "nutrition", "lifestyle"],
    thumbnail: "article2.jpg",
    date: "May 08, 2026",
  },
  {
    id: 3,
    title: "Mental Health Awareness",
    description:
      "Breaking stigma and understanding mental health conditions and available support resources",
    tags: ["mental-health", "awareness", "wellness"],
    thumbnail: "article3.jpg",
    date: "May 05, 2026",
  },
  {
    id: 4,
    title: "COVID-19 Prevention",
    description:
      "Latest guidelines on preventing COVID-19 transmission and staying protected",
    tags: ["covid", "prevention", "health"],
    thumbnail: "article4.jpg",
    date: "May 01, 2026",
  },
];

const MOCK_VIDEOS = [
  {
    id: 1,
    title: "Exercise Routines for Seniors",
    description:
      "Safe and effective exercises designed specifically for elderly individuals to improve mobility",
    tags: ["exercise", "seniors", "fitness"],
    thumbnail: "video1.jpg",
    duration: "12:35",
  },
  {
    id: 2,
    title: "Nutrition Basics",
    description:
      "Learn about balanced diet and nutrition fundamentals for optimal health and wellness",
    tags: ["nutrition", "diet", "health"],
    thumbnail: "video2.jpg",
    duration: "18:42",
  },
  {
    id: 3,
    title: "Stress Management Techniques",
    description:
      "Practical techniques to manage stress and improve mental well-being in daily life",
    tags: ["stress", "mental-health", "wellness"],
    thumbnail: "video3.jpg",
    duration: "15:20",
  },
];

const MOCK_INFOGRAPHICS = [
  {
    id: 1,
    title: "COVID-19 Prevention Steps",
    description:
      "Visual guide to preventing COVID-19 transmission through proper hygiene and safety measures",
    tags: ["covid", "prevention", "health"],
    thumbnail: "infographic1.jpg",
  },
  {
    id: 2,
    title: "Food Pyramid Guide",
    description:
      "Understanding the food pyramid and recommended serving sizes for each food group",
    tags: ["nutrition", "diet", "visual"],
    thumbnail: "infographic2.jpg",
  },
  {
    id: 3,
    title: "Signs of Stroke",
    description:
      "Recognize the early warning signs of stroke to seek immediate medical attention",
    tags: ["emergency", "health", "awareness"],
    thumbnail: "infographic3.jpg",
  },
];

const MOCK_CONTENT_BY_TAB = {
  Articles: MOCK_ARTICLES,
  Videos: MOCK_VIDEOS,
  Infographics: MOCK_INFOGRAPHICS,
};

const ILLUSTRATIONS = [
  {
    id: 1,
    title: "Educational Content",
    icon: "BookOpen",
    description: "Access curated health education materials",
  },
  {
    id: 2,
    title: "Multilingual Resources",
    icon: "Globe",
    description: "Content available in multiple languages",
  },
  {
    id: 3,
    title: "Community Q&A",
    icon: "MessageCircle",
    description: "Ask and answer health-related questions",
  },
];

const showToast = ({ color, iconName, message }) => {
  toast(
    <Snackbar
      iconName={iconName}
      size="snackbar-sm"
      color={color}
      message={message}
    />,
    {
      closeButton: ({ closeToast }) => (
        <Icon
          iconName="Close"
          className={`close-icon close-icon-sm close-${color}`}
          onClick={closeToast}
        />
      ),
    }
  );
};

const formatContentDate = (value) => {
  if (!value) return undefined;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

const normalizeApiContent = (content) => {
  return (content ?? []).map((item) => ({
    ...item,
    tags: Array.isArray(item.tags) ? item.tags : [],
    date: formatContentDate(item.createdAt),
    source: "api",
  }));
};

const isAllowedMediaType = (file, activeTab) => {
  if (!file) return true;

  return UPLOAD_RULES[activeTab].allowedTypes.some((allowedType) =>
    file.type.startsWith(allowedType)
  );
};

const getContentLabel = (activeTab) => activeTab.slice(0, -1);

const HealthLiteracyHub = () => {
  const [activeTab, setActiveTab] = useState("Articles");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMediaContent, setSelectedMediaContent] = useState(null);
  const [editingContent, setEditingContent] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  const contentType = TAB_CONTENT_TYPES[activeTab];
  const shouldFetchContent = Boolean(contentType);

  const {
    data: fetchedContent = [],
    isFetching: isFetchingContent,
  } = useFetchHealthLiteracyContentQuery(contentType, {
    skip: !shouldFetchContent,
  });

  const [
    createHealthLiteracyContent,
    { isLoading: isCreatingContent },
  ] = useCreateHealthLiteracyContentMutation();

  const [
    updateHealthLiteracyContent,
    { isLoading: isUpdatingContent },
  ] = useUpdateHealthLiteracyContentMutation();

  const uploadRule = UPLOAD_RULES[activeTab] ?? UPLOAD_RULES.Articles;

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
      tags: (item.tags ?? []).join(", "),
      media: null,
      mediaPreview: item.media?.dataUrl ?? null,
      existingMedia: item.media ?? null,
      removeMedia: false,
      publishToMobile: Boolean(item.publishToMobile),
      publishToWebsite: Boolean(item.publishToWebsite),
    });
    setIsEditModalOpen(true);
  };

  const handleMediaPreviewClick = (item) => {
    if (!item.media?.dataUrl) return;

    setSelectedMediaContent({
      title: item.title,
      description: item.description,
      media: item.media,
      publishToMobile: item.publishToMobile,
      publishToWebsite: item.publishToWebsite,
    });
  };

  const handleMediaPreviewClose = () => {
    setSelectedMediaContent(null);
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

    if (includeRemoveMedia) {
      payload.append("removeMedia", String(formData.removeMedia));
    }

    if (formData.media) {
      payload.append("file", formData.media);
    }

    return payload;
  };

  const handleCreateSubmit = async () => {
    if (!formData.title.trim()) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message: "Please enter a title",
      });
      return;
    }

    if (!formData.description.trim()) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message: "Please enter a description",
      });
      return;
    }

    if (formData.media && !isAllowedMediaType(formData.media, activeTab)) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message: `${activeTab} does not accept this file type`,
      });
      return;
    }

    try {
      await createHealthLiteracyContent({
        contentType,
        data: buildContentPayload(),
      }).unwrap();

      showToast({
        iconName: "CheckCircle",
        color: "success",
        message: `New ${getContentLabel(activeTab)} created successfully`,
      });

      setIsCreateModalOpen(false);
      resetForm();
    } catch (error) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message:
          error?.data?.detail ??
          `Failed to create ${getContentLabel(activeTab).toLowerCase()}`,
      });
    }
  };

  const handleEditSubmit = async () => {
    if (!editingContent) return;

    if (!formData.title.trim()) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message: "Please enter a title",
      });
      return;
    }

    if (!formData.description.trim()) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message: "Please enter a description",
      });
      return;
    }

    if (formData.media && !isAllowedMediaType(formData.media, activeTab)) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message: `${activeTab} does not accept this file type`,
      });
      return;
    }

    try {
      await updateHealthLiteracyContent({
        contentType,
        contentId: editingContent.id,
        data: buildContentPayload({ includeRemoveMedia: true }),
      }).unwrap();

      showToast({
        iconName: "CheckCircle",
        color: "success",
        message: `${getContentLabel(activeTab)} updated successfully`,
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
          `Failed to update ${getContentLabel(activeTab).toLowerCase()}`,
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

  const setMediaFile = (file) => {
    if (!file) return;

    if (!isAllowedMediaType(file, activeTab)) {
      showToast({
        iconName: "Error",
        color: "destructive",
        message: `${activeTab} does not accept this file type`,
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

  const handleMediaChange = (e) => {
    const file = e.target.files?.[0];
    setMediaFile(file);
    e.target.value = "";
  };

  const handleMediaDrop = (e) => {
    e.preventDefault();
    setMediaFile(e.dataTransfer.files?.[0]);
  };

  const handleRemoveMedia = () => {
    setFormData((prev) => ({
      ...prev,
      media: null,
      mediaPreview: null,
      existingMedia: null,
      removeMedia: Boolean(isEditModalOpen),
    }));
  };

  const getFilteredContent = () => {
    if (activeTab === "HealthLiteracyAnalytics") return [];

    const apiContent = normalizeApiContent(fetchedContent);
    const mockContent = MOCK_CONTENT_BY_TAB[activeTab] ?? [];

    return filterContent([...apiContent, ...mockContent]);
  };

  return (
    <div className="flex flex-col gap-[20px]">
      {/* PAGE HEADER */}
      <div>
        <h1 className="text-[28px] font-semibold text-gray-800">
          Health Literacy Hub
        </h1>
        <p className="text-gray-500 mt-[4px]">
          Access educational resources, multilingual content, and community
          insights to enhance your health knowledge.
        </p>
      </div>

      {/* ILLUSTRATION CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[20px]">
        {ILLUSTRATIONS.map((illustration) => (
          <div
            key={illustration.id}
            className="bg-white rounded-[12px] border border-[#E5E5E5] p-[24px] flex flex-col items-center justify-center text-center"
          >
            <div className="mb-[16px]">
              <Icon
                iconName={illustration.icon}
                height="48px"
                width="48px"
                fill="#6A8EB5"
              />
            </div>
            <h3 className="text-[18px] font-semibold text-gray-800 mb-[8px]">
              {illustration.title}
            </h3>
            <p className="text-[14px] text-gray-500">
              {illustration.description}
            </p>
          </div>
        ))}
      </div>

      {/* TABS NAVIGATION */}
      <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[12px]">
        <div className="flex flex-wrap gap-[8px]">
          {["Articles", "Videos", "Infographics", "HealthLiteracyAnalytics"].map(
            (tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSearchQuery("");
                }}
                className={`px-[16px] py-[10px] rounded-[8px] text-[14px] font-medium transition-all ${
                  activeTab === tab
                    ? "bg-[#F5D76E] text-gray-800"
                    : "bg-[#F5F5F5] text-gray-600 hover:bg-gray-100"
                }`}
              >
                {tab === "HealthLiteracyAnalytics" ? "Analytics" : tab}
              </button>
            )
          )}
        </div>
      </div>

      {/* SEARCH AND CREATE SECTION */}
      {activeTab !== "HealthLiteracyAnalytics" && (
        <div className="flex flex-col sm:flex-row gap-[12px] items-start sm:items-center">
          <Input
            size="input-md"
            id="search-content"
            additionalClasses="flex-1"
            placeholder={`Search ${activeTab.toLowerCase()}...`}
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
      )}

      {/* CONTENT DISPLAY */}
      {activeTab === "HealthLiteracyAnalytics" ? (
        <AnalyticsSection />
      ) : (
        <ContentGrid
          content={getFilteredContent()}
          contentType={activeTab}
          isLoading={isFetchingContent}
          onMediaClick={handleMediaPreviewClick}
          onEditClick={handleEditClick}
        />
      )}

      {/* CREATE MODAL */}
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
          heading={`Create New ${getContentLabel(activeTab)}`}
          color="primary"
          additionalClasses="!top-[68px] !h-[calc(100vh-68px)] !pt-[20px]"
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
          onCancel={() => {
            setIsEditModalOpen(false);
            setEditingContent(null);
            resetForm();
          }}
          onLoading={isUpdatingContent}
          onLoadingLabel="Saving..."
          heading={`Edit ${getContentLabel(activeTab)}`}
          color="primary"
          additionalClasses="!top-[68px] !h-[calc(100vh-68px)] !pt-[20px]"
        >
          <ContentFormBody
            formData={formData}
            uploadRule={uploadRule}
            mode="edit"
            onFormChange={handleFormChange}
            onMediaChange={handleMediaChange}
            onMediaDrop={handleMediaDrop}
            onRemoveMedia={handleRemoveMedia}
          />
        </ModalWithBody>
      )}

      {selectedMediaContent && (
        <MediaPreviewModal
          title={selectedMediaContent.title}
          description={selectedMediaContent.description}
          media={selectedMediaContent.media}
          publishToMobile={selectedMediaContent.publishToMobile}
          publishToWebsite={selectedMediaContent.publishToWebsite}
          onClose={handleMediaPreviewClose}
        />
      )}
    </div>
  );
};

const ContentFormBody = ({
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
    </div>
  );
};

const ContentGrid = ({
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
          key={`${item.source ?? "mock"}-${item.id}`}
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

const MediaPreviewModal = ({
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

const AnalyticsSection = () => {
  return (
    <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[40px] flex flex-col items-center justify-center text-center min-h-[400px]">
      <Icon
        iconName="BarChart3"
        height="64px"
        width="64px"
        fill="#D0D5DD"
        className="mb-[16px]"
      />
      <h3 className="text-[20px] font-semibold text-gray-800 mb-[8px]">
        Analytics Coming Soon
      </h3>
      <p className="text-[14px] text-gray-500 max-w-[400px]">
        Analytics dashboard is being prepared. Check back soon for detailed
        insights on content performance and user engagement.
      </p>
    </div>
  );
};

export default HealthLiteracyHub;
