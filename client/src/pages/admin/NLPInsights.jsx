import { useState } from "react";
import { useSelector } from "react-redux";

import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    LabelList,
} from "recharts";

import {
    useGenerateFrequentWordsQuery,
    useGenerateWordCloudQuery,
} from "../../features/api/analyticsSlice";

import Report from "../../components/admin/Report";
import capitalizeSymptom from "../../hooks/useCapitalizeSymptom";

import ReactWordCloud from "react-wordcloud";

const NLPInsights = () => {
    const [activeTab, setActiveTab] = useState("ner");

    const user = useSelector((state) => state.auth.user);

    /* TOP WORDS */
    const [topWordsFilter, setTopWordsFilter] = useState(
        user.user_type == "USER"
            ? user.accessible_regions[0]
            : "all"
    );

    const { data: frequentWords, isFetching: isTopWordsFetching } =
        useGenerateFrequentWordsQuery(topWordsFilter);

    /* WORD CLOUD */
    const [wordCloudFilter, setWordCloudFilter] = useState(
        user.user_type == "USER"
            ? user.accessible_regions[0]
            : "all"
    );

    const { data: wordcloud, isFetching: isWordCloudFetching } =
        useGenerateWordCloudQuery(wordCloudFilter);

    const wordcloudOptions = {
        colors: ["#171E26", "#F5D76E", "#6A8EB5", "#F78C6B", "#78C6B2"],
        rotations: 0,
        deterministic: true,
        padding: 20,
        fontSizes: [20, 50],
        scale: "linear,"
    };

    return (
        <div className="flex flex-col gap-[20px]">
            {/* PAGE HEADER */}
            <div>
                <h1 className="text-[28px] font-semibold text-gray-800">
                    NLP Insights
                </h1>
                <p className="text-gray-500 mt-[4px]">
                    Multilingual natural language processing, entity recognitation, sentiment analysis, and language detection.
                </p>
            </div>

            {/* SUBTABS */}
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[12px]">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-[8px] bg-[#F5F5F5] rounded-[10px] p-[6px]">
                    <TabButton
                        label="Named Entity Recognition"
                        active={activeTab === "ner"}
                        onClick={() => setActiveTab("ner")}
                    />
                    <TabButton
                        label="Sentiment Analysis"
                        active={activeTab === "sentiment"}
                        onClick={() => setActiveTab("sentiment")}
                    />
                    <TabButton
                        label="Language Detection"
                        active={activeTab === "language"}
                        onClick={() => setActiveTab("language")}
                    />
                </div>
            </div>

            {activeTab === "ner" && (
                <NamedEntityRecognition 
                    topWordsFilter={topWordsFilter}
                    setTopWordsFilter={setTopWordsFilter}
                    frequentWords={frequentWords}
                    isTopWordsFetching={isTopWordsFetching}
                    wordCloudFilter={wordCloudFilter}
                    setWordCloudFilter={setWordCloudFilter}
                    wordcloud={wordcloud}
                    isWordCloudFetching={isWordCloudFetching}
                    wordcloudOptions={wordcloudOptions}
                />
            )}
            {activeTab === "sentiment" && <SentimentAnalysis />}
            {activeTab === "language" && <LanguageDetection />}
        </div>
    );
};

const TabButton = ({ label, active, onClick }) => {
    return (
        <button
            type="button"
            className={`px-[16px] py-[10px] rounded-[8px] text-sm font-medium transition ${
                active
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
            }`}
            onClick={onClick}
        >
            {label}
        </button>
    );
};

