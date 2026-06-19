import { Fragment, useEffect, useMemo, useState } from "react";
import Highlighter from "react-highlight-words";
import { useSelector } from "react-redux";
import { NavLink } from "react-router-dom";
import HelpImage from "../../components/admin/HelpImage";
import Icon from "../../components/Icon";
import Input from "../../components/Input";
import ScrollToTop from "../../components/ScrollToTop";
import useDeviceDetect from "../../hooks/useDeviceDetect";

const PWA_HIDDEN_SECTION_IDS = ["user-management", "activity-logs"];
const PWA_HIDDEN_SUBSECTION_IDS = [];

const TOCAdmin = [
  { id: "navigation", label: "Navigation", hasSubItems: false },
  {
    id: "ai-surveillance",
    label: "AI Surveillance",
    hasSubItems: true,
    subItems: [
      {
        id: "ai-real-time-outbreak-monitoring",
        label: "Real-time Outbreak Monitoring",
      },
    ],
  },
  {
    id: "nlp-insights",
    label: "NLP Insights",
    hasSubItems: true,
    subItems: [
      { id: "nlp-ner", label: "Named Entity Recognition" },
      { id: "nlp-sentiment-analysis", label: "Sentiment Analysis" },
      { id: "nlp-language-detection", label: "Language Detection" },
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
    subItems: [
      { id: "user-management-admins", label: "Admins" },
      { id: "user-management-users", label: "Users" },
    ],
  },
  {
    id: "model-access-toolkit",
    label: "Model Access and Toolkit",
    hasSubItems: true,
    subItems: [
      { id: "model-comparison", label: "Model Comparison" },
      { id: "model-data-management", label: "Data Management" },
      { id: "model-training-logs", label: "Training Logs" },
    ],
  },
  {
    id: "disease-watch-feed",
    label: "Disease Watch Feed",
    hasSubItems: true,
    subItems: [
      { id: "disease-recent-alerts", label: "Recent Alerts" },
      { id: "disease-regional-coverage", label: "Regional Coverage" },
      { id: "disease-user-analytics", label: "User Analytics" },
    ],
  },
  {
    id: "health-literacy-hub",
    label: "Health Literacy Hub",
    hasSubItems: true,
    subItems: [
      { id: "health-literacy-articles", label: "Articles" },
      { id: "health-literacy-videos", label: "Videos" },
      { id: "health-literacy-infographics", label: "Infographics" },
      { id: "health-literacy-analytics", label: "Analytics" },
    ],
  },
  {
    id: "sentiment-pulse-tool",
    label: "Sentiment Pulse Tool",
    hasSubItems: true,
    subItems: [
      { id: "sentiment-trends", label: "Sentiment Trends" },
      { id: "sentiment-regional-analysis", label: "Regional Analysis" },
      { id: "sentiment-mobile-surveys", label: "Mobile Surveys" },
    ],
  },
  { id: "activity-logs", label: "Activity Logs", hasSubItems: false },
  { id: "settings", label: "Settings", hasSubItems: false },
];

const TOCUser = [
  { id: "navigation", label: "Navigation", hasSubItems: false },
  {
    id: "ai-surveillance",
    label: "AI Surveillance",
    hasSubItems: true,
    subItems: [
      {
        id: "ai-real-time-outbreak-monitoring",
        label: "Real-time Outbreak Monitoring",
      },
    ],
  },
  {
    id: "nlp-insights",
    label: "NLP Insights",
    hasSubItems: true,
    subItems: [
      { id: "nlp-ner", label: "Named Entity Recognition" },
      { id: "nlp-sentiment-analysis", label: "Sentiment Analysis" },
      { id: "nlp-language-detection", label: "Language Detection" },
    ],
  },
  {
    id: "misinformation-tracker",
    label: "Misinformation Tracker",
    hasSubItems: false,
  },
  {
    id: "model-access-toolkit",
    label: "Model Access and Toolkit",
    hasSubItems: true,
    subItems: [
      { id: "model-comparison", label: "Model Comparison" },
      { id: "model-data-management", label: "Data Management" },
      { id: "model-training-logs", label: "Training Logs" },
    ],
  },
  {
    id: "disease-watch-feed",
    label: "Disease Watch Feed",
    hasSubItems: true,
    subItems: [
      { id: "disease-recent-alerts", label: "Recent Alerts" },
      { id: "disease-regional-coverage", label: "Regional Coverage" },
      { id: "disease-user-analytics", label: "User Analytics" },
    ],
  },
  {
    id: "health-literacy-hub",
    label: "Health Literacy Hub",
    hasSubItems: true,
    subItems: [
      { id: "health-literacy-articles", label: "Articles" },
      { id: "health-literacy-videos", label: "Videos" },
      { id: "health-literacy-infographics", label: "Infographics" },
      { id: "health-literacy-analytics", label: "Analytics" },
    ],
  },
  {
    id: "sentiment-pulse-tool",
    label: "Sentiment Pulse Tool",
    hasSubItems: true,
    subItems: [
      { id: "sentiment-trends", label: "Sentiment Trends" },
      { id: "sentiment-regional-analysis", label: "Regional Analysis" },
      { id: "sentiment-mobile-surveys", label: "Mobile Surveys" },
    ],
  },
  { id: "settings", label: "Settings", hasSubItems: false },
];

const helpSectionsAdmin = [
  {
    sectionName: "Navigation",
    sectionId: "navigation",
    description: [
      {
        sectionDesc:
          "The admin dashboard provides access to AI Surveillance, NLP Insights, Misinformation Tracker, User Management, Model Access and Toolkit, Disease Watch Feed, Health Literacy Hub, Sentiment Pulse Tool, Activity Logs, and Settings. Use the sidebar to move between dashboards and the top navigation to open Help, account settings, and issue reporting.",
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
          "AI Surveillance is the main overview for disease monitoring. It combines summary cards for suspected cases, active regions, respiratory alerts, and high-risk areas with a real-time outbreak map, environmental data, AI insights, a respiratory monitoring line chart, a trend forecasting area chart, and a suspected conditions percentage pie chart.",
        sectionImage: <HelpImage image="admin-ai-surveillance" />,
      },
    ],
    subSections: [
      {
        sectionId: "ai-real-time-outbreak-monitoring",
        sectionName: "Real-time Outbreak Monitoring",
        description: [
          {
            sectionDesc:
              "Real-time Outbreak Monitoring displays a Philippine map of suspected disease points inside the AI Surveillance dashboard. Admins can use region, disease, and time range filters to review national outbreak signals, inspect suspected PTB, Pneumonia, COVID, and AURI markers, and interact with the shared map through zooming, panning, and location controls.",
            sectionImage: (
              <HelpImage image="admin-ai-real-time-outbreak-monitoring" />
            ),
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
          "NLP Insights organizes multilingual text analysis into tabs for entity extraction, sentiment analysis, and language detection. Admins can review detected diseases, symptoms, locations, common words, word clouds, sentiment graphs, and language distribution charts.",
        sectionImage: <HelpImage image="admin-nlp-insights" />,
      },
    ],
    subSections: [
      {
        sectionId: "nlp-ner",
        sectionName: "Named Entity Recognition",
        description: [
          {
            sectionDesc:
              "The Named Entity Recognition tab shows disease, symptom, and location panels, a sample NER demo with highlighted health terms, a top words bar chart, and a word cloud. Use the filters to review terms by region when regional data is available.",
            sectionImage: <HelpImage image="admin-nlp-ner" />,
          },
        ],
      },
      {
        sectionId: "nlp-sentiment-analysis",
        sectionName: "Sentiment Analysis",
        description: [
          {
            sectionDesc:
              "The Sentiment Analysis tab summarizes positive, neutral, and negative public sentiment with a distribution pie chart, a sentiment-by-region bar chart, and a sentiment trends line chart over time.",
            sectionImage: <HelpImage image="admin-nlp-sentiment-analysis" />,
          },
        ],
      },
      {
        sectionId: "nlp-language-detection",
        sectionName: "Language Detection",
        description: [
          {
            sectionDesc:
              "The Language Detection tab shows the language distribution pie chart, language distribution by region bar chart, and model performance cards for English, Filipino, Cebuano, Ilocano, and Hiligaynon detection accuracy.",
            sectionImage: <HelpImage image="admin-nlp-language-detection" />,
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
          "Misinformation Tracker helps admins monitor health misinformation claims. It includes time, region, impact, and search filters; summary cards for active misinformation, daily mentions, response rate, and social reach; a misinformation trend line chart; a source distribution pie chart; and a claims table with impact, status, and action controls.",
        sectionImage: <HelpImage image="admin-misinformation-tracker" />,
      },
    ],
  },
  {
    sectionName: "User Management",
    sectionId: "user-management",
    description: [
      {
        sectionDesc:
          "User Management is available to admins and super admins for maintaining HealthPH accounts. It provides Admins and Users tabs, account status controls, profile details, table search and pagination, report generation, and add-user access when permitted by role.",
        sectionImage: <HelpImage image="admin-user-management" />,
      },
    ],
    subSections: [
      {
        sectionId: "user-management-admins",
        sectionName: "Admins",
        description: [
          {
            sectionDesc:
              "The Admins tab lists administrative users, their status, contact details, and available account actions. Super admins can manage elevated account privileges and remove users when allowed.",
            sectionImage: <HelpImage image="admin-add-user" />,
          },
        ],
      },
      {
        sectionId: "user-management-users",
        sectionName: "Users",
        description: [
          {
            sectionDesc:
              "The Users tab lists standard dashboard users, including assigned regions and account status. Admins can review records, update eligible accounts, and generate user reports.",
            sectionImage: <HelpImage image="admin-user-management-users" />,
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
          "Model Access and Toolkit supports model evaluation and dataset operations for health surveillance workflows. It contains tabs for comparing models, managing uploaded datasets, and reviewing training logs.",
        sectionImage: <HelpImage image="admin-model-access-toolkit" />,
      },
    ],
    subSections: [
      {
        sectionId: "model-comparison",
        sectionName: "Model Comparison",
        description: [
          {
            sectionDesc:
              "The Model Comparison tab includes model filters, model search, a performance comparison bar chart for F1 score, precision, recall, and accuracy, plus model cards with score summaries and comparison actions.",
            sectionImage: <HelpImage image="admin-model-comparison" />,
          },
        ],
      },
      {
        sectionId: "model-data-management",
        sectionName: "Data Management",
        description: [
          {
            sectionDesc:
              "The Data Management tab shows datasets used for model training, validation, and evaluation. The dataset table includes file name, size, status, uploader, upload date, and actions such as preview, download, or delete when available.",
            sectionImage: <HelpImage image="admin-model-data-management" />,
          },
        ],
      },
      {
        sectionId: "model-training-logs",
        sectionName: "Training Logs",
        description: [
          {
            sectionDesc:
              "The Training Logs tab tracks model runs, datasets, processing status, start time, duration, and available view or export actions. Use this tab to audit training activity and troubleshoot failed or queued runs.",
            sectionImage: <HelpImage image="admin-model-training-logs" />,
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
          "Disease Watch Feed monitors mobile and community disease signals. It opens with alert distribution, early warning, and symptom report metrics, then separates alert review, regional coverage, and user engagement into tabs.",
        sectionImage: <HelpImage image="admin-disease-watch-feed" />,
      },
    ],
    subSections: [
      {
        sectionId: "disease-recent-alerts",
        sectionName: "Recent Alerts",
        description: [
          {
            sectionDesc:
              "The Recent Alerts tab lists detected disease alerts with disease name, alert type, region, timestamp, and short summary. Use it to scan new warnings and recent symptom activity.",
            sectionImage: <HelpImage image="admin-disease-recent-alerts" />,
          },
        ],
      },
      {
        sectionId: "disease-regional-coverage",
        sectionName: "Regional Coverage",
        description: [
          {
            sectionDesc:
              "The Regional Coverage tab includes a registered-users-by-region bar chart, a region filter, and regional cards with user counts and percentage bars. It helps identify where the mobile network has stronger or weaker coverage.",
            sectionImage: <HelpImage image="admin-disease-regional-coverage" />,
          },
        ],
      },
      {
        sectionId: "disease-user-analytics",
        sectionName: "User Analytics",
        description: [
          {
            sectionDesc:
              "The User Analytics tab summarizes total users, alert open rate, and submitted symptom reports with month-over-month trend indicators.",
            sectionImage: <HelpImage image="admin-disease-user-analytics" />,
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
          "Health Literacy Hub manages educational resources and monitors how audiences interact with them. Admins can work with articles, videos, infographics, and analytics for content views, content pieces, engagement rate, and top-performing resources.",
        sectionImage: <HelpImage image="admin-health-literacy-hub" />,
      },
    ],
    subSections: [
      {
        sectionId: "health-literacy-articles",
        sectionName: "Articles",
        description: [
          {
            sectionDesc:
              "The Articles tab supports creating, editing, previewing, publishing, archiving, and organizing written health literacy content with titles, topics, tags, summaries, and article media.",
            sectionImage: <HelpImage image="admin-health-literacy-articles" />,
          },
        ],
      },
      {
        sectionId: "health-literacy-videos",
        sectionName: "Videos",
        description: [
          {
            sectionDesc:
              "The Videos tab manages video-based resources, including metadata, audience targeting, upload or preview media, and content status controls.",
            sectionImage: <HelpImage image="admin-health-literacy-videos" />,
          },
        ],
      },
      {
        sectionId: "health-literacy-infographics",
        sectionName: "Infographics",
        description: [
          {
            sectionDesc:
              "The Infographics tab manages image-based educational materials with preview support, tags, descriptions, and publishing controls for quick visual health guidance.",
            sectionImage: <HelpImage image="admin-health-literacy-infographics" />,
          },
        ],
      },
      {
        sectionId: "health-literacy-analytics",
        sectionName: "Analytics",
        description: [
          {
            sectionDesc:
              "The Analytics tab filters by time range, content type, and region. It shows total content interactions, content pieces, engagement rate, misinformation reports placeholder, top-performing content, and CSV or PDF export controls.",
            sectionImage: <HelpImage image="admin-health-literacy-analytics" />,
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
          "Sentiment Pulse Tool tracks public health sentiment from mobile and website survey signals. It includes filters, export actions, sentiment summary metrics, trend charts, regional comparisons, and mobile survey management.",
        sectionImage: <HelpImage image="admin-sentiment-pulse-tool" />,
      },
    ],
    subSections: [
      {
        sectionId: "sentiment-trends",
        sectionName: "Sentiment Trends",
        description: [
          {
            sectionDesc:
              "The Sentiment Trends tab includes a sentiment trends line chart, a sentiment categories pie chart, and a top health topics horizontal bar chart. Use it to see how concerned, proactive, misinformed, and neutral responses change over time.",
            sectionImage: <HelpImage image="admin-sentiment-trends" />,
          },
        ],
      },
      {
        sectionId: "sentiment-regional-analysis",
        sectionName: "Regional Analysis",
        description: [
          {
            sectionDesc:
              "The Regional Analysis tab shows a regional sentiment map and a regional sentiment comparison list with response volume bars, dominant sentiment labels, and trend indicators.",
            sectionImage: <HelpImage image="admin-sentiment-regional-analysis" />,
          },
        ],
      },
      {
        sectionId: "sentiment-mobile-surveys",
        sectionName: "Mobile Surveys",
        description: [
          {
            sectionDesc:
              "The Mobile Surveys tab lists draft, scheduled, published, active, and inactive surveys. Cards show response progress, target counts, dominant sentiment, scheduled or published dates, and results or edit actions.",
            sectionImage: <HelpImage image="admin-sentiment-mobile-surveys" />,
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
          "Activity Logs records important user actions across HealthPH, including report generation, account activity, and module usage. Admins can search, review, and export activity records for auditing.",
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
          "Settings lets users review and edit profile details, change email address, change password, and view account status. Inactive users can only access Settings until their account is reactivated.",
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
          "The user dashboard provides access to the dashboards available to your account, including AI Surveillance, NLP Insights, Misinformation Tracker, Model Access and Toolkit, Disease Watch Feed, Health Literacy Hub, Sentiment Pulse Tool, and Settings. Some data and filters may be limited to your assigned region or account permissions.",
        sectionImage: <HelpImage image="user-navigation" />,
      },
    ],
  },
  {
    sectionName: "AI Surveillance",
    sectionId: "ai-surveillance",
    description: [
      {
        sectionDesc:
          "AI Surveillance provides a region-aware overview of suspected disease activity. Users can review suspected case cards, outbreak monitoring on the map, environmental data, AI insights, respiratory monitoring trends, forecasted disease signals, and the suspected conditions percentage pie chart.",
        sectionImage: <HelpImage image="user-ai-surveillance" />,
      },
    ],
    subSections: [
      {
        sectionId: "ai-real-time-outbreak-monitoring",
        sectionName: "Real-time Outbreak Monitoring",
        description: [
          {
            sectionDesc:
              "Real-time Outbreak Monitoring displays suspected disease activity on the AI Surveillance map. Users can review markers for accessible regions, use region, disease, and time range filters where available, and interact with the shared map through zooming, panning, and location controls.",
            sectionImage: (
              <HelpImage image="user-ai-real-time-outbreak-monitoring" />
            ),
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
          "NLP Insights helps users understand health-related conversations through entity recognition, sentiment analysis, and language detection. Available filters and records follow the user's accessible region settings.",
        sectionImage: <HelpImage image="user-nlp-insights" />,
      },
    ],
    subSections: [
      {
        sectionId: "nlp-ner",
        sectionName: "Named Entity Recognition",
        description: [
          {
            sectionDesc:
              "The Named Entity Recognition tab shows detected diseases, symptoms, locations, sample highlighted text, a top words bar chart, and a word cloud for accessible data.",
            sectionImage: <HelpImage image="user-nlp-ner" />,
          },
        ],
      },
      {
        sectionId: "nlp-sentiment-analysis",
        sectionName: "Sentiment Analysis",
        description: [
          {
            sectionDesc:
              "The Sentiment Analysis tab shows sentiment distribution, sentiment by region, and sentiment trends over time to help users understand public response patterns.",
            sectionImage: <HelpImage image="user-nlp-sentiment-analysis" />,
          },
        ],
      },
      {
        sectionId: "nlp-language-detection",
        sectionName: "Language Detection",
        description: [
          {
            sectionDesc:
              "The Language Detection tab displays language distribution, language distribution by region, and model performance cards for supported languages.",
            sectionImage: <HelpImage image="user-nlp-language-detection" />,
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
          "Misinformation Tracker lets users review detected health misinformation with filters, summary cards, a trend line chart, source pie chart, and claims table. User access focuses on viewing and monitoring available records.",
        sectionImage: <HelpImage image="user-misinformation-tracker" />,
      },
    ],
  },
  {
    sectionName: "Model Access and Toolkit",
    sectionId: "model-access-toolkit",
    description: [
      {
        sectionDesc:
          "Model Access and Toolkit gives users visibility into model performance, available datasets, and training activity. Administrative dataset actions may depend on account permissions.",
        sectionImage: <HelpImage image="user-model-access-toolkit" />,
      },
    ],
    subSections: [
      {
        sectionId: "model-comparison",
        sectionName: "Model Comparison",
        description: [
          {
            sectionDesc:
              "The Model Comparison tab includes filters, model search, a comparison bar chart, and model cards showing F1 score, precision, recall, and accuracy.",
            sectionImage: <HelpImage image="user-model-comparison" />,
          },
        ],
      },
      {
        sectionId: "model-data-management",
        sectionName: "Data Management",
        description: [
          {
            sectionDesc:
              "The Data Management tab lists datasets with file name, size, status, uploader, upload date, and available preview or download actions.",
            sectionImage: <HelpImage image="user-model-data-management" />,
          },
        ],
      },
      {
        sectionId: "model-training-logs",
        sectionName: "Training Logs",
        description: [
          {
            sectionDesc:
              "The Training Logs tab shows model run history, dataset names, statuses, start times, durations, and available view or export actions.",
            sectionImage: <HelpImage image="user-model-training-logs" />,
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
          "Disease Watch Feed provides disease alerts, coverage analytics, and mobile user engagement metrics. Users can review alerts, regional coverage, and user analytics based on the data available to their account.",
        sectionImage: <HelpImage image="user-disease-watch-feed" />,
      },
    ],
    subSections: [
      {
        sectionId: "disease-recent-alerts",
        sectionName: "Recent Alerts",
        description: [
          {
            sectionDesc:
              "The Recent Alerts tab lists disease alerts with type, region, timestamp, and summary for quick situational awareness.",
            sectionImage: <HelpImage image="user-disease-recent-alerts" />,
          },
        ],
      },
      {
        sectionId: "disease-regional-coverage",
        sectionName: "Regional Coverage",
        description: [
          {
            sectionDesc:
              "The Regional Coverage tab shows a registered-users-by-region bar chart, region filters, and regional cards with user counts and percentage bars.",
            sectionImage: <HelpImage image="user-disease-regional-coverage" />,
          },
        ],
      },
      {
        sectionId: "disease-user-analytics",
        sectionName: "User Analytics",
        description: [
          {
            sectionDesc:
              "The User Analytics tab summarizes total users, alert open rate, and symptom reports with trend indicators.",
            sectionImage: <HelpImage image="user-disease-user-analytics" />,
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
          "Health Literacy Hub provides articles, videos, infographics, and analytics for educational health resources. User access focuses on reviewing content and understanding engagement outcomes where permitted.",
        sectionImage: <HelpImage image="user-health-literacy-hub" />,
      },
    ],
    subSections: [
      {
        sectionId: "health-literacy-articles",
        sectionName: "Articles",
        description: [
          {
            sectionDesc:
              "The Articles tab contains written health resources with topics, tags, summaries, and preview information.",
            sectionImage: <HelpImage image="user-health-literacy-articles" />,
          },
        ],
      },
      {
        sectionId: "health-literacy-videos",
        sectionName: "Videos",
        description: [
          {
            sectionDesc:
              "The Videos tab contains video learning materials and preview details for health literacy campaigns.",
            sectionImage: <HelpImage image="user-health-literacy-videos" />,
          },
        ],
      },
      {
        sectionId: "health-literacy-infographics",
        sectionName: "Infographics",
        description: [
          {
            sectionDesc:
              "The Infographics tab contains visual health guides with previews, descriptions, and content metadata.",
            sectionImage: <HelpImage image="user-health-literacy-infographics" />,
          },
        ],
      },
      {
        sectionId: "health-literacy-analytics",
        sectionName: "Analytics",
        description: [
          {
            sectionDesc:
              "The Analytics tab shows content interactions, content pieces, engagement rate, top-performing content, and filter controls for time range, content type, and region.",
            sectionImage: <HelpImage image="user-health-literacy-analytics" />,
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
          "Sentiment Pulse Tool summarizes public health sentiment from surveys and topic signals. Users can view sentiment trends, regional sentiment patterns, and mobile survey response summaries.",
        sectionImage: <HelpImage image="user-sentiment-pulse-tool" />,
      },
    ],
    subSections: [
      {
        sectionId: "sentiment-trends",
        sectionName: "Sentiment Trends",
        description: [
          {
            sectionDesc:
              "The Sentiment Trends tab shows sentiment movement over time, sentiment category shares, and top health topics by number of concerns.",
            sectionImage: <HelpImage image="user-sentiment-trends" />,
          },
        ],
      },
      {
        sectionId: "sentiment-regional-analysis",
        sectionName: "Regional Analysis",
        description: [
          {
            sectionDesc:
              "The Regional Analysis tab shows regional sentiment labels, response volume bars, and trend indicators for visible regions.",
            sectionImage: <HelpImage image="user-sentiment-regional-analysis" />,
          },
        ],
      },
      {
        sectionId: "sentiment-mobile-surveys",
        sectionName: "Mobile Surveys",
        description: [
          {
            sectionDesc:
              "The Mobile Surveys tab lists survey cards with status, response progress, target counts, dominant sentiment, and available result actions.",
            sectionImage: <HelpImage image="user-sentiment-mobile-surveys" />,
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
          "Settings lets users edit profile details, change email address, change password, review account status, and manage account access. Inactive accounts can only access Settings until reactivated.",
        sectionImage: <HelpImage image="user-settings" />,
      },
    ],
  },
];

const isAdminUser = (userType) => ["ADMIN", "SUPERADMIN"].includes(userType);

const shouldHideInPWA = (id, hiddenIds) => hiddenIds.includes(id);

const Help = () => {
  const user = useSelector((state) => state.auth.user);

  const { isPWA } = useDeviceDetect();

  const [search, setSearch] = useState("");

  const TOC = useMemo(
    () => (isAdminUser(user?.user_type) ? TOCAdmin : TOCUser),
    [user?.user_type]
  );

  const [tocActive, setTOCActive] = useState(false);
  const [tocAnimate, setTOCAnimate] = useState("");

  const handleAnimationEnd = () => {
    const toc = document.getElementById("toc");
    if (toc?.classList.contains("hide-toc")) {
      setTOCAnimate("");
    }
  };

  const handleClick = () => {
    setTOCActive(!tocActive);
    setTOCAnimate(!tocAnimate ? "show-toc" : "hide-toc");
  };

  const handleSelectSection = (id) => {
    handleClick();
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const getContent = () => {
    return isAdminUser(user?.user_type) ? helpSectionsAdmin : helpSectionsUser;
  };

  const [currentTOCActive, setCurrentTOCActive] = useState("navigation");

  useEffect(() => {
    const handleTOCActive = () => {
      const sections = [];

      TOC.forEach(({ id, hasSubItems, subItems }) => {
        if (isPWA && shouldHideInPWA(id, PWA_HIDDEN_SECTION_IDS)) {
          return;
        }

        const section = document.getElementById(id);
        if (section) {
          sections.push({
            id,
            rect: section.getBoundingClientRect(),
          });
        }

        if (hasSubItems) {
          subItems.forEach(({ id }) => {
            if (isPWA && shouldHideInPWA(id, PWA_HIDDEN_SUBSECTION_IDS)) {
              return;
            }

            const subSection = document.getElementById(id);
            if (subSection) {
              sections.push({
                id,
                rect: subSection.getBoundingClientRect(),
              });
            }
          });
        }
      });

      let flag = "";

      sections.forEach(({ id, rect }) => {
        if (rect.y < 280) {
          flag = id;
        }
      });

      if (currentTOCActive !== flag || flag == "navigation") {
        setCurrentTOCActive(flag);
      }
    };

    const el = document.getElementsByTagName("main")[0];
    if (!el) return undefined;

    el.addEventListener("scroll", handleTOCActive);
    handleTOCActive();

    return () => el.removeEventListener("scroll", handleTOCActive);
  }, [TOC, currentTOCActive, isPWA]);

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

            <div className="toc-wrapper">
              <div className="toc-header">Modules</div>
              <ul>
                {TOC.map(({ id, label, hasSubItems, subItems }) => {
                  if (isPWA && shouldHideInPWA(id, PWA_HIDDEN_SECTION_IDS)) {
                    return null;
                  }

                  return !hasSubItems ? (
                    <li
                      className={`toc-item ${
                        id == currentTOCActive ? "active" : ""
                      }`}
                      key={id}
                      onClick={() => handleSelectSection(id)}
                    >
                      {label}
                    </li>
                  ) : (
                    <Fragment key={id}>
                      <li
                        className={`toc-item ${
                          id == currentTOCActive ? "active" : ""
                        }`}
                        onClick={() => handleSelectSection(id)}
                      >
                        {label}
                      </li>
                      {subItems
                        .filter(
                          ({ id }) =>
                            !(
                              isPWA &&
                              shouldHideInPWA(id, PWA_HIDDEN_SUBSECTION_IDS)
                            )
                        )
                        .map(({ id, label }, index, visibleSubItems) => {
                          const isLast = index == visibleSubItems.length - 1;

                          return (
                            <li
                              className={`toc-sub-item ${
                                isLast ? "mb-[16px]" : ""
                              } ${id == currentTOCActive ? "active" : ""}`}
                              key={id}
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

          <div className="help-content" id="help-content">
            {getContent().map(
              ({ sectionName, sectionId, description, subSections }) => {
                if (
                  isPWA &&
                  shouldHideInPWA(sectionId, PWA_HIDDEN_SECTION_IDS)
                ) {
                  return null;
                }

                return (
                  <div
                    key={sectionId}
                    className="help-content-section"
                    id={sectionId}
                  >
                    <p className="help-content-heading">{sectionName}</p>
                    {description.map(({ sectionDesc, sectionImage }) => {
                      return (
                        <Fragment key={sectionDesc}>
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
                        ({ sectionId, sectionName, description }) => {
                          if (
                            isPWA &&
                            shouldHideInPWA(
                              sectionId,
                              PWA_HIDDEN_SUBSECTION_IDS
                            )
                          ) {
                            return null;
                          }

                          return (
                            <Fragment key={sectionId}>
                              <p
                                className="help-content-subheading"
                                id={sectionId}
                              >
                                {sectionName}
                              </p>
                              {description.map(
                                ({ sectionDesc, sectionImage }) => {
                                  return (
                                    <Fragment key={sectionDesc}>
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
