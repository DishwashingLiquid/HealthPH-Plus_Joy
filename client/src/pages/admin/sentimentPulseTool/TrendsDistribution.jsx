/* eslint-disable react/prop-types */
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatCount, formatShare, isShare } from "./sentimentContract";

export default function TrendsDistribution({ title, rows, unavailable }) {
  return <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-5" aria-label={title}>
    <h3 className="mb-4 text-lg font-semibold text-gray-800">{title}</h3>
    {rows.some((row) => isShare(row.share)) ? <ResponsiveContainer width="100%" height={rows.length * 55 + 65}>
      <BarChart data={rows} layout="vertical" margin={{ top: 10, right: 25, left: 0, bottom: 15 }} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="label" width={85} tick={{ fontSize: 11 }} tickFormatter={(label) => label === "Neutral satisfaction" ? "Neutral" : label} />
        <Tooltip formatter={(value, _name, item) => [`${formatShare(value)} · ${formatCount(item.payload.answers)} answers`, item.payload.label]} />
        <Bar dataKey="share" name="Share" radius={[0, 6, 6, 0]} maxBarSize={24}>
          {rows.map((row) => <Cell key={row.label} fill={row.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer> : <p className="mb-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-5 text-sm text-gray-600">{unavailable}</p>}
    <table className="w-full text-left text-sm">
      <caption className="sr-only">{title}: exact percentages and answer counts</caption>
      <thead><tr><th scope="col" className="py-2 text-gray-600">Category</th><th scope="col" className="py-2 text-gray-600">Percent</th><th scope="col" className="py-2 text-right text-gray-600">Answers</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.label}>
        <th scope="row" className="border-t border-gray-100 py-2 font-medium" style={{ color: row.color }}>{row.label}</th>
        <td className="border-t border-gray-100 py-2">{formatShare(row.share)}</td>
        <td className="border-t border-gray-100 py-2 text-right">{formatCount(row.answers)}</td>
      </tr>)}</tbody>
    </table>
    {rows.some((row) => row.answers == null) && <p className="mt-2 text-xs text-gray-600">Some category results are not available.</p>}
  </section>;
}
