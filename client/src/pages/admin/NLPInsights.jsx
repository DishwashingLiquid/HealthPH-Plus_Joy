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
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
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
        scale: "linear",
    };

    return (
        <div className="flex flex-col gap-[10px]">
            {/* PAGE HEADER */}
            <div>
                <h1 className="text-[24px] font-semibold text-gray-800">
                    NLP Insights
                </h1>
                <p className="text-gray-500 text-[14px]">
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
        <div className="flex flex-col gap-[10px]">
            {/* FIRST ROW */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-[10px]">
                {/* DISEASES PANEL */}
                <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[260px]">
                    <h2 className="text-[18px] font-semibold text-gray-800 mb-[12px]">
                        Diseases
                    </h2>

                    <div className="flex flex-col gap-[12px]">
                        <EntityFrequencyRow
                            entity="Tuberculosis"
                            count="328"
                            progress="90%"
                            note="+12% from last week | Primarily NCR"
                            color="#32418C"
                        />
                        <EntityFrequencyRow
                            entity="Pneumonia"
                            count="241"
                            progress="75%"
                            note="-4% from last week | Region IV-A"
                            color="#2572A5"
                        />
                        <EntityFrequencyRow
                            entity="COVID-19"
                            count="187"
                            progress="60%"
                            note="+8% from last week | Region III"
                            color="#9BCC33"
                        />
                        <EntityFrequencyRow
                            entity="AURI"
                            count="121"
                            progress="40%"
                            note="+3% from last week | Multiple regions"
                            color="#FBD117"
                        />
                    </div>
                </div>

                {/* SYMPTOM FREQUENCY PANEL */}
                <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[260px]">
                    <h2 className="text-[18px] font-semibold text-gray-800 mb-[12px]">
                        Symptom Frequency    
                    </h2>

                    <div className="flex flex-col gap-[12px]">
                        <EntityFrequencyRow 
                            entity="Fever" 
                            count="356"
                            progress="95%"
                            note="+8% from last week | Primarily in NCR, Region III"
                            color="#32418C"
                        />
                        <EntityFrequencyRow 
                            entity="Cough" 
                            count="289"
                            progress="78%"
                            note="-3% from last week | Primarily in NCR, Region IV-A"
                            color="#2572A5"
                        />
                        <EntityFrequencyRow 
                            entity="Headache" 
                            count="201"
                            progress="60%"
                            note="+32% from last week | Region IV-A"
                            color="#9BCC33"
                        />
                        <EntityFrequencyRow 
                            entity="Rash" 
                            count="99"
                            progress="35%"
                            note="+5% from last week | Multiple regions"
                            color="#FBD117"
                        />
                    </div>
                </div>
                
                {/* LOCATION PANEL */}
                <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[260px]">
                    <h2 className="text-[18px] font-semibold text-gray-800 mb-[12px]">
                        Locations
                    </h2>

                    <div className="flex flex-col gap-[14px]">
                        <LocationRow 
                            location="National Capital Region"
                            mentions="428"
                            status="High Activity"
                            color="#32418C"
                        />
                        <LocationRow 
                            location="Region IV-A"
                            mentions="312"
                            status="Moderate Activity"
                            color="#2572A5"
                        />
                        <LocationRow 
                            location="Region III"
                            mentions="201"
                            status="Monitoring"
                            color="#9BCC33"
                        />
                        <LocationRow 
                            location="BARMM"
                            mentions="97"
                            status="Low Activity"
                            color="#FBD117"
                        />
                    </div>
                </div>
            </div>
            {/* SECOND ROW */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-[10px]">
                {/* LEFT - NER DEMO PANEL*/}
                <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[420px]">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-[16px] mb-[20px]">
                        <div>
                            <h2 className="text-[18px] font-semibold text-gray-800">
                                Named Entity Recognition Demo
                            </h2>
                            <p className="text-sm text-gray-500">
                                Sample entity extraction from health-related text.
                            </p>
                        </div>
                        
                        <div className="flex flex-wrap gap-[14px] text-sm">
                            <LegendItem label="Disease" color="#32418C" />
                            <LegendItem label="Symptom" color="#2572A5" />
                            <LegendItem label="Location" color="#FBD117" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-[14px]">
                        <NERPostCard
                            language="Filipino"
                            postId="Post ID: 1"
                        >
                            Maraming kaso ng {" "}
                            <EntityHighlight label="dengue" backgroundColor="#32418C30" textColor="#32418C" /> sa aming barangay sa {" "}
                            <EntityHighlight label="Quezon City" backgroundColor="#FBD11730" textColor="#FBD117" />. May {" "}
                            <EntityHighlight label="lagnat" backgroundColor="#1ABC9C30" textColor="#1ABC9C" /> at {" "}
                            <EntityHighlight label="pantal" backgroundColor="#1ABC9C30" textColor="#1ABC9C" /> ang aking anak.
                        </NERPostCard>
                        <NERPostCard
                            language="English"
                            postId="Post ID: 2"
                        >
                            Several people in {" "}
                            <EntityHighlight label="Cebu City" backgroundColor="#FBD11730" textColor="#FBD117" /> are experiencing severe {" "}
                            <EntityHighlight label="coughing" backgroundColor="#1ABC9C30" textColor="#1ABC9C" /> and difficulty breathing after the typhoon. 
                        </NERPostCard>
                    </div>
                </div>
                {/* RIGHT */}
                <div className="flex flex-col gap-[10px]">
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
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-[10px]">
            {/* SENTIMENT DISTRIBUTION */}
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[360px]">
                <h2 className="text-[18px] font-semibold text-gray-800">
                    Sentiment Distribution
                </h2>
                <p className="text-sm text-gray-500 mb-[12px]">
                    Overall public sentiment detected from multilingual health-related posts.
                </p>

                <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                        <Legend
                            verticalAlign="bottom"
                            align="center"
                            iconType="circle"
                            wrapperStyle={{
                                paddingTop: "20px",
                                lineHeight: "28px",
                            }}
                            formatter={(value) => (
                                <span className="text-[13px] text-gray-700 mr-[18px]">
                                    {value}
                                </span>
                            )}
                        />
                        <Pie
                            data={[
                                { name: "Positive", value: 32 },
                                { name: "Neutral", value: 46 },
                                { name: "Negative", value: 22 },
                            ]}
                            cx="50%"
                            cy="50%"
                            outerRadius={90}
                            dataKey="value"
                            label
                        >
                            {["#32418C", "#1ABC9C", "#FBD117 "].map((color, index) => (
                                <Cell key={`sentiment-cell-${index}`} fill={color} />
                            ))}
                        </Pie>

                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            
            {/* SENTIMENT BY REGION */}
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[360px]">
                <h2 className="text-[18px] font-semibold text-gray-800">
                    Sentiment by Region
                </h2>
                <p className="text-sm text-gray-500 mb-[12px]">
                    Regional sentiment breakdown from detected public health conversations.
                </p>

                <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                        data={[
                            { region: "NCR", positive: 45, neutral: 30, negative: 25 },
                            { region: "III", positive: 30, neutral: 42, negative: 28 },
                            { region: "IV-A", positive: 25, neutral: 35, negative: 40 },
                            { region: "NCR", positive: 38, neutral: 40, negative: 22 },
                        ]}
                        margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3 " />
                        <XAxis dataKey="region" />
                        <YAxis />
                        <Tooltip />
                        <Legend
                            verticalAlign="bottom"
                            align="center"
                            iconType="circle"
                            wrapperStyle={{
                                paddingTop: "20px",
                                lineHeight: "28px",
                            }}
                        />

                        <Bar dataKey="positive" name="Positive" fill="#32418C" />
                        <Bar dataKey="neutral" name="Neutral" fill="#1ABC9C" />
                        <Bar dataKey="negative" name="Negative" fill="#FBD117" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            
            {/* SENTIMENT TRENDS OVER TIME */}
            <div className="xl:col-span-2 bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[380px]">
                <h2 className="text-[18px] font-semibold text-gray-800">
                    Sentiment Trends Over Time
                </h2>
                <p className="text-sm text-gray-500 mb-[12px]">
                    Weekly sentiment movement used to support public health communication monitoring.
                </p>

                <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                        data={[
                            { week: "Week 1", positive: 34, neutral: 42, negative: 24 },
                            { week: "Week 2", positive: 36, neutral: 39, negative: 25 },
                            { week: "Week 3", positive: 30, neutral: 37, negative: 33 },
                            { week: "Week 4", positive: 28, neutral: 35, negative: 37 },
                            { week: "Week 5", positive: 32, neutral: 40, negative: 28 },
                        ]}
                        margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="week" />
                        <YAxis />
                        <Tooltip />
                        <Legend
                            verticalAlign="bottom"
                            align="center"
                            iconType="circle"
                            wrapperStyle={{
                                paddingTop: "20px",
                                lineHeight: "28px",
                            }}
                        />

                        <Line type="monotone" dataKey="positive" name="Positive" stroke="#32418C" strokeWidth={2} />
                        <Line type="monotone" dataKey="neutral" name="Neutral" stroke="#1ABC9C" strokeWidth={2} />
                        <Line type="monotone" dataKey="negative" name="Negative" stroke="#FBD117" strokeWidth={2} />
                    </LineChart> 
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const LanguageDetection = () => {
    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-[10px]">
            {/* LANGUAGE DISTRIBUTION */}
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[360px]">
                <h2 className="text-[18px] font-semibold text-gray-800">
                    Language Distribution
                </h2>
                <p className="text-sm text-gray-500 mb-[12px]">
                    Detected language distribution from multilingual health-related posts.
                </p>

                <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                        <Legend
                            verticalAlign="bottom"
                            align="center"
                            iconType="circle"
                            wrapperStyle={{
                                paddingTop: "20px",
                                lineHeight: "28px"
                            }}
                        />

                        <Pie
                            data={[
                                { name: "English", value: 34 },
                                { name: "Filipino", value: 28 },
                                { name: "Cebuano", value: 16 },
                                { name: "Ilocano", value: 12 },
                                { name: "Hiligaynon", value: 10 },
                            ]}
                            cx="50%"
                            cy="50%"
                            outerRadius={90}
                            dataKey="value"
                            label
                        >
                            {["#32418C", "#2572A5", "#1ABC9C", "#9BCC33", "#FBD117"].map((color, index) => (
                                <Cell key={`language-cell-${index}`} fill={color} />
                            ))}
                        </Pie>

                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            {/* LANGUAGE DISTRIBUTION BY REGION */}
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[360px]">
                <h2 className="text-[18px] font-semibold text-gray-800">
                    Language Distribution by Region
                </h2>
                <p className="text-sm text-gray-500 mb-[12px]">
                    Regional language patterns detected from public health conversations.
                </p>

                <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                        data={[
                            { region: "NCR", english: 42, filipino: 38, regional: 20 },
                            { region: "VII", english: 22, filipino: 18, regional: 60 },
                            { region: "I", english: 25, filipino: 20, regional: 55 },
                            { region: "VI", english: 20, filipino: 24, regional: 56 },
                        ]}
                        margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="region" />
                        <YAxis />
                        <Tooltip />
                        <Legend
                            verticalAlign="bottom"
                            align="center"
                            iconType="circle"
                            wrapperStyle={{
                                paddingTop: "20px",
                                lineHeight: "28px",
                            }}
                        />

                        <Bar dataKey="english" name="English" fill="#32418C" />
                        <Bar dataKey="filipino" name="Filipino" fill="#1ABC9C" />
                        <Bar dataKey="regional" name="Regional Languages" fill="#FBD117" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* LANGUAGE PROCESSING MODEL PERFORMANCE */}
            <div className="xl:col-span-2 bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
                <h2 className="text-[18px] font-semibold text-gray-800 mb-[12px]">
                    Language Processing Model Performance
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-[16px]">
                    <ModelMetricCard label="English" value="94%" />
                    <ModelMetricCard label="Filipino" value="91%" />
                    <ModelMetricCard label="Cebuano" value="87%" />
                    <ModelMetricCard label="Ilocano" value="84%" />
                    <ModelMetricCard label="Hiligaynon" value="82%" />
                </div>
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

const ModelMetricCard = ({ label, value }) => {
    return (
        <div className="bg-[#F5F5F5] rounded-[12px] p-[16px]">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-[28px] font-semibold text-gray-800 mt-[8px]">
                {value}
            </p>
            <p className="text-xs text-gray-500 mt-[4px]">
                detection accuracy
            </p>
        </div>
    );
};

export default NLPInsights;