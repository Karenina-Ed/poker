import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface HistoryTrendChartProps {
  trendData: Array<Record<string, number | string>>;
  rankingRows: Array<{ name: string }>;
}

export default function HistoryTrendChart({ trendData, rankingRows }: HistoryTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={trendData}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="label" />
        <YAxis />
        <Tooltip />
        {rankingRows.slice(0, 4).map((row, index) => (
          <Line
            key={row.name}
            type="monotone"
            dataKey={row.name}
            stroke={['#22c55e', '#f59e0b', '#60a5fa', '#f43f5e'][index % 4]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
