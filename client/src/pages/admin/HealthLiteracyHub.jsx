import { useState } from "react";
import { useSelector } from "react-redux";
import Input from "../../components/Input";
import Icon from "../../components/Icon";
import ModalWithBody from "../../components/admin/ModalWithBody";

// Mock data - TODO: Replace with API endpoints
// API Endpoints structure:
// GET /api/health-literacy-hub/articles?search=&page=1&limit=10
// POST /api/health-literacy-hub/articles (create new article)
// GET /api/health-literacy-hub/videos?search=&page=1&limit=10
// POST /api/health-literacy-hub/videos (create new video)
// GET /api/health-literacy-hub/infographics?search=&page=1&limit=10
// POST /api/health-literacy-hub/infographics (create new infographic)
// GET /api/health-literacy-hub/analytics (engagement metrics, views, interactions)

const MOCK_ARTICLES = [
  {
    id: 1,
    title: "Understanding Hypertension",
    description: "Learn about high blood pressure and its management strategies to maintain a healthy lifestyle",
    tags: ["health", "hypertension", "prevention"],
    thumbnail: "article1.jpg",
    date: "May 10, 2026"
  },
  {
    id: 2,
    title: "Diabetes Prevention Guide",
    description: "Comprehensive guide to preventing type 2 diabetes through diet, exercise, and lifestyle changes",
    tags: ["diabetes", "nutrition", "lifestyle"],
    thumbnail: "article2.jpg",
    date: "May 08, 2026"
  },
  {
    id: 3,
    title: "Mental Health Awareness",
    description: "Breaking stigma and understanding mental health conditions and available support resources",
    tags: ["mental-health", "awareness", "wellness"],
    thumbnail: "article3.jpg",
    date: "May 05, 2026"
  },
  {
    id: 4,
    title: "COVID-19 Prevention",
    description: "Latest guidelines on preventing COVID-19 transmission and staying protected",
    tags: ["covid", "prevention", "health"],
    thumbnail: "article4.jpg",
    date: "May 01, 2026"
  },
];

const MOCK_VIDEOS = [
  {
    id: 1,
    title: "Exercise Routines for Seniors",
    description: "Safe and effective exercises designed specifically for elderly individuals to improve mobility",
    tags: ["exercise", "seniors", "fitness"],
    thumbnail: "video1.jpg",
    duration: "12:35"
  },
  {
    id: 2,
    title: "Nutrition Basics",
    description: "Learn about balanced diet and nutrition fundamentals for optimal health and wellness",
    tags: ["nutrition", "diet", "health"],
    thumbnail: "video2.jpg",
    duration: "18:42"
  },
  {
    id: 3,
    title: "Stress Management Techniques",
    description: "Practical techniques to manage stress and improve mental well-being in daily life",
    tags: ["stress", "mental-health", "wellness"],
    thumbnail: "video3.jpg",
    duration: "15:20"
  },
];

const MOCK_INFOGRAPHICS = [
  {
    id: 1,
    title: "COVID-19 Prevention Steps",
    description: "Visual guide to preventing COVID-19 transmission through proper hygiene and safety measures",
    tags: ["covid", "prevention", "health"],
    thumbnail: "infographic1.jpg"
  },
  {
    id: 2,
    title: "Food Pyramid Guide",
    description: "Understanding the food pyramid and recommended serving sizes for each food group",
    tags: ["nutrition", "diet", "visual"],
    thumbnail: "infographic2.jpg"
  },
  {
    id: 3,
    title: "Signs of Stroke",
    description: "Recognize the early warning signs of stroke to seek immediate medical attention",
    tags: ["emergency", "health", "awareness"],
    thumbnail: "infographic3.jpg"
  },
];

const ILLUSTRATIONS = [
  {
    id: 1,
    title: "Educational Content",
    icon: "BookOpen",
    description: "Access curated health education materials"
  },
  {
    id: 2,
    title: "Multilingual Resources",
    icon: "Globe",
    description: "Content available in multiple languages"
  },
  {
    id: 3,
    title: "Community Q&A",
    icon: "MessageCircle",
    description: "Ask and answer health-related questions"
  },
];


