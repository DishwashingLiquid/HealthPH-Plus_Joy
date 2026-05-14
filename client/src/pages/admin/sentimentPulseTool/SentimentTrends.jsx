import React from "react";
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

export default function SentimentTrends() {
  return (
    <div className="space-y-6">
      {/* Line Chart - Sentiment Trends Over Time (Full Width) */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Sentiment Trends Over Time
        </h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={sentimentTrendsData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="date" stroke="#6B7280" />
            <YAxis stroke="#6B7280" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: "6px",
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="concerned"
              stroke={sentimentColors.Concerned}
              strokeWidth={2}
              name="Concerned"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="proactive"
              stroke={sentimentColors.Proactive}
              strokeWidth={2}
              name="Proactive"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="misinformed"
              stroke={sentimentColors.Misinformed}
              strokeWidth={2}
              name="Misinformed"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="neutral"
              stroke={sentimentColors.Neutral}
              strokeWidth={2}
              name="Neutral"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Pie Chart and Bar Chart Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart - Sentiment Categories */}
        <div className="bg-white shadow-sm rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Sentiment Categories
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={sentimentCategories}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.percentage}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {sentimentCategories.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value}%`} />
            </PieChart>
          </ResponsiveContainer>
          {/* Legend for Pie Chart */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {sentimentCategories.map((category) => (
              <div key={category.name} className="flex items-center text-sm">
                <span
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: category.color }}
                ></span>
                <span className="text-gray-700">
                  {category.name}: {category.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Horizontal Bar Chart - Top Health Topics */}
        <div className="bg-white shadow-sm rounded-lg p-6 flex flex-col h-full">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Top Health Topics
          </h3>
          <ResponsiveContainer width="100%" height="100%" minHeight={400}>
            <BarChart
              data={topHealthTopics}
              layout="vertical"
              margin={{ top: 5, right: 5, left: 25, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis type="number" stroke="#6B7280" />
              <YAxis dataKey="topic" type="category" stroke="#6B7280" width={155} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: "6px",
                }}
              />
              <Bar
                dataKey="concerns"
                fill="#3B82F6"
                radius={[0, 8, 8, 0]}
                name="Number of Concerns"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
