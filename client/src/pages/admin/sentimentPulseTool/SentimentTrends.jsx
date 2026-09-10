import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  sentimentTrendsData,
  sentimentCategories,
  topHealthTopics,
  sentimentColors,
} from "../../../assets/data/sentimentMockData";

const NLP_SENTIMENT_PALETTE = {
  Concerned: "#32418C",
  Proactive: "#2572A5",
  Misinformed: "#1ABC9C",
  Neutral: "#FBD117",
};

const TOPIC_BAR_COLORS = ["#32418C", "#2572A5", "#9BCC33", "#FBD117"];

const sentimentSeries = [
  {
    dataKey: "concerned",
    name: "Concerned",
    color: NLP_SENTIMENT_PALETTE.Concerned,
  },
  {
    dataKey: "proactive",
    name: "Proactive",
    color: NLP_SENTIMENT_PALETTE.Proactive,
  },
  {
    dataKey: "misinformed",
    name: "Misinformed",
    color: NLP_SENTIMENT_PALETTE.Misinformed,
  },
  {
    dataKey: "neutral",
    name: "Neutral",
    color: NLP_SENTIMENT_PALETTE.Neutral,
  },
];

const legendFormatter = (value) => (
  <span className="text-[13px] text-gray-700 mr-[18px]">{value}</span>
);

export default function SentimentTrends() {
  const sentimentCategoryData = sentimentCategories.map((category) => ({
    ...category,
    color:
      NLP_SENTIMENT_PALETTE[category.name] ||
      sentimentColors[category.name] ||
      category.color,
  }));

  const topicChartData = topHealthTopics.map((topic, index) => ({
    ...topic,
    fill: TOPIC_BAR_COLORS[index % TOPIC_BAR_COLORS.length],
  }));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-[10px]">
      <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[360px]">
        <h2 className="text-[18px] font-semibold text-gray-800">
          Sentiment Categories
        </h2>
        <p className="mb-[12px] text-sm text-gray-500">
          Distribution of current public health sentiment categories across
          monitored conversations.
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
              formatter={legendFormatter}
            />
            <Pie
              data={sentimentCategoryData}
              cx="50%"
              cy="50%"
              outerRadius={90}
              dataKey="value"
              label={({ percent }) => `${Math.round(percent * 100)}%`}
            >
              {sentimentCategoryData.map((entry, index) => (
                <Cell key={`sentiment-category-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `${value}%`} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[360px]">
        <h2 className="text-[18px] font-semibold text-gray-800">
          Top Health Topics
        </h2>
        <p className="mb-[12px] text-sm text-gray-500">
          Leading health discussion topics by concern volume in recent sentiment
          pulse activity.
        </p>

        <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={topicChartData}
              layout="vertical"
              margin={{ top: 18, right: 36, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#E5E7EB"
              />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                stroke="#9CA3AF"
              />
              <YAxis
                hide
                dataKey="topic"
                type="category"
                tickLine={false}
                axisLine={false}
              />
              <Tooltip formatter={(value) => value.toLocaleString()} />
              <Bar
                dataKey="concerns"
                radius={[0, 8, 8, 0]}
                barSize={18}
                name="Concern Volume"
                label={({ x, y, width, value, index }) => (
                  <text
                    x={x}
                    y={y - 6}
                    fill="#374151"
                    className="text-[13px] font-medium"
                  >
                    <tspan>{topicChartData[index]?.topic}</tspan>
                    <tspan x={x + width + 10} fill="#1F2937">
                      {value.toLocaleString()}
                    </tspan>
                  </text>
                )}
              >
                {topicChartData.map((entry) => (
                  <Cell key={`topic-cell-${entry.topic}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="xl:col-span-2 bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[380px]">
        <h2 className="text-[18px] font-semibold text-gray-800">
          Sentiment Trends Over Time
        </h2>
        <p className="mb-[12px] text-sm text-gray-500">
          Daily movement of public health sentiment used to monitor changes in
          ongoing conversations.
        </p>

        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={sentimentTrendsData}
            margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="date" />
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
              formatter={legendFormatter}
            />
            {sentimentSeries.map((series) => (
              <Line
                key={series.dataKey}
                type="monotone"
                dataKey={series.dataKey}
                name={series.name}
                stroke={series.color}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
