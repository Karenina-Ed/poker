import { Suspense, lazy, memo } from 'react';
import { Award, Crown, Medal, Trophy, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const HistoryTrendChart = lazy(() => import('./HistoryTrendChart'));

export interface RankingRow {
  name: string;
  games: number;
  total: number;
  avg: number;
  bbPerHour: number;
  maxDrawdown: number;
}

interface HistoryStatsPanelProps {
  rankingRows: RankingRow[];
  trendData: Array<Record<string, number | string>>;
  formatMoney: (value: number) => string;
}

export const HistoryStatsPanel = memo(function HistoryStatsPanel({
  rankingRows,
  trendData,
  formatMoney,
}: HistoryStatsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">长期统计</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rankingRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无历史数据。完成一次清盘后自动生成统计。</p>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-gradient-to-br from-amber-500/15 via-background to-cyan-500/10 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold tracking-wide text-amber-300">累计盈亏榜</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Trophy className="h-3.5 w-3.5 text-amber-300" />
                  按总盈亏排序
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {rankingRows.slice(0, 3).map((row, index) => (
                  <div
                    key={`podium-${row.name}`}
                    className={`rounded-xl border p-4 ${
                      index === 0
                        ? 'border-amber-300/50 bg-amber-400/10'
                        : index === 1
                          ? 'border-slate-300/40 bg-slate-200/5'
                          : 'border-orange-400/40 bg-orange-400/10'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {index === 0 ? (
                          <Crown className="h-5 w-5 text-amber-300" />
                        ) : index === 1 ? (
                          <Medal className="h-5 w-5 text-slate-300" />
                        ) : (
                          <Award className="h-5 w-5 text-orange-300" />
                        )}
                        <span className="text-xs font-bold">#{index + 1}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {row.games} 场
                      </Badge>
                    </div>
                    <p className="truncate text-base font-bold">{row.name}</p>
                    <p
                      className={`mt-2 text-2xl font-black tracking-tight ${
                        row.total >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {formatMoney(row.total)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">场均 {formatMoney(row.avg)} · BB/h {row.bbPerHour}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 space-y-2">
                {rankingRows.map((row, index) => (
                  <div
                    key={`rank-row-${row.name}`}
                    className="flex items-center justify-between rounded-lg border border-border/70 bg-card/70 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                          index === 0
                            ? 'bg-amber-300/25 text-amber-200'
                            : index === 1
                              ? 'bg-slate-300/20 text-slate-200'
                              : index === 2
                                ? 'bg-orange-400/25 text-orange-200'
                                : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{row.name}</p>
                        <p className="text-xs text-muted-foreground">最大回撤 {row.maxDrawdown}</p>
                      </div>
                    </div>
                    <p className={`text-lg font-black ${row.total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatMoney(row.total)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-2 text-left">玩家</th>
                    <th className="p-2 text-right">总盈亏</th>
                    <th className="p-2 text-right">场均</th>
                    <th className="p-2 text-right">BB/小时</th>
                    <th className="p-2 text-right">最大回撤</th>
                  </tr>
                </thead>
                <tbody>
                  {rankingRows.map((row) => (
                    <tr key={row.name} className="border-b border-border/50">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{row.name}</span>
                        </div>
                      </td>
                      <td className={`p-2 text-right ${row.total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatMoney(row.total)}
                      </td>
                      <td className="p-2 text-right">{formatMoney(row.avg)}</td>
                      <td className="p-2 text-right">{row.bbPerHour}</td>
                      <td className="p-2 text-right text-red-400">{row.maxDrawdown}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="h-64 w-full rounded-md border border-border p-2">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">图表加载中...</div>
                }
              >
                <HistoryTrendChart trendData={trendData} rankingRows={rankingRows} />
              </Suspense>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
});
