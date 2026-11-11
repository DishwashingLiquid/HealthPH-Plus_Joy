/* eslint-disable react/prop-types */
import { useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import "../assets/css/about.css";

import Icon from "../components/Icon";
import HomeNavbar from "../components/HomeNavbar";
import HomeFooter from "../components/HomeFooter";
import MediaViewer from "../components/health-literacy/MediaViewers";
import "../assets/css/health-literacy.css";
import {
  ArticleMediaProvider,
} from "../components/about-us/ArticleMedia";
import ArticleItem, {
  ArticleItemSkeleton,
} from "../components/about-us/ArticleItem";
import { useFetchWebsiteHealthLiteracyContentQuery } from "../features/api/healthLiteracyHubSlice";
import {
  normalizeWebsiteContent,
  sortNewestFirst,
} from "../utils/healthLiteracyWebsiteContent";

const ArticlesContent = ({ embedded = false }) => {
  const Heading = embedded ? "h2" : "h1";
  const location = useLocation();

  const [articlePage, setArticlePage] = useState(location.state ?? 1);
  const [previewContent, setPreviewContent] = useState(null);
  const openedShare = useRef(null);
  const {
    data: websiteContent,
    isLoading: isLoadingWebsiteContent,
    isFetching: isFetchingWebsiteContent,
    isError: isWebsiteContentError,
  } = useFetchWebsiteHealthLiteracyContentQuery();

  const numOfArticlesPerPage = 9;
  const isShowingArticleSkeletons =
    isLoadingWebsiteContent &&
    isFetchingWebsiteContent &&
    typeof websiteContent === "undefined";

  const articles = useMemo(() => {
    const dashboardContent = normalizeWebsiteContent(websiteContent ?? []);

    return sortNewestFirst(dashboardContent);
  }, [websiteContent]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const visit = `${location.key}:${location.search}`;
    if (openedShare.current === visit) return;
    const item = articles.find((entry) => String(entry.id) === params.get("content")
      && entry.contentType === params.get("type") && ["video", "infographic"].includes(entry.resourceType));
    if (item) { openedShare.current = visit; setPreviewContent(item); }
  }, [articles, location.search, location.key]);

  useEffect(() => {
    if (!embedded) window.scrollTo(0, 0);
  }, [embedded]);

  useEffect(() => {
    document.getElementsByClassName("article-layout")[0]?.scrollTo({
      top: 0,
      behavior: "instant",
    });
  }, [articlePage]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(articles.length / numOfArticlesPerPage));

    if (articlePage > maxPage) {
      setArticlePage(maxPage);
    }
  }, [articlePage, articles.length]);

  const getArticles = () => {
    const startIndex = articlePage * numOfArticlesPerPage;

    const articlesPerPage = articles;

    return articlesPerPage.slice(startIndex - numOfArticlesPerPage, startIndex);
  };

  const maxArticlePage = Math.ceil(articles.length / numOfArticlesPerPage);

  const content = (
    <section className={embedded ? "public-section public-content-section section-articles" : "mt-[56px]"}>
      <div className={embedded ? "public-shell" : "about-container mb-[112px]"}>
          <div className="w-full max-w-[1144px]">
            {/* <div className="flex justify-start items-center mb-[24px]">
              <Link
                to="/about-us"
                className="public-button flex items-center"
              >
                <Icon
                  iconName="ArrowLeft"
                  height="24px"
                  width="24px"
                  fill="currentColor"
                />
                <span className="ms-[8px]">Go Back</span>
              </Link>
            </div> */}
            <Heading id={embedded ? "articles" : undefined} className={embedded ? "public-section-heading public-scroll-target" : "section-title"}>Articles</Heading>
            {embedded && <p className="public-section-intro">Research-informed resources, updates, and public-health learning materials from HealthPH+.</p>}
            {isWebsiteContentError && (
              <p className="article-status">
                Articles could not be loaded. Please try again later.
              </p>
            )}
            <div className="articles">
              {isShowingArticleSkeletons
                ? Array.from({ length: numOfArticlesPerPage }, (_, index) => (
                    <ArticleItemSkeleton key={`article-skeleton-${index}`} />
                  ))
                : getArticles().map((a) => {
                    if (a.articleTitle != "") {
                      return (
                        <ArticleItem
                          article={a}
                          key={`${a.source}-${a.id ?? a.articleID ?? a.articleSlug}`}
                          articlePage={articlePage}
                          isLoading={
                            isFetchingWebsiteContent && a.resourceType === "video"
                          }
                          onPreviewClick={setPreviewContent}
                        />
                      );
                    }
                  })}
            </div>
            {!isShowingArticleSkeletons && !isWebsiteContentError && articles.length === 0 && (
              <p className="article-status">No published articles are available yet.</p>
            )}
            {!isShowingArticleSkeletons &&
              articles.length > numOfArticlesPerPage && (
              <div className="w-full flex justify-end">
                <button
                  className="public-button public-button--icon flex items-center justify-center me-[20px] h-[48px]"
                  aria-label="Previous articles"
                  disabled={!(articlePage > 1)}
                  onClick={() => {
                    if (articlePage > 1) {
                      setArticlePage((articlePage) => articlePage - 1);
                    }
                  }}
                >
                  <Icon
                    iconName="ArrowLeft"
                    height="24px"
                    width="24px"
                    fill="currentColor"
                  />
                </button>
                <button
                  className="public-button public-button--icon flex items-center justify-center h-[48px]"
                  aria-label="Next articles"
                  disabled={!(articlePage < maxArticlePage)}
                  onClick={() => {
                    if (articlePage < maxArticlePage) {
                      setArticlePage((articlePage) => articlePage + 1);
                    }
                  }}
                >
                  <Icon
                    iconName="ArrowRight"
                    height="24px"
                    width="24px"
                    fill="currentColor"
                  />
                </button>
              </div>
            )}
          </div>
      </div>
    </section>
  );

  const previewModal = previewContent && (
    <MediaViewer article={previewContent} onClose={() => setPreviewContent(null)} />
  );

  if (embedded) {
    return <div className="article-layout one-page-section hl-articles public-buttons">{content}{previewModal}</div>;
  }

  return <div className="article-layout hl-articles public-buttons"><HomeNavbar />{content}<HomeFooter />{previewModal}</div>;
};

const Articles = (props) => (
  <ArticleMediaProvider><ArticlesContent {...props} /></ArticleMediaProvider>
);

export default Articles;
