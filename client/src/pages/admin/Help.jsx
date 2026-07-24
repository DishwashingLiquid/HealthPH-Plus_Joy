import { NavLink } from "react-router-dom";
import Icon from "../../components/Icon";
import Input from "../../components/Input";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import ScrollToTop from "../../components/ScrollToTop";
import Highlighter from "react-highlight-words";
import useDeviceDetect from "../../hooks/useDeviceDetect";
import "../../assets/css/help.css";

import HelpImage from "../../components/admin/HelpImage";

const Help = () => {
  const user = useSelector((state) => state.auth.user);
  const isAdminUser = ["ADMIN", "SUPERADMIN"].includes(user.user_type);

  const { isPWA } = useDeviceDetect();

  const [search, setSearch] = useState("");

  const TOCAdmin = useMemo(() => [
    { id: "navigation", label: "Navigation", hasSubItems: false },
    {
      id: "ai-surveillance",
      label: "AI Surveillance",
      hasSubItems: true,
      subItems: [
        {
          id: "ai-surveillance-outbreak-monitoring",
          label: "Real-time Outbreak Monitoring",
        },
      ],
    },
    {
      id: "nlp-insights",
      label: "NLP Insights",
      hasSubItems: true,
      subItems: [
        { id: "nlp-insights-named-entity-recognition", label: "Named Entity Recognition" },
        { id: "nlp-insights-sentiment-analysis", label: "Sentiment Analysis" },
        { id: "nlp-insights-language-detection", label: "Language Detection" },
      ],
    },
    {
      id: "misinformation-tracker",
      label: "Misinformation Tracker",
      hasSubItems: false,
    },
    {
      id: "user-management",
      label: "User Management",
      hasSubItems: true,
      subItems: [{ id: "user-management-add-user", label: "Add User" }],
    },
    {
      id: "model-access-toolkit",
      label: "Model Access and Toolkit",
      hasSubItems: true,
      subItems: [
        { id: "model-access-toolkit-model-comparison", label: "Model Comparison" },
        { id: "model-access-toolkit-data-management", label: "Data Management" },
        { id: "model-access-toolkit-training-logs", label: "Training Logs" },
      ],
    },
    {
      id: "disease-watch-feed",
      label: "Disease Watch Feed",
      hasSubItems: true,
      subItems: [
        { id: "disease-watch-feed-recent-alerts", label: "Recent Alerts" },
        { id: "disease-watch-feed-regional-coverage", label: "Regional Coverage" },
        { id: "disease-watch-feed-user-analytics", label: "User Analytics" },
      ],
    },
    {
      id: "health-literacy-hub",
      label: "Health Literacy Hub",
      hasSubItems: true,
      subItems: [
        { id: "health-literacy-hub-articles", label: "Articles" },
        { id: "health-literacy-hub-videos", label: "Videos" },
        { id: "health-literacy-hub-infographics", label: "Infographics" },
        { id: "health-literacy-hub-analytics", label: "Analytics" },
      ],
    },
    {
      id: "sentiment-pulse-tool",
      label: "Sentiment Pulse Tool",
      hasSubItems: true,
      subItems: [
        { id: "sentiment-pulse-tool-sentiment-trends", label: "Sentiment Trends" },
        { id: "sentiment-pulse-tool-regional-analysis", label: "Regional Analysis" },
        { id: "sentiment-pulse-tool-mobile-surveys", label: "Mobile Surveys" },
      ],
    },
    { id: "activity-logs", label: "Activity Logs", hasSubItems: false },
    { id: "settings", label: "Settings", hasSubItems: false },
  ], []);

  const TOCUser = useMemo(() => [
    { id: "navigation", label: "Navigation", hasSubItems: false },
    { id: "analytics", label: "Analytics", hasSubItems: false },
    {
      id: "trends-map",
      label: "Trends Map",
      hasSubItems: true,
      subItems: [
        { id: "map", label: "Map" },
        { id: "list-view", label: "List View" },
      ],
    },
    { id: "settings", label: "Settings", hasSubItems: false },
  ], []);

  const TOC = useMemo(
    () => (isAdminUser ? TOCAdmin : TOCUser),
    [TOCAdmin, TOCUser, isAdminUser]
  );

  const [tocActive, setTOCActive] = useState(false);
  const [tocAnimate, setTOCAnimate] = useState("");

  const handleAnimationEnd = () => {
    const toc = document.getElementById("toc");
    if (toc.classList.contains("hide-toc")) {
      setTOCAnimate("");
    }
  };

  const handleClick = () => {
    setTOCActive(!tocActive);
    setTOCAnimate(!tocAnimate ? "show-toc" : "hide-toc");
  };

  const handleSelectSection = (id) => {
    handleClick();
    document.getElementById(id).scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const helpSectionsAdmin = [
    {
      sectionName: "Navigation",
      sectionId: "navigation",
      description: [
        {
          sectionDesc:
            "The application provides the user a simple navigation to go through the dashboard. The two mains modules are the Analytics and Trends Map. Moreover, the user can manage their personal information in using the application.",
          sectionImage: <HelpImage image="admin-navigation" />,
        },
      ],
    },
    {
      sectionName: "AI Surveillance",
      sectionId: "ai-surveillance",
      description: [
        {
          sectionDesc:
            "AI Surveillance gives admins a dashboard for monitoring public health signals, potential outbreak activity, and regional health patterns from the main dashboard view.",
          sectionImage: <HelpImage image="admin-outbreak-monitoring" />,
        },
      ],
      subSections: [
        {
          sectionId: "ai-surveillance-outbreak-monitoring",
          sectionName: "Real-time Outbreak Monitoring",
          description: [
            {
              sectionDesc:
                "Real-time Outbreak Monitoring helps admins review live outbreak indicators and location-based health signals that may require follow-up.",
              sectionImage: <HelpImage image="admin-outbreak-monitoring" />,
            },
          ],
        },
      ],
    },
    {
      sectionName: "NLP Insights",
      sectionId: "nlp-insights",
      description: [
        {
          sectionDesc:
            "NLP Insights provides language-based analysis tools that help admins review health-related text for entities, sentiment, and language signals.",
          sectionImage: <HelpImage image="admin-NLP-Insights" />,
        },
      ],
      subSections: [
        {
          sectionId: "nlp-insights-named-entity-recognition",
          sectionName: "Named Entity Recognition",
          description: [
            {
              sectionDesc:
                "Named Entity Recognition identifies important health-related names, places, organizations, and terms from submitted text.",
              sectionImage: (
                <HelpImage image="admin-NLP-Insights-Named-Entity-Recognition" />
              ),
            },
          ],
        },
        {
          sectionId: "nlp-insights-sentiment-analysis",
          sectionName: "Sentiment Analysis",
          description: [
            {
              sectionDesc:
                "Sentiment Analysis helps admins understand the emotional tone and public response patterns found in health-related text.",
              sectionImage: (
                <HelpImage image="admin-NLP-Insights-Sentiment-Analysis" />
              ),
            },
          ],
        },
        {
          sectionId: "nlp-insights-language-detection",
          sectionName: "Language Detection",
          description: [
            {
              sectionDesc:
                "Language Detection identifies the language used in submitted text so admins can better understand and classify multilingual reports.",
              sectionImage: (
                <HelpImage image="admin-NLP-Insights-Language-Detection" />
              ),
            },
          ],
        },
      ],
    },
    {
      sectionName: "Misinformation Tracker",
      sectionId: "misinformation-tracker",
      description: [
        {
          sectionDesc:
            "Misinformation Tracker helps admins monitor active misinformation claims, review source distribution, and track misinformation trends across regions.",
          sectionImage: <HelpImage image="admin-Misinformation-Tracker" />,
        },
      ],
    },
    {
      sectionName: "User Management",
      sectionId: "user-management",
      description: [
        {
          sectionDesc:
            "User Management provides admins and super admins with tools to manage user accounts, review account status, and maintain access to HealthPH+.",
          sectionImage: <HelpImage image="admin-user-management" />,
        },
      ],
      subSections: [
        {
          sectionId: "user-management-add-user",
          sectionName: "Add User",
          description: [
            {
              sectionDesc:
                "The Add User form allows admins and super admins to create new accounts and assign the correct user information, status, and access details.",
              sectionImage: <HelpImage image="admin-add-user" />,
            },
          ],
        },
      ],
    },
    {
      sectionName: "Model Access and Toolkit",
      sectionId: "model-access-toolkit",
      description: [
        {
          sectionDesc:
            "Model Access and Toolkit supports model review, dataset management, and training log monitoring for admins working with HealthPH+ model resources.",
        },
      ],
      subSections: [
        {
          sectionId: "model-access-toolkit-model-comparison",
          sectionName: "Model Comparison",
          description: [
            {
              sectionDesc:
                "Model Comparison lets admins compare available models and review their performance information side by side.",
              sectionImage: (
                <HelpImage image="admin-Model-Access-Toolkit-Model-Comparison" />
              ),
            },
          ],
        },
        {
          sectionId: "model-access-toolkit-data-management",
          sectionName: "Data Management",
          description: [
            {
              sectionDesc:
                "Data Management helps admins organize datasets used by the model toolkit and review dataset records from the dashboard.",
              sectionImage: (
                <HelpImage image="admin-Model-Access-Toolkit-Data-Management" />
              ),
            },
          ],
        },
        {
          sectionId: "model-access-toolkit-training-logs",
          sectionName: "Training Logs",
          description: [
            {
              sectionDesc:
                "Training Logs show recent model training activity and help admins review training status, dates, and related model details.",
              sectionImage: (
                <HelpImage image="admin-Model-Access-Toolkit-Training-Logs" />
              ),
            },
          ],
        },
      ],
    },
    {
      sectionName: "Disease Watch Feed",
      sectionId: "disease-watch-feed",
      description: [
        {
          sectionDesc:
            "Disease Watch Feed helps admins review alert activity, regional coverage, and user engagement signals connected to mobile health reporting.",
        },
      ],
      subSections: [
        {
          sectionId: "disease-watch-feed-recent-alerts",
          sectionName: "Recent Alerts",
          description: [
            {
              sectionDesc:
                "Recent Alerts shows newly detected warning signals and reports that admins can review for possible response actions.",
              sectionImage: <HelpImage image="admin-Disease-Watch-Feed-Recent-Alerts" />,
            },
          ],
        },
        {
          sectionId: "disease-watch-feed-regional-coverage",
          sectionName: "Regional Coverage",
          description: [
            {
              sectionDesc:
                "Regional Coverage displays disease watch activity by area so admins can compare coverage and report distribution across regions.",
              sectionImage: (
                <HelpImage image="admin-Disease-Watch-Feed-Regional-Coverage" />
              ),
            },
          ],
        },
        {
          sectionId: "disease-watch-feed-user-analytics",
          sectionName: "User Analytics",
          description: [
            {
              sectionDesc:
                "User Analytics summarizes user engagement with alerts, reports, and disease watch activity from connected channels.",
              sectionImage: <HelpImage image="admin-Disease-Watch-Feed-User-Analytics" />,
            },
          ],
        },
      ],
    },
    {
      sectionName: "Health Literacy Hub",
      sectionId: "health-literacy-hub",
      description: [
        {
          sectionDesc:
            "Health Literacy Hub lets admins manage educational health content and review analytics for articles, videos, and infographics.",
        },
      ],
      subSections: [
        {
          sectionId: "health-literacy-hub-articles",
          sectionName: "Articles",
          description: [
            {
              sectionDesc:
                "Articles provides tools for creating, editing, publishing, and managing text-based health literacy content.",
              sectionImage: <HelpImage image="admin-Health-Literacy-Hub-Articles" />,
            },
          ],
        },
        {
          sectionId: "health-literacy-hub-videos",
          sectionName: "Videos",
          description: [
            {
              sectionDesc:
                "Videos allows admins to manage video-based health literacy content for public and mobile audiences.",
              sectionImage: <HelpImage image="admin-Health-Literacy-Hub-Videos" />,
            },
          ],
        },
        {
          sectionId: "health-literacy-hub-infographics",
          sectionName: "Infographics",
          description: [
            {
              sectionDesc:
                "Infographics supports visual health education content management, including infographic publishing and review.",
              sectionImage: (
                <HelpImage image="admin-Health-Literacy-Hub-Infographics" />
              ),
            },
          ],
        },
        {
          sectionId: "health-literacy-hub-analytics",
          sectionName: "Analytics",
          description: [
            {
              sectionDesc:
                "Analytics summarizes Health Literacy Hub content performance and audience engagement across content types.",
              sectionImage: <HelpImage image="admin-Health-Literacy-Hub-Analytics" />,
            },
          ],
        },
      ],
    },
    {
      sectionName: "Sentiment Pulse Tool",
      sectionId: "sentiment-pulse-tool",
      description: [
        {
          sectionDesc:
            "Sentiment Pulse Tool helps admins monitor public sentiment, compare regional sentiment, and manage mobile survey activity.",
        },
      ],
      subSections: [
        {
          sectionId: "sentiment-pulse-tool-sentiment-trends",
          sectionName: "Sentiment Trends",
          description: [
            {
              sectionDesc:
                "Sentiment Trends shows changes in public sentiment over time to help admins review emerging response patterns.",
              sectionImage: (
                <HelpImage image="admin-Sentiment-Pulse-Tool-Sentiment-Trends" />
              ),
            },
          ],
        },
        {
          sectionId: "sentiment-pulse-tool-regional-analysis",
          sectionName: "Regional Analysis",
          description: [
            {
              sectionDesc:
                "Regional Analysis compares sentiment data by region so admins can identify geographic differences in public response.",
              sectionImage: (
                <HelpImage image="admin-Sentiment-Pulse-Tool-Regional-Analysis" />
              ),
            },
          ],
        },
        {
          sectionId: "sentiment-pulse-tool-mobile-surveys",
          sectionName: "Mobile Surveys",
          description: [
            {
              sectionDesc:
                "Mobile Surveys lets admins schedule, review, and manage survey activity used to collect public sentiment responses.",
              sectionImage: (
                <HelpImage image="admin-Sentiment-Pulse-Tool-Mobile-Surveys" />
              ),
            },
          ],
        },
      ],
    },
    {
      sectionName: "Activity Logs",
      sectionId: "activity-logs",
      description: [
        {
          sectionDesc:
            "This module provides every admin to monitor the user activities of all types of users.",
          sectionImage: <HelpImage image="admin-activity-logs" />,
        },
      ],
    },
    {
      sectionName: "Settings",
      sectionId: "settings",
      description: [
        {
          sectionDesc:
            "This module provides every user to edit their personal information, email address, password, and the ability to delete their account. Moreover, every user can check their current status if they can use HealthPH. If a user's status is 'active', they can use the application with their respective privilege and user type. In the case of their status labeled as 'inactive', they are unable to navigate the application can only access the Settings module.",
          sectionImage: <HelpImage image="admin-settings" />,
        },
      ],
    },
  ];

  const helpSectionsUser = [
    {
      sectionName: "Navigation",
      sectionId: "navigation",
      description: [
        {
          sectionDesc:
            "The application provides the user a simple navigation to go through the dashboard. The two mains modules are the Analytics and Trends Map. Moreover, the user can manage their personal information in using the application.",
          sectionImage: <HelpImage image="user-navigation" />,
        },
      ],
    },
    {
      sectionName: "Analytics",
      sectionId: "analytics",
      description: [
        {
          sectionDesc:
            "Once every user have successfully signed in to HealthPH, the user is directed to the Analytics Page that are consist of summary of data, visualization charts, and many more. The user can filter the data by region and print them in PDF form.",
          sectionImage: <HelpImage image="user-analytics" />,
        },
      ],
    },
    {
      sectionName: "Trends Map",
      sectionId: "trends-map",
      description: [
        {
          sectionDesc:
            "The main module of HealthPH is the Trends Map. The admin is provided with a map of the Philippines to track suspected symptoms in all 17 administrative regions.",
          sectionImage: <HelpImage image="user-trends-map" />,
        },
      ],
      subSections: [
        {
          sectionId: "map",
          sectionName: "Map",
          description: [
            {
              sectionDesc:
                "By navigating with the map, there are 4 types of colored circles called suspected symptoms. These 4 types of circles are plotted around the map of the Philippines and are categorized as PTB, Pneumonia, COVID, and AURI. In validating the date of these plotted suspected symptoms, there is a label indicating the recency of the data being displayed.",
              sectionImage: <HelpImage image="user-map" />,
            },
            {
              sectionDesc:
                "Moreover, the map allows every users to zoom in and out of the map and redirect them to their current location.",
              sectionImage: <HelpImage image="user-map-2" />,
            },
          ],
        },
        {
          sectionId: "list-view",
          sectionName: "List View",
          description: [
            {
              sectionDesc:
                "Other than viewing the data using the map, every user can view the data in list view. The list view provides the admin to filter the data by region/s, upload data sets, and view each suspected symptoms in a list.",
              sectionImage: <HelpImage image="user-list-view" />,
            },
          ],
        },
      ],
    },
    {
      sectionName: "Settings",
      sectionId: "settings",
      description: [
        {
          sectionDesc:
            "This module provides every user to edit their personal information, email address, password, and the ability to delete their account. Moreover, every user can check their current status if they can use HealthPH. If a user's status is 'active', they can use the application with their respective privilege and user type. In the case of their status labeled as 'inactive', they are unable to navigate the application can only access the Settings module.",
          sectionImage: <HelpImage image="user-settings" />,
        },
      ],
    },
  ];

  const getContent = () => {
    return isAdminUser ? helpSectionsAdmin : helpSectionsUser;
  };

  const [currentTOCActive, setCurrentTOCActive] = useState("navigation");

  useEffect(() => {
    const handleTOCActive = () => {
      const sections = [];

      TOC.map(({ id, hasSubItems, subItems }) => {
        if (["user-management", "activity-logs"].includes(id) && isPWA) {
          return;
        }
        sections.push({
          id: id,
          rect: document.getElementById(id).getBoundingClientRect(),
        });
        if (hasSubItems) {
          subItems.map(({ id }) => {
            if (["upload-dataset"].includes(id) && isPWA) {
              return;
            }
            sections.push({
              id: id,
              rect: document.getElementById(id).getBoundingClientRect(),
            });
          });
        }
      });

      let flag = "";

      sections.map(({ id, rect }) => {
        if (rect.y < 280) {
          flag = id;
        }
      });

      setCurrentTOCActive((current) => (current !== flag ? flag : current));
    };

    const el = document.getElementsByTagName("main")[0];

    el.addEventListener("scroll", handleTOCActive);

    return () => el.removeEventListener("scroll", handleTOCActive);
  }, [TOC, isPWA]);

  return (
    <>
      <div className="admin-wrapper flex flex-col h-full">
        <div className="header flex-col sm:flex-row">
          <div className="breadcrumbs-wrapper me-[16px]">
            <div className="breadcrumb-item">
              <NavLink to="/dashboard/help">Help</NavLink>
              <Icon
                iconName="ChevronRight"
                height="16px"
                width="16px"
                fill="#A1ACB8"
                className="icon"
              />
            </div>
          </div>
          <div className="flex items-start sm:items-center mt-[20px] sm:mt-0 flex-col sm:flex-row">
            <Input
              size="input-md"
              id="search"
              additionalClasses="w-full max-w-full sm:max-w-[328px]"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leadingIcon="Search"
              trailingIcon={search.length > 0 ? "Close" : undefined}
              onClickTrailing={
                search.length > 0 ? () => setSearch("") : undefined
              }
            />
            <a
              className="prod-btn-base prod-btn-secondary flex-shrink-0 mt-[16px] sm:mt-0 ms-0 sm:ms-[16px]"
              href={`mailto:${import.meta.env.VITE_HEALTHPH_EMAIL}`}
            >
              Report Issue
            </a>
            {/* <button
              type="button"
              className="prod-btn-base prod-btn-secondary flex items-center flex-shrink-0 ms-0 sm:ms-[16px] mt-[16px] sm:mt-0"
            >
              <span>Download User Manual</span>
              <Icon
                iconName="Download"
                height="20px"
                width="20px"
                fill="#8693A0"
                className="ms-[8px]"
              />
            </button> */}
          </div>
        </div>

        <div className="help-container">
          <div className={`table-of-contents ${tocAnimate}`} id="toc">
            <div className="toc-backdrop" onAnimationEnd={handleAnimationEnd}>
              <div className="close" onClick={handleClick}>
                <Icon
                  iconName="Close"
                  height="30px"
                  width="30px"
                  stroke="#FFF"
                  className="icon"
                />
              </div>
            </div>

            {/* TOC WRAPPER */}
            <div className="toc-wrapper">
              <div className="toc-header">Modules</div>
              <ul>
                {TOC.map(({ id, label, hasSubItems, subItems }, i) => {
                  if (
                    ["user-management", "activity-logs"].includes(id) &&
                    isPWA
                  ) {
                    return null;
                  }
                  return !hasSubItems ? (
                    <li
                      className={`toc-item ${
                        id == currentTOCActive ? "active" : ""
                      }`}
                      key={i}
                      onClick={() => handleSelectSection(id)}
                    >
                      {label}
                    </li>
                  ) : (
                    <Fragment key={i}>
                      <li
                        className={`toc-item ${
                          id == currentTOCActive ? "active" : ""
                        }`}
                        onClick={() => handleSelectSection(id)}
                      >
                        {label}
                      </li>
                      {subItems.map(({ id, label }, i) => {
                        const arr = !isPWA
                          ? subItems
                          : subItems.filter(
                              (s) => !["upload-dataset"].includes(s.id)
                            );
                        const isLast = i == arr.length - 1;
                        if (["upload-dataset"].includes(id) && isPWA) {
                          return null;
                        }
                        return (
                          <li
                            className={`toc-sub-item ${
                              isLast ? "mb-[16px]" : ""
                            } ${id == currentTOCActive ? "active" : ""}`}
                            key={i}
                            onClick={() => handleSelectSection(id)}
                          >
                            <Icon
                              iconName={isLast ? "ListEnd" : "List"}
                              height={isLast ? "31px" : "52px"}
                              width="10px"
                              fill="#CCC"
                              className="icon"
                            />
                            <span>{label}</span>
                          </li>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </ul>
            </div>
          </div>
          {/* TOC Toggler */}
          <div className="toc-toggler">
            <div className="toggler-button" onClick={handleClick}>
              <Icon
                iconName="UnorderedList"
                stroke="#000"
                className="icon"
                height="24px"
                width="24px"
              />
            </div>
          </div>
          {/* HELP CONTENT */}
          <div className="help-content" id="help-content">
            {getContent().map(
              ({ sectionName, sectionId, description, subSections }, i) => {
                if (
                  ["user-management", "activity-logs"].includes(sectionId) &&
                  isPWA
                ) {
                  return null;
                }
                return (
                  <div key={i} className="help-content-section" id={sectionId}>
                    <p className="help-content-heading">{sectionName}</p>
                    {description.map(({ sectionDesc, sectionImage }, i) => {
                      return (
                        <Fragment key={i}>
                          <p className="help-content-desc">
                            <Highlighter
                              highlightClassName="bg-[#FFE81A] text-[#000] font-medium rounded-[2px]"
                              searchWords={[search]}
                              autoEscape={true}
                              textToHighlight={sectionDesc}
                            />
                          </p>
                          {sectionImage}
                        </Fragment>
                      );
                    })}
                    {subSections &&
                      subSections.map(
                        ({ sectionId, sectionName, description }, i) => {
                          if (["upload-dataset"].includes(sectionId) && isPWA) {
                            return null;
                          }
                          return (
                            <Fragment key={i}>
                              <p
                                className="help-content-subheading"
                                id={sectionId}
                              >
                                {sectionName}
                              </p>
                              {description.map(
                                ({ sectionDesc, sectionImage }, i) => {
                                  return (
                                    <Fragment key={i}>
                                      <p className="help-content-desc">
                                        <Highlighter
                                          highlightClassName="bg-[#FFE81A] text-[#000] font-medium rounded-[2px]"
                                          searchWords={[search]}
                                          autoEscape={true}
                                          textToHighlight={sectionDesc}
                                        />
                                      </p>
                                      {sectionImage}
                                    </Fragment>
                                  );
                                }
                              )}
                            </Fragment>
                          );
                        }
                      )}
                  </div>
                );
              }
            )}
          </div>
        </div>
      </div>
      <ScrollToTop />
    </>
  );
};
export default Help;
