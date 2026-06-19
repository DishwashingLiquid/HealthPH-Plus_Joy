/* eslint-disable react/prop-types */
import { Link } from "react-router-dom";
import Icon from "../Icon";
import {
  formatContentDate,
  getResourceImageSource,
} from "../../utils/healthLiteracyWebsiteContent";

const ArticleItem = ({ article, articlePage, onPreviewClick }) => {
  const {
    articleTitle,
    articleSlug,
    datePublished,
    articlePreview,
    articleImageCaption,
    contentTypeLabel,
    resourceType,
  } = article;
  const mediaSource = getResourceImageSource(article);
  const isVideo = resourceType === "video";
  const isPreviewContent = ["video", "infographic"].includes(resourceType);
  const displayDate = formatContentDate(datePublished);

  return (
    <div className="article-item">
      <div className="article-image">
        {mediaSource && isVideo ? (
          <video src={mediaSource} muted playsInline />
        ) : mediaSource ? (
          <img src={mediaSource} alt={articleImageCaption || articleTitle} />
        ) : (
          <div className="article-image-placeholder">
            <Icon
              iconName="Document"
              height="48px"
              width="48px"
              fill="#6A8EB5"
            />
          </div>
        )}
      </div>
      <div className="article-body">
        <div className="article-meta">
          {contentTypeLabel && <span className="article-type">{contentTypeLabel}</span>}
          {displayDate && <p className="date">{displayDate}</p>}
        </div>
        <p className="article-title">{articleTitle}</p>
        <p className="article-preview">{articlePreview}</p>
        {isPreviewContent ? (
          <button
            type="button"
            onClick={() => onPreviewClick?.(article)}
            className="prod-btn-lg prod-btn-secondary article-action"
          >
            <span>{isVideo ? "Watch Video" : "View Infographic"}</span>
            <Icon
              iconName="ArrowUpRight"
              height="24px"
              width="24px"
              stroke="#8693A0"
            />
          </button>
        ) : (
          <Link
            state={articlePage}
            to={"/articles/" + articleSlug}
            className="prod-btn-lg prod-btn-secondary article-action"
          >
            <span>Read More</span>
            <Icon
              iconName="ArrowUpRight"
              height="24px"
              width="24px"
              stroke="#8693A0"
            />
          </Link>
        )}
      </div>
    </div>
  );
};
export default ArticleItem;
