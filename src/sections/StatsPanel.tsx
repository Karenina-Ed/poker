import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Wallet, 
  Coins,
  AlertCircle,
  CheckCircle2,
  Crown
} from 'lucide-react';
import type { GameStats, PlayerResult } from '@/types';

interface StatsPanelProps {
  stats: GameStats;
  playerResults: PlayerResult[];
  canFinalize: boolean;
}

export function StatsPanel({ stats, playerResults, canFinalize }: StatsPanelProps) {
  // 按盈亏排序
  const sortedResults = [...playerResults].sort((a, b) => b.profit - a.profit);
  const winners = sortedResults.filter(r => r.profit > 0);
  const losers = sortedResults.filter(r => r.profit < 0);
  const breakEvens = sortedResults.filter(r => r.profit === 0);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">统计面板</h2>
      
      {/* 关键指标 */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">总买入</p>
                <p className="text-xl font-bold">{stats.totalBuyIn}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">总结算</p>
                <p className="text-xl font-bold">{stats.totalCashOut}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                <Coins className="w-4 h-4 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">池子差额</p>
                <p className={`text-xl font-bold ${stats.totalProfit === 0 ? 'text-green-400' : 'text-amber-400'}`}>
                  {stats.totalProfit > 0 ? '+' : ''}{stats.totalProfit}
                </p>
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${stats.totalProfit === 0 ? 'bg-green-500/20' : 'bg-amber-500/20'}`}>
                {stats.totalProfit === 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">玩家状态</p>
                <p className="text-xl font-bold">
                  {stats.playerCount - stats.activePlayerCount}/{stats.playerCount}
                </p>
                <p className="text-[10px] text-muted-foreground">已结算/总数</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 结算状态 */}
      <Card className={canFinalize ? 'border-green-500/50 bg-green-500/10' : 'bg-card/50'}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {canFinalize ? (
              <>
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-green-400">可以结算</p>
                  <p className="text-sm text-green-400/70">所有玩家已结算，池子平衡</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-amber-400">等待结算</p>
                  <p className="text-sm text-amber-400/70">
                    {stats.activePlayerCount > 0 
                      ? `还有 ${stats.activePlayerCount} 位玩家未结算` 
                      : stats.totalProfit !== 0 
                        ? `池子不平衡，差额 ${stats.totalProfit}` 
                        : '准备就绪'}
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 排行榜 */}
      {sortedResults.length > 0 && (
        <Card className="bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-400" />
              盈亏排行
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[300px]">
              <div className="space-y-1 p-4 pt-0">
                {/* 赢家 */}
                {winners.map((result, index) => (
                  <div
                    key={result.player.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-xs flex items-center justify-center font-bold">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium">{result.player.name}</p>
                        <p className="text-xs text-muted-foreground">
                          买入: {result.totalBuyIn}
                          {result.player.cashOut && ` → 结算: ${result.player.cashOut.amount}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      <span className="font-bold text-green-400">+{result.profit}</span>
                    </div>
                  </div>
                ))}

                {/* 保本 */}
                {breakEvens.map((result) => (
                  <div
                    key={result.player.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-bold">
                        -
                      </span>
                      <div>
                        <p className="font-medium">{result.player.name}</p>
                        <p className="text-xs text-muted-foreground">
                          买入: {result.totalBuyIn}
                          {result.player.cashOut && ` → 结算: ${result.player.cashOut.amount}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-muted-foreground">0</span>
                    </div>
                  </div>
                ))}

                {/* 输家 */}
                {losers.map((result, index) => (
                  <div
                    key={result.player.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 text-xs flex items-center justify-center font-bold">
                        {winners.length + breakEvens.length + index + 1}
                      </span>
                      <div>
                        <p className="font-medium">{result.player.name}</p>
                        <p className="text-xs text-muted-foreground">
                          买入: {result.totalBuyIn}
                          {result.player.cashOut && ` → 结算: ${result.player.cashOut.amount}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-red-400" />
                      <span className="font-bold text-red-400">{result.profit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* 转账建议 */}
      {canFinalize && sortedResults.length > 0 && (
        <Card className="bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">转账建议</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {(() => {
                const transfers: { from: string; to: string; amount: number }[] = [];
                const debtors = losers.map(r => ({ name: r.player.name, amount: -r.profit }));
                const creditors = winners.map(r => ({ name: r.player.name, amount: r.profit }));
                
                let i = 0, j = 0;
                while (i < debtors.length && j < creditors.length) {
                  const transfer = Math.min(debtors[i].amount, creditors[j].amount);
                  if (transfer > 0) {
                    transfers.push({
                      from: debtors[i].name,
                      to: creditors[j].name,
                      amount: transfer,
                    });
                  }
                  debtors[i].amount -= transfer;
                  creditors[j].amount -= transfer;
                  if (debtors[i].amount <= 0.01) i++;
                  if (creditors[j].amount <= 0.01) j++;
                }

                return transfers.length === 0 ? (
                  <p className="text-muted-foreground">无需转账，所有人保本</p>
                ) : (
                  transfers.map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <span className="font-medium text-red-400">{t.from}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium text-green-400">{t.to}</span>
                      <span className="font-bold">{t.amount}</span>
                    </div>
                  ))
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
