/* eslint-disable react/prop-types */
import { useMemo, useReducer } from "react";
import {
  ArticleMediaContext,
  articleMediaReducer,
  useArticleMediaResource,
} from "../../utils/articleMediaState";
import "../../assets/css/article-media.css";

export const ArticleMediaProvider = ({ children }) => {
  const [resources, dispatch] = useReducer(articleMediaReducer, {});
  const value = useMemo(() => [resources, dispatch], [resources]);
  return (
    <ArticleMediaContext.Provider value={value}>
      {children}
    </ArticleMediaContext.Provider>
  );
};

const MediaUnavailable = ({ resource, poster = false }) => (
  <div className="article-media-unavailable">
    <div role="status">
      <p>Media temporarily unavailable</p>
      {poster && <p>Video poster unavailable. You can still play the video.</p>}
      {!resource.canRetry && <p>Please refresh the page to try again.</p>}
    </div>
    {resource.canRetry && (
      <button
        type="button"
        className="prod-btn-lg prod-btn-secondary"
        onClick={resource.retry}
      >
        {poster ? "Retry poster" : "Retry media"}
      </button>
    )}
  </div>
);

const ArticleMedia = ({
  src,
  alt,
  video = false,
  poster,
  controls = false,
  autoPlay = false,
  onPreviewClick,
}) => {
  const resource = useArticleMediaResource(src);
  const posterResource = useArticleMediaResource(poster);

  if (resource.failed) return <MediaUnavailable resource={resource} />;

  const media = video ? (
    <>
      <video
        key={`${src}-${resource.attempt}`}
        src={src}
        poster={poster && !posterResource.failed ? poster : undefined}
        onError={resource.onError}
        controls={controls}
        autoPlay={autoPlay}
        muted={!controls}
        playsInline
        preload="metadata"
        aria-label={alt}
      />
      {/* Video error events do not report poster failures. Observe that image separately. */}
      {poster && !posterResource.failed && (
        <img
          key={`${poster}-${posterResource.attempt}`}
          className="article-media-poster-probe"
          src={poster}
          alt=""
          aria-hidden="true"
          onError={posterResource.onError}
        />
      )}
    </>
  ) : (
    <img key={`${src}-${resource.attempt}`} src={src} alt={alt} onError={resource.onError} />
  );

  return (
    <div className={`article-media${poster && posterResource.failed ? " article-media-with-poster-error" : ""}`}>
      {onPreviewClick ? (
        <button
          type="button"
          className="article-media-preview"
          aria-label={`Preview: ${alt}`}
          onClick={onPreviewClick}
        >
          {media}
        </button>
      ) : media}
      {video && poster && posterResource.failed && (
        <MediaUnavailable resource={posterResource} poster />
      )}
    </div>
  );
};

// An actual image reports errors while retaining the existing hero background layout.
export const ArticleHeroMedia = ({ src, alt, children }) => {
  const resource = useArticleMediaResource(src);
  return (
    <section className="article-hero-wrapper">
      {!resource.failed && (
        <img
          className="article-hero-image"
          key={`${src}-${resource.attempt}`}
          src={src}
          alt={alt}
          onError={resource.onError}
        />
      )}
      <div className="article-hero-overlay"></div>
      <div className="article-hero">
        {children}
        {resource.failed && <MediaUnavailable resource={resource} />}
      </div>
    </section>
  );
};

export default ArticleMedia;
