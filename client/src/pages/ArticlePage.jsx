import { Link, useLocation, useParams } from "react-router-dom";
import { Fragment, useEffect, useMemo, useState } from "react";
import "../assets/css/about.css";

import Icon from "../components/Icon";
import HomeNavbar from "../components/HomeNavbar";
import HomeFooter from "../components/HomeFooter";
import { useFetchWebsiteHealthLiteracyContentQuery } from "../features/api/healthLiteracyHubSlice";
import {
  formatContentDate,
  getStaticArticleImageSource,
  normalizeStaticArticle,
  normalizeWebsiteContent,
  sortNewestFirst,
} from "../utils/healthLiteracyWebsiteContent";

import ArticlesList from "../assets/data/articles.json";
import ArticleItem from "../components/about-us/ArticleItem";

const ArticlePage = () => {
  const { slug } = useParams();
  const location = useLocation();
  const [imageModalActive, setImageModalActive] = useState(false);
  const [modalData, setModalData] = useState({ src: "", caption: "" });

  const { data: websiteArticles = [], isFetching } =
    useFetchWebsiteHealthLiteracyContentQuery("articles");
  const staticArticles = useMemo(
    () =>
      ArticlesList.filter((a) => a.articleTitle != "").map(normalizeStaticArticle),
    []
  );
  const dashboardArticles = useMemo(
    () => normalizeWebsiteContent(websiteArticles),
    [websiteArticles]
  );
  const allArticles = useMemo(
    () => sortNewestFirst([...dashboardArticles, ...staticArticles]),
    [dashboardArticles, staticArticles]
  );

  const article = allArticles.find((a) => a.articleSlug == slug);
  const latestArticles = allArticles
    .filter((a) => a.articleSlug != slug)
    .slice(0, 4);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!article && isFetching) {
    return (
      <div className="article-page-layout">
        <HomeNavbar background="solid" />
        <section className="article-container">
          <div className="article-wrapper mt-[112px]">
            <p className="article-body">Loading article...</p>
          </div>
        </section>
        <HomeFooter />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="article-page-layout">
        <HomeNavbar background="solid" />
        <section className="article-container">
          <div className="article-wrapper mt-[112px]">
            <div className="flex justify-start items-center mb-[24px]">
              <Link
                to="/articles"
                state={location.state}
                className="prod-btn-lg prod-btn-secondary flex items-center"
              >
                <Icon
                  iconName="ArrowLeft"
                  height="24px"
                  width="24px"
                  fill="#8693A0"
                />
                <span className="ms-[8px]">Back to Article List</span>
              </Link>
            </div>
            <p className="article-body">Article not found.</p>
          </div>
        </section>
        <HomeFooter />
      </div>
    );
  }

  const {
    articleTitle,
    readDuration,
    datePublished,
    articlePreview,
    galleryFolder,
    galleryImages = [],
    articleBody,
    contentTypeLabel,
    tags = [],
  } = article;
  const heroImageSource = getStaticArticleImageSource(article);
  const articleText = articleBody || articlePreview || "";
  const displayDate = formatContentDate(datePublished);
  const detailMeta = [
    contentTypeLabel,
    readDuration,
    displayDate,
    tags.length > 0 ? tags.join(", ") : null,
  ]
    .filter(Boolean)
    .join(" - ");

  return (
    <div className="article-page-layout">
      <HomeNavbar background="solid" />
      <section
        className="article-hero-wrapper"
        style={{
          backgroundImage: heroImageSource ? `url('${heroImageSource}')` : undefined,
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="article-hero-overlay"></div>
        <div className="article-hero ">
          <div className="flex justify-start items-center mb-[24px]">
            <Link
              to="/articles"
              state={location.state}
              className="prod-btn-lg prod-btn-secondary flex items-center"
            >
              <Icon
                iconName="ArrowLeft"
                height="24px"
                width="24px"
                fill="#8693A0"
              />
              <span className="ms-[8px]">Back to Article List</span>
            </Link>
          </div>
          <div className="article-header">
            <p className="article-title">{articleTitle}</p>
            {detailMeta && (
              <p className="article-content my-[24px]">{detailMeta}</p>
            )}
            <p className="article-content">{articlePreview}</p>
          </div>
        </div>
      </section>
      <section className="article-container">
        <div className="article-wrapper mt-[56px] ">
          <div className="article-body">
            <p>
              {articleText.split("\n").map((v, i) => {
                const isLast = i == articleText.split("\n").length - 1;
                return (
                  <Fragment key={i}>
                    <span>{v}</span>
                    {!isLast && (
                      <>
                        <br /> <br />
                      </>
                    )}
                  </Fragment>
                );
              })}
            </p>
          </div>

          {galleryImages.length > 0 && (
            <div className="article-gallery">
              {galleryImages.map(({ filename, caption }, i) => {
                const imagePath =
                  "/assets/articles/gallery/" + galleryFolder + "/";
                return (
                  <div className="gallery-item" key={i}>
                    <div
                      className="image-wrapper"
                      onClick={() => {
                        setModalData({
                          src: imagePath + filename,
                          caption: caption,
                        });
                        setImageModalActive(true);
                      }}
                    >
                      <img src={imagePath + filename} alt={caption} />
                    </div>
                    <p className="gallery-caption article-caption">{caption}</p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="latest-articles">
            <div className="flex items-center justify-start mb-[24px]">
              <p className="section-title">Latest Articles</p>
            </div>
            <div className="articles mb-[24px]">
              {latestArticles.map((a, i) => {
                if (a.articleTitle != "") {
                  return (
                    <ArticleItem
                      article={a}
                      key={`${a.source}-${a.id ?? a.articleID ?? i}`}
                    />
                  );
                }
              })}
            </div>
            <div className="flex items-center justify-end">
              <Link
                to="/articles"
                className="prod-btn-lg prod-btn-secondary flex items-center"
              >
                <span className="me-[8px]">See All Articles</span>
                <Icon
                  iconName="ArrowRight"
                  height="24px"
                  width="24px"
                  fill="#8693A0"
                />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <HomeFooter />

      {imageModalActive && (
        <div className="image-modal">
          <div
            className="image-modal-backdrop"
            onClick={() => {
              setImageModalActive(false);
              setModalData({ src: "", caption: "" });
            }}
          ></div>
          <div className="image-modal-container">
            <div className="image-wrapper">
              <img src={modalData.src} alt={modalData.caption} />
            </div>
            <p className="image-caption">{modalData.caption}</p>
            <div
              className="close-icon"
              onClick={() => {
                setImageModalActive(false);
                setModalData({ src: "", caption: "" });
              }}
            >
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
export default ArticlePage;