const NamedEntityRecognition = ({
    topWordsFilter,
    setTopWordsFilter,
    frequentWords,
    isTopWordsFetching,
    wordCloudFilter,
    setWordCloudFilter,
    wordcloud,
    isWordCloudFetching,
    wordcloudOptions,
}) => {
    return (
        <div className="flex flex-col gap-[20px]">
            {/* FIRST ROW */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-[20px]">
                {/* DISEASES PANEL */}
                <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[24px] min-h-[260px]">
                    <h2 className="text-[18px] font-semibold text-gray-800 mb-[24px]">
                        Diseases
                    </h2>

                    <div className="flex flex-col gap-[12px]">
                        <EntityFrequencyRow
                            entity="Tuberculosis"
                            count="328"
                            progress="90%"
                            note="+12% from last week | Primarily NCR"
                            color="#2563EB"
                        />
                        <EntityFrequencyRow
                            entity="COVID-19"
                            count="241"
                            progress="75%"
                            note="-4% from last week | Region IV-A"
                            color="#F97316"
                        />
                        <EntityFrequencyRow
                            entity="Pneumonia"
                            count="187"
                            progress="60%"
                            note="+8% from last week | Region III"
                            color="#20C997"
                        />
                        <EntityFrequencyRow
                            entity="AURI"
                            count="121"
                            progress="40%"
                            note="+3% from last week | Multiple regions"
                            color="#9CA3AF"
                        />
                    </div>
                </div>

                {/* SYMPTOM FREQUENCY PANEL */}
                <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[24px] min-h-[260px]">
                    <h2 className="text-[18px] font-semibold text-gray-800 mb-[24px]">
                        Symptom Frequency    
                    </h2>

                    <div className="flex flex-col gap-[12px]">
                        <EntityFrequencyRow 
                            entity="Fever" 
                            count="356"
                            progress="95%"
                            note="+8% from last week | Primarily in NCR, Region III"
                            color="#F97316"
                        />
                        <EntityFrequencyRow 
                            entity="Cough" 
                            count="289"
                            progress="78%"
                            note="-3% from last week | Primarily in NCR, Region IV-A"
                            color="#F97316"
                        />
                        <EntityFrequencyRow 
                            entity="Headache" 
                            count="201"
                            progress="60%"
                            note="+32% from last week | Region IV-A"
                            color="#F97316"
                        />
                        <EntityFrequencyRow 
                            entity="Rash" 
                            count="99"
                            progress="35%"
                            note="+5% from last week | Multiple regions"
                            color="#F97316"
                        />
                    </div>
                </div>
                
                {/* LOCATION PANEL */}
                <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[24px] min-h-[260px]">
                    <h2 className="text-[18px] font-semibold text-gray-800 mb-[24px]">
                        Locations
                    </h2>

                    <div className="flex flex-col gap-[14px]">
                        <LocationRow 
                            location="National Capital Region"
                            mentions="428"
                            status="High Activity"
                            color="#FF0000"
                        />
                        <LocationRow 
                            location="Region IV-A"
                            mentions="312"
                            status="Moderate Activity"
                            color="#F97316"
                        />
                        <LocationRow 
                            location="Region III"
                            mentions="201"
                            status="Monitoring"
                            color="#FFFF00"
                        />
                        <LocationRow 
                            location="BARMM"
                            mentions="97"
                            status="Low Activity"
                            color="#FFFFED"
                        />
                    </div>
                </div>
            </div>
            {/* SECOND ROW */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-[20px]">
                {/* LEFT - NER DEMO PANEL*/}
                <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[24px] min-h-[420px]">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-[16px] mb-[20px]">
                        <div>
                            <h2 className="text-[18px] font-semibold text-gray-800">
                                Named Entity Recognition Demo
                            </h2>
                            <p className="text-sm text-gray-500 mt-[4px]">
                                Sample entity extraction from health-related text.
                            </p>
                        </div>
                        
                        <div className="flex flex-wrap gap-[14px] text-sm">
                            <LegendItem label="Disease" color="#DC2626" />
                            <LegendItem label="Symptom" color="#059669" />
                            <LegendItem label="Location" color="#EA580C" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-[14px]">
                        <NERPostCard
                            language="Filipino"
                            postId="Post ID: 1"
                        >
                            Maraming kaso ng {" "}
                            <EntityHighlight label="dengue" backgroundColor="#FEE2E2" textColor="#DC2626" /> sa aming barangay sa {" "}
                            <EntityHighlight label="Quezon City" backgroundColor="#FFEDD5" textColor="#EA580C" />. May {" "}
                            <EntityHighlight label="lagnat" backgroundColor="#D1FAE5" textColor="#059669" /> at {" "}
                            <EntityHighlight label="pantal" backgroundColor="#D1FAE5" textColor="#059669" /> ang aking anak.
                        </NERPostCard>
                        <NERPostCard
                            language="English"
                            postId="Post ID: 2"
                        >
                            Several people in {" "}
                            <EntityHighlight label="Cebu City" backgroundColor="#FFEDD5" textColor="#EA580C" /> are experiencing severe {" "}
                            <EntityHighlight label="coughing" backgroundColor="#D1FAE5" textColor="#059669" /> and difficulty breathing after the typhoon. 
                        </NERPostCard>
                    </div>
                </div>
                {/* RIGHT */}
                <div className="flex flex-col gap-[20px]">
                    {/* TOP WORDS */}
                    <Report
                        heading="Top Words"
                        filter={topWordsFilter}
                        setFilter={setTopWordsFilter}
                        isLoading={isTopWordsFetching}
                    >
                        <ResponsiveContainer width="100%" height={260}>
                            {frequentWords && frequentWords["frequent_words"]?.length > 0 ? (
                                <BarChart
                                    data={frequentWords["frequent_words"]}
                                    layout="vertical"
                                    margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" padding={{ left: 20, right: 20 }} tickLine={false} />
                                    <YAxis hide={true} dataKey="word" type="category" tickLine={false} axisLine={false} />
                                    <Tooltip />
                                    <Legend verticalAlign="top" align="left" iconSize={20} height={40} />
                                    <Bar dataKey="frequency" fill="#B5A8DE" maxBarSize={18} radius={[0, 8, 8, 0]}>
                                        <LabelList
                                            dataKey="word"
                                            content={({ x, y, value}) => (
                                                <text
                                                    x={x}
                                                    y={y - 5}
                                                    className="recharts-text recharts-cartesian-axis-tick-value text-[14px]" fill="#666"  
                                                >
                                                    <tspan>{capitalizeSymptom(value)}</tspan>
                                                </text>
                                            )}
                                        />
                                    </Bar>
                                </BarChart>
                            ) : (
                                <div className="flex items-center justify-center h-[220px] text-gray-400">
                                    No top words data available
                                </div>
                            )}
                        </ResponsiveContainer>
                    </Report>
                    
                    {/* WORD CLOUD */}
                    <Report
                        heading="Word Cloud"
                        filter={wordCloudFilter}
                        setFilter={setWordCloudFilter}
                        isLoading={isWordCloudFetching}
                    >
                        <ResponsiveContainer width="100%" height={260}>
                            {wordcloud && wordcloud !== "No datasets" ? (
                                <ReactWordCloud 
                                    className="dynamic-wordcloud"
                                    style={{
                                        height: "100%",
                                        width: "100%",
                                    }}
                                    words={wordcloud}
                                    options={wordcloudOptions}
                                />
                            ) : (
                                <div className="flex items-center justify-center h-[220px] text-gray-400">
                                    No word cloud data available
                                </div>
                            )}
                        </ResponsiveContainer>
                    </Report>
                </div>
            </div>
        </div>
    );
};

const SentimentAnalysis = () => {
    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-[20px]">
            <NLPPanel title="Sentiment Distribution" />
            <NLPPanel title="Sentiment by Region" />
            <div className="xl:col-span-2">
                <NLPPanel title="Sentiment Trends Over Time" />
            </div>
        </div>
    );
};

const LanguageDetection = () => {
    return (
        <div className="grid  grid-cols-1 xl: grid-cols-2 gap-[20px]">
            <NLPPanel title="Language Distribution" />
            <NLPPanel title="Language Distribution by Region" />
            <div className="xl:col-span-2">
                <NLPPanel title="Language Processing Model Performance" />
            </div>
        </div>
    );
};

const EntityFrequencyRow = ({ entity, count, progress, note, color }) => {
    return (
        <div>
            <div className="flex justify-between items-center mb-[8px]">
                <p className="text-[16px] font-medium text-gray-800">
                    {entity}
                </p>
                <p className="text-[16px] font-semibold text-gray-800">
                    {count} mentions
                </p>
            </div>

            <div className="h-[12px] bg-gray-100 rounded-full overflow-hidden">
                <div 
                    className="h-full rounded-full"
                    style={{
                        width: progress,
                        backgroundColor: color,
                    }}
                ></div>
            </div>

            <p className="text-sm text-gray-500 mt-[6px]">
                {note}
            </p>
        </div>
    );
};

const LocationRow = ({ location, mentions, status, color, }) => {
    return (
        <div className="flex items-center justify-between bg-[#F5F5F5] rounded-[10px] p-[14px]">
            <div className="flex items-center gap-[12px]">
                <div 
                    className="h-[12px] w-[12px] rounded-full"
                    style={{ backgroundColor: color }}>
                </div>

                <div>
                    <p className="text-[15px] font-medium text-gray-800">
                        {location}
                    </p>

                    <p className="text-xs text-gray-500">
                        {status}
                    </p>
                </div>
            </div>

            <div className="text-right">
                <p className="text-[15px] font-semibold text-gray-800">
                    {mentions}
                </p>
                <p className="text-xs text-gray-500">
                    mentions
                </p>
            </div>
        </div>
    );
};

const LegendItem = ({ label, color }) => {
    return (
        <div className="flex items-center gap-[8px]">
            <span
                className="h-[10px] w-[10px] rounded-full"
                style={{ backgroundColor: color }}
            ></span>
            <span className="text-gray-600">{label}</span>
        </div>
    );
};

const NERPostCard = ({ language, postId, children }) => {
    return (
        <div className="border border-[#D5DDE5] rounded-[14px] p-[16px]">
            <div className="flex items-center gap-[10px] mb-[12px]">
                <span className="bg-gray-100 text-gray-700 px-[12px] py-[5px] rounded-full text-sm font-medium">
                    {language}
                </span>
                <span className="text-sm text-gray-400">
                    {postId}
                </span>
            </div>

            <p className="text-[15px] text-gray-800 leading-[1.8]">
                {children}
            </p>
        </div>
    );
};

const EntityHighlight = ({ label, backgroundColor, textColor, }) => {
    return (
        <span
            className="px-[6px] py-[2px] rounded-[6px] text-sm font-medium"
            style={{ 
                backgroundColor,
                color: textColor,
            }}
        >
            {label}
        </span>
    )
}

const NLPPanel = ({ title }) => {
    return (
        <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[260px]">
            <h2 className="text-[18px] font-semibold text-gray-800 mb-[16px]">
                {title}
            </h2>
            <div className="w-full h-[180px] bg-[#F5F5F5] rounded-[12px] flex items-center justify-center text-gray-400">
                {title} Placeholder
            </div>
        </div>
    );
};

export default NLPInsights;