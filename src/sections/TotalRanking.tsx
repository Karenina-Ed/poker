import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  TrendingDown, 
  Trophy,
  Target,
  BarChart3,
  Crown,
  Medal,
  Award,
  Users,
  Wallet,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import type { TotalRanking as TotalRankingType } from '@/types';

interface TotalRankingProps {
  ranking: TotalRankingType;
  isHomePage?: boolean;
}

export function TotalRanking({ ranking, isHomePage = false }: TotalRankingProps) {
  const { players, totalGames, totalPool } = ranking;
  const [showDetails, setShowDetails] = useState(false);

  // 获取排名图标
  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 flex items-center justify-center shadow-lg shadow-yellow-500/30">
            <Crown className="w-5 h-5 text-black" />
          </div>
        );
      case 1:
        return (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center shadow-lg shadow-gray-400/30">
            <Medal className="w-5 h-5 text-black" />
          </div>
        );
      case 2:
        return (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Award className="w-5 h-5 text-black" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <span className="text-lg font-bold text-muted-foreground">{index + 1}</span>
          </div>
        );
    }
  };

  // 格式化大数字
  const formatNumber = (num: number) => {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + 'w';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };

  if (players.length === 0) {
    return (
      <div className="space-y-4">
        {!isHomePage && <h2 className="text-2xl font-bold">总榜</h2>}
        <Card className="border-dashed border-muted">
          <CardContent className="py-16 text-center">
            <div className="text-muted-foreground">
              <Trophy className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg">还没有已结束的游戏</p>
              <p className="text-sm mt-2">结束游戏后将在这里显示累计数据</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 计算统计数据
  const totalProfit = players.reduce((sum, p) => sum + p.totalProfit, 0);
  const topWinner = players[0];
  const topLoser = players[players.length - 1];
  const avgProfit = totalProfit / players.length;

  return (
    <div className="space-y-6">
      {/* 最醒目的盈亏排行榜 */}
      <Card className="overflow-hidden border-0 bg-gradient-to-b from-card to-background">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            <span className="gold-gradient">累计盈亏排行</span>
            <Sparkles className="w-5 h-5 text-yellow-400" />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className={isHomePage ? "h-[calc(100vh-280px)]" : "h-[500px]"}>
            <div className="space-y-2 p-4">
              {players.map((player, index) => (
                <div
                  key={player.name}
                  className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                    index === 0 
                      ? 'bg-gradient-to-r from-yellow-500/20 via-amber-500/10 to-transparent border border-yellow-500/30' 
                      : index === 1
                        ? 'bg-gradient-to-r from-gray-400/20 via-gray-300/10 to-transparent border border-gray-400/30'
                        : index === 2
                          ? 'bg-gradient-to-r from-amber-600/20 via-amber-500/10 to-transparent border border-amber-600/30'
                          : 'bg-card/50 border border-border/50'
                  }`}
                >
                  {getRankIcon(index)}
                  
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold truncate ${index < 3 ? 'text-lg' : 'text-base'}`}>
                      {player.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{player.totalGames}场</span>
                      <span className="text-border">|</span>
                      <span className={player.winCount / player.totalGames >= 0.5 ? 'text-green-400' : 'text-red-400'}>
                        胜率 {((player.winCount / player.totalGames) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`text-2xl font-black tracking-tight ${
                      player.totalProfit >= 0 
                        ? 'text-green-400 profit-glow-positive' 
                        : 'text-red-400 profit-glow-negative'
                    }`}>
                      {player.totalProfit >= 0 ? '+' : ''}{formatNumber(player.totalProfit)}
                    </div>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-green-500/20 text-green-400 border-0">
                        胜{player.winCount}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-red-500/20 text-red-400 border-0">
                        负{player.lossCount}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 展开/收起其他数据 */}
      <div className="flex justify-center">
        <Button 
          variant="outline" 
          onClick={() => setShowDetails(!showDetails)}
          className="gap-2"
        >
          {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {showDetails ? '收起数据' : '查看更多数据'}
        </Button>
      </div>

      {/* 其他数据（默认折叠） */}
      {showDetails && (
        <div className="space-y-4 animate-slide-in">
          {/* 概览卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">总场次</p>
                    <p className="text-xl font-bold">{totalGames}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Target className="w-4 h-4 text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">总流水</p>
                    <p className="text-xl font-bold">{formatNumber(totalPool)}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">参与人数</p>
                    <p className="text-xl font-bold">{players.length}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Users className="w-4 h-4 text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">人均盈亏</p>
                    <p className={`text-xl font-bold ${avgProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {avgProfit >= 0 ? '+' : ''}{formatNumber(avgProfit)}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-amber-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 最高记录 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="border-green-500/30 bg-green-500/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Crown className="w-6 h-6 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">最大赢家</p>
                    <p className="text-lg font-bold">{topWinner.name}</p>
                    <p className="text-sm text-green-400 font-bold">
                      +{formatNumber(topWinner.totalProfit)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-500/30 bg-red-500/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                    <TrendingDown className="w-6 h-6 text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">最大输家</p>
                    <p className="text-lg font-bold">{topLoser.name}</p>
                    <p className="text-sm text-red-400 font-bold">
                      {formatNumber(topLoser.totalProfit)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 详细数据表格 */}
          <Card className="bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">详细数据</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-2 px-2 text-xs text-muted-foreground">排名</th>
                      <th className="text-left py-2 px-2 text-xs text-muted-foreground">玩家</th>
                      <th className="text-right py-2 px-2 text-xs text-muted-foreground">场次</th>
                      <th className="text-right py-2 px-2 text-xs text-muted-foreground">总买入</th>
                      <th className="text-right py-2 px-2 text-xs text-muted-foreground">总结算</th>
                      <th className="text-right py-2 px-2 text-xs text-muted-foreground">盈亏</th>
                      <th className="text-right py-2 px-2 text-xs text-muted-foreground">场均</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player, index) => (
                      <tr key={player.name} className="border-b border-border/30 last:border-0 hover:bg-muted/30">
                        <td className="py-2 px-2">
                          {index < 3 ? (
                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                              index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                              index === 1 ? 'bg-gray-400/20 text-gray-400' :
                              'bg-amber-600/20 text-amber-400'
                            }`}>
                              {index + 1}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">{index + 1}</span>
                          )}
                        </td>
                        <td className="py-2 px-2 font-medium">{player.name}</td>
                        <td className="text-right py-2 px-2 text-xs">{player.totalGames}</td>
                        <td className="text-right py-2 px-2 text-xs text-muted-foreground">{formatNumber(player.totalBuyIn)}</td>
                        <td className="text-right py-2 px-2 text-xs text-muted-foreground">{formatNumber(player.totalCashOut)}</td>
                        <td className={`text-right py-2 px-2 font-bold ${
                          player.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {player.totalProfit >= 0 ? '+' : ''}{formatNumber(player.totalProfit)}
                        </td>
                        <td className={`text-right py-2 px-2 text-xs ${
                          player.avgProfit >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {player.avgProfit >= 0 ? '+' : ''}{formatNumber(player.avgProfit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