const HealthLiteracyHub = () => {
  const user = useSelector((state) => state.auth.user);

  const [activeTab, setActiveTab] = useState("Articles");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    tags: "",
    media: null,
    mediaPreview: null,
  });

  // Search filtering logic
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
    setFormData({ title: "", description: "", tags: "", media: null, mediaPreview: null });
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = () => {
    // TODO: Integrate with backend API endpoint
    // POST /api/health-literacy-hub/{contentType}
    // Payload: { title, description, tags, file }
    // Response: { id, title, description, tags, thumbnail, created_at }

    if (!formData.title.trim()) {
      alert("Please enter a title");
      return;
    }

    if (!formData.description.trim()) {
      alert("Please enter a description");
      return;
    }

    console.log("Creating new content:", {
      tab: activeTab,
      ...formData,
    });

    // Placeholder success message (can be replaced with toast notification)
    alert(`New ${activeTab.slice(0, -1)} created successfully!`);
    setIsCreateModalOpen(false);
    setFormData({ title: "", description: "", tags: "", media: null, mediaPreview: null });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleMediaChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          media: file,
          mediaPreview: reader.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Get current content based on active tab
  const getFilteredContent = () => {
    switch (activeTab) {
      case "Articles":
        return filterContent(MOCK_ARTICLES);
      case "Videos":
        return filterContent(MOCK_VIDEOS);
      case "Infographics":
        return filterContent(MOCK_INFOGRAPHICS);
      case "HealthLiteracyAnalytics":
        return [];
      default:
        return [];
    }
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
        <ContentGrid content={getFilteredContent()} contentType={activeTab} />
      )}

      {/* CREATE MODAL */}
      {isCreateModalOpen && (
        <ModalWithBody
          onConfirm={handleCreateSubmit}
          onConfirmLabel="Create"
          onCancel={() => setIsCreateModalOpen(false)}
          heading={`Create New ${activeTab.slice(0, -1)}`}
          color="primary"
        >
          <div className="p-[20px] flex flex-col gap-[16px]">
            <div>
              <label className="block text-[14px] font-medium text-gray-800 mb-[8px]">
                Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleFormChange}
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
                onChange={handleFormChange}
                placeholder="Enter content description"
                className="w-full px-[12px] py-[10px] border border-[#E5E5E5] rounded-[8px] text-[14px] focus:outline-none focus:border-[#6A8EB5]"
                rows="4"
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
                onChange={handleFormChange}
                placeholder="e.g., health, education, wellness"
                className="w-full px-[12px] py-[10px] border border-[#E5E5E5] rounded-[8px] text-[14px] focus:outline-none focus:border-[#6A8EB5]"
              />
            </div>
            <div>
              <label className="block text-[14px] font-medium text-gray-800 mb-[8px]">
                Media Upload (Image/Video)
              </label>
              <div 
                className="border-2 border-dashed border-[#E5E5E5] rounded-[8px] p-[20px] text-center cursor-pointer hover:bg-[#F9F9F9] transition-colors"
                onClick={() => document.getElementById("media-upload").click()}
              >
                {formData.mediaPreview ? (
                  <div className="flex flex-col items-center">
                    <img 
                      src={formData.mediaPreview} 
                      alt="Preview" 
                      className="w-[100px] h-[100px] object-cover rounded-[4px] mb-[8px]"
                    />
                    <p className="text-[13px] text-gray-600 font-medium">{formData.media?.name}</p>
                    <p className="text-[12px] text-gray-500 mt-[4px]">Click to change</p>
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
                    <p className="text-[14px] font-medium text-gray-800">Drag and drop your file</p>
                    <p className="text-[12px] text-gray-500 mt-[4px]">or click to browse</p>
                    <p className="text-[11px] text-gray-400 mt-[8px]">JPG, PNG, MP4 up to 50MB</p>
                  </div>
                )}
              </div>
              <input
                id="media-upload"
                type="file"
                accept="image/*,video/*"
                onChange={handleMediaChange}
                className="hidden"
              />
              {formData.media && (
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, media: null, mediaPreview: null }))}
                  className="text-[12px] text-red-500 hover:text-red-700 mt-[8px] font-medium"
                >
                  Remove file
                </button>
              )}
            </div>
          </div>
        </ModalWithBody>
      )}
    </div>
  );
};

// Content Grid Component
const ContentGrid = ({ content, contentType }) => {
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
        <ContentCard key={item.id} item={item} contentType={contentType} />
      ))}
    </div>
  );
};

// Content Card Component
const ContentCard = ({ item, contentType }) => {
  return (
    <div className="bg-white rounded-[12px] border border-[#E5E5E5] overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
      {/* Thumbnail */}
      <div className="bg-gradient-to-br from-[#6A8EB5] to-[#78C6B2] h-[180px] flex items-center justify-center">
        <Icon
          iconName="Image"
          height="64px"
          width="64px"
          fill="#FFFFFF"
          opacity="0.5"
        />
      </div>

      {/* Card Content */}
      <div className="p-[16px]">
        <h3 className="text-[16px] font-semibold text-gray-800 mb-[8px] line-clamp-2">
          {item.title}
        </h3>
        <p className="text-[13px] text-gray-600 mb-[12px] line-clamp-2">
          {item.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-[6px] mb-[12px]">
          {item.tags.slice(0, 2).map((tag, index) => (
            <span
              key={index}
              className="inline-block px-[8px] py-[4px] bg-[#F5F5F5] rounded-[4px] text-[11px] text-gray-600 font-medium"
            >
              {tag}
            </span>
          ))}
          {item.tags.length > 2 && (
            <span className="inline-block px-[8px] py-[4px] bg-[#F5F5F5] rounded-[4px] text-[11px] text-gray-600 font-medium">
              +{item.tags.length - 2}
            </span>
          )}
        </div>

        {/* Meta Information */}
        <div className="text-[12px] text-gray-500">
          {item.date && <span>📅 {item.date}</span>}
          {item.duration && <span>⏱️ {item.duration}</span>}
        </div>
      </div>
    </div>
  );
};

// Analytics Section Component
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
        {/* TODO: Integrate with analytics API endpoint */}
        {/* Expected data: engagement metrics, content views, user interactions */}
        Analytics dashboard is being prepared. Check back soon for detailed
        insights on content performance and user engagement.
      </p>
    </div>
  );
};

export default HealthLiteracyHub;