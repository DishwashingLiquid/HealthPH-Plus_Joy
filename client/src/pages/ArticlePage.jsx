import { Link, useLocation, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import "../assets/css/about.css";
import "../assets/css/health-literacy.css";
import HomeNavbar from "../components/HomeNavbar";
import HomeFooter from "../components/HomeFooter";
import { useFetchWebsiteHealthLiteracyContentQuery } from "../features/api/healthLiteracyHubSlice";
import { formatContentDate, getArticleGalleryImages, getResourceImageSource, normalizeWebsiteContent, sortNewestFirst } from "../utils/healthLiteracyWebsiteContent";
import ArticleItem from "../components/about-us/ArticleItem";
import ArticleMedia, { ArticleMediaProvider } from "../components/about-us/ArticleMedia";
import MediaViewer, { Attachment } from "../components/health-literacy/MediaViewers";
import CommentSection from "../components/health-literacy/CommentSection";
import PublicContentActions from "../components/health-literacy/PublicContentActions";
import usePublicContentView from "../components/health-literacy/usePublicContentView";

const ArticlePageContent = () => {
  const { slug } = useParams();
  const location = useLocation();
  const [preview, setPreview] = useState(null);
  const { data: websiteArticles = [], isFetching, isError, refetch } = useFetchWebsiteHealthLiteracyContentQuery("articles");
  const allArticles = useMemo(() => sortNewestFirst([
    ...normalizeWebsiteContent(websiteArticles),
  ]), [websiteArticles]);
  const article = allArticles.find((a) => a.articleSlug === slug);
  usePublicContentView(article, true, location.key);
  const latest = allArticles.filter((a) => a.articleSlug !== slug).slice(0, 4);
  useEffect(() => { window.scrollTo(0, 0); setPreview(null); }, [slug]);
  const back = <Link className="public-button" to="/articles" state={location.state}>Back to Article List</Link>;
  if (!article) return <div className="article-page-layout hl-reading public-buttons">
    <HomeNavbar background="solid" /><main className="hl-reading-surface">{back}
      <p role="status">{isFetching ? "Loading article…" : isError ? "Article could not be loaded." : "Article not found."}</p>
      {isError && <button type="button" className="public-button" onClick={refetch}>Retry article</button>}
    </main><HomeFooter /></div>;
  const images = getArticleGalleryImages(article);
  const showHero = () => setPreview({ images: [{ src: getResourceImageSource(article), alt: article.articleTitle }], index: 0 });
  return <div className="article-page-layout hl-reading public-buttons">
    <HomeNavbar background="solid" />
    <main className="hl-reading-surface">
      {back}
      <article>
        <header className="hl-reading-header">
          <h1>{article.articleTitle}</h1>
          <p className="hl-meta">{[article.contentTypeLabel, article.readDuration, formatContentDate(article.datePublished)].filter(Boolean).join(" · ")}</p>
          {article.tags?.length > 0 && <p className="hl-meta">{article.tags.join(", ")}</p>}
        </header>
        <div className="hl-article-attachment"><Attachment article={article} onImageOpen={showHero} /></div>
        <div className="hl-prose">{(article.articleBody || article.articlePreview || "").split("\n").filter(Boolean).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>
        {images.length > 0 && <div className="hl-gallery">{images.map((image, i) => <figure key={image.id}>
          <ArticleMedia src={image.src} alt={image.alt} onPreviewClick={() => setPreview({ images, index: i })} />
          {image.caption && <figcaption>{image.caption}</figcaption>}
        </figure>)}</div>}
      </article>
      <PublicContentActions key={`actions-${article.articleSlug}`} article={article} />
      <CommentSection key={article.articleSlug} article={article} />
      <section className="hl-latest" aria-labelledby="latest-articles-heading">
        <h2 id="latest-articles-heading">Latest Articles</h2>
        <div className="articles">{latest.map((item) => <ArticleItem article={item} key={item.articleSlug} />)}</div>
        <Link className="public-button" to="/articles">See All Articles</Link>
      </section>
    </main>
    <HomeFooter />
    {preview && <MediaViewer article={article} trackView={false} images={preview.images} initialIndex={preview.index} onClose={() => setPreview(null)} />}
  </div>;
};
const ArticlePage = () => <ArticleMediaProvider><ArticlePageContent /></ArticleMediaProvider>;
export default ArticlePage;
