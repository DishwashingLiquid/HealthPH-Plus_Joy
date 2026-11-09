/* eslint-disable react/prop-types */
import { Link } from "react-router-dom";
import Icon from "../Icon";
import ArticleMedia from "./ArticleMedia";
import VideoCardPreview from "../health-literacy/VideoCardPreview";
import { attachmentKind, GENERIC_ARTICLE_THUMBNAIL } from "../../utils/healthLiteracyMedia";
import {
  formatContentDate,
  getResourceImageSource,
  getResourcePosterSource,
} from "../../utils/healthLiteracyWebsiteContent";

const ArticleItem = ({ article, articlePage, isLoading, onPreviewClick }) => {
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
  const kind = attachmentKind(mediaSource, article.media?.contentType || "", resourceType);
  const isVideo = resourceType === "video";
  const isPreviewContent = ["video", "infographic"].includes(resourceType);
  const displayDate = formatContentDate(datePublished);

  if (isLoading && isVideo) {
    return (
      <div
        className="article-item article-item-video-loading"
        role="status"
        aria-label="Loading video content"
      >
        <Icon iconName="Video" height="48px" width="48px" stroke="#6B7280" />
      </div>
    );
  }

  return (
    <div className="article-item">
      <div className="article-image">
        {isVideo ? <VideoCardPreview src={mediaSource} poster={getResourcePosterSource(article)} mime={article.media?.contentType}
          title={articleTitle} onOpen={() => onPreviewClick?.(article)} />
          : isPreviewContent ? <button type="button" className="article-media-preview" aria-label={`View Infographic: ${articleTitle}`} onClick={() => onPreviewClick?.(article)}>
            <ArticleMedia src={kind === "image" ? mediaSource : GENERIC_ARTICLE_THUMBNAIL} alt={articleImageCaption || articleTitle} />
          </button> : <Link to={"/articles/" + articleSlug} state={articlePage} aria-label={`Read article: ${articleTitle}`}>
            <ArticleMedia src={kind === "image" ? mediaSource : GENERIC_ARTICLE_THUMBNAIL} alt={articleImageCaption || articleTitle} />
          </Link>}

      </div>
      <div className="article-body">
        <div className="article-meta">
          {contentTypeLabel && <span className="article-type">{contentTypeLabel}</span>}
          {displayDate && <p className="date">{displayDate}</p>}
        </div>
        <h3 className="article-title">{articleTitle}</h3>
        <p className="article-preview">{articlePreview}</p>
        {isPreviewContent ? (
          <button
            type="button"
            disabled={false}
            onClick={() => onPreviewClick?.(article)}
            className="public-button article-action"
          >
            <span>{isVideo ? "Watch Video" : "View Infographic"}</span>
            <Icon
              iconName="ArrowUpRight"
              height="24px"
              width="24px"
              stroke="currentColor"
            />
          </button>
        ) : (
          <Link
            state={articlePage}
            to={"/articles/" + articleSlug}
            className="public-button article-action"
          >
            <span>Read More</span>
            <Icon
              iconName="ArrowUpRight"
              height="24px"
              width="24px"
              stroke="currentColor"
            />
          </Link>
        )}
      </div>
    </div>
  );
};

export const ArticleItemSkeleton = () => {
  return (
    <div className="article-item article-item-skeleton" aria-hidden="true">
      <div className="article-image article-skeleton-block"></div>
      <div className="article-body">
        <div className="article-meta">
          <span className="article-skeleton-block article-skeleton-chip"></span>
          <span className="article-skeleton-block article-skeleton-date"></span>
        </div>
        <div className="article-skeleton-title">
          <div className="article-skeleton-block article-skeleton-line"></div>
          <div className="article-skeleton-block article-skeleton-line article-skeleton-line-short"></div>
        </div>
        <div className="article-skeleton-preview">
          <div className="article-skeleton-block article-skeleton-line"></div>
          <div className="article-skeleton-block article-skeleton-line"></div>
          <div className="article-skeleton-block article-skeleton-line article-skeleton-line-medium"></div>
        </div>
        <div className="article-skeleton-button article-skeleton-block"></div>
      </div>
    </div>
  );
};

export default ArticleItem;
