import { useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import "../assets/css/about.css";

import Icon from "../components/Icon";
import HomeNavbar from "../components/HomeNavbar";
import HomeFooter from "../components/HomeFooter";
import ArticleItem, {
  ArticleItemSkeleton,
} from "../components/about-us/ArticleItem";
import { useFetchWebsiteHealthLiteracyContentQuery } from "../features/api/healthLiteracyHubSlice";
import {
  getContentMediaSource,
  normalizeStaticArticle,
  normalizeWebsiteContent,
  sortNewestFirst,
} from "../utils/healthLiteracyWebsiteContent";

import ArticlesList from "../assets/data/articles.json";

const Articles = () => {
  const location = useLocation();

  const [articlePage, setArticlePage] = useState(location.state ?? 1);
  const [previewContent, setPreviewContent] = useState(null);
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
    const staticArticles = ArticlesList.filter((a) => a.articleTitle != "").map(
      normalizeStaticArticle
    );
    const dashboardContent = normalizeWebsiteContent(websiteContent ?? []);

    return sortNewestFirst([...dashboardContent, ...staticArticles]);
  }, [websiteContent]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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

  const previewMediaSource = getContentMediaSource(previewContent?.media);
  const previewMediaType = previewContent?.media?.contentType ?? "";
  const isPreviewVideo = previewMediaType.startsWith("video/");
  const previewFilename =
    previewContent?.media?.filename || `${previewContent?.articleTitle ?? "infographic"}`;
  const maxArticlePage = Math.ceil(articles.length / numOfArticlesPerPage);

  return (
    <div className="article-layout">
      <HomeNavbar />

      <section className="mt-[56px]">
        <div className="about-container mb-[112px]">
          <div className="w-full max-w-[1144px]">
            {/* <div className="flex justify-start items-center mb-[24px]">
              <Link
                to="/about-us"
                className="prod-btn-lg prod-btn-secondary flex items-center"
              >
                <Icon
                  iconName="ArrowLeft"
                  height="24px"
                  width="24px"
                  fill="#8693A0"
                />
                <span className="ms-[8px]">Go Back</span>
              </Link>
            </div> */}
            <p className="section-title">Articles</p>
            {isWebsiteContentError && (
              <p className="article-status">
                Dashboard resources could not be loaded. Showing saved articles.
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
                          onPreviewClick={setPreviewContent}
                        />
                      );
                    }
                  })}
            </div>
            {!isShowingArticleSkeletons &&
              articles.length > numOfArticlesPerPage && (
              <div className="w-full flex justify-end">
                <button
                  className="prod-btn-lg prod-btn-secondary flex items-center justify-center me-[20px] h-[48px]"
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
                    fill="#8693A0"
                  />
                </button>
                <button
                  className="prod-btn-lg prod-btn-secondary flex items-center justify-center h-[48px]"
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
                    fill="#8693A0"
                  />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <HomeFooter />

      {previewContent && (
        <div className="image-modal health-literacy-preview-modal">
          <div
            className="image-modal-backdrop"
            onClick={() => setPreviewContent(null)}
          ></div>
          <div className="image-modal-container">
            <div className="image-wrapper">
              {previewMediaSource && isPreviewVideo ? (
                <video src={previewMediaSource} controls autoPlay />
              ) : previewMediaSource ? (
                <img
                  src={previewMediaSource}
                  alt={previewContent.articleTitle}
                />
              ) : (
                <div className="article-preview-empty">
                  <Icon
                    iconName="Document"
                    height="48px"
                    width="48px"
                    fill="#6A8EB5"
                  />
                  <p>Preview is unavailable.</p>
                </div>
              )}
            </div>
            <div className="image-caption">
              <p>{previewContent.articleTitle}</p>
              {previewContent.resourceType === "infographic" &&
                previewMediaSource && (
                  <a
                    href={previewMediaSource}
                    download={previewFilename}
                    className="prod-btn-lg prod-btn-secondary article-preview-download"
                  >
                    <span>Download</span>
                    <Icon
                      iconName="Download"
                      height="20px"
                      width="20px"
                      fill="#8693A0"
                    />
                  </a>
                )}
            </div>
            <div className="close-icon" onClick={() => setPreviewContent(null)}>
              <Icon
                iconName="Close"
                height="24px"
                width="24px"
                className="icon"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Articles;
