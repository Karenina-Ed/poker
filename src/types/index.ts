// 买入记录
export interface BuyInRecord {
  id: string;
  amount: number; // 买入金额
  timestamp: number;
}

// 结算记录
export interface CashOutRecord {
  amount: number; // 结算筹码
  timestamp: number;
}

// 玩家
export interface Player {
  id: string;
  name: string;
  buyIns: BuyInRecord[]; // 所有买入记录
  cashOut?: CashOutRecord; // 结算记录
  createdAt: number;
}

// 游戏会话
export interface GameSession {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  players: Player[];
  isActive: boolean;
  accessCode?: string; // 访问码，用于分享和加入游戏
}

// 统计数据
export interface GameStats {
  totalBuyIn: number; // 总买入
  totalCashOut: number; // 总结算
  totalProfit: number; // 总盈亏（应该为0）
  playerCount: number; // 玩家数
  activePlayerCount: number; // 未结算玩家数
}

// 玩家盈亏
export interface PlayerResult {
  player: Player;
  totalBuyIn: number;
  profit: number;
  isSettled: boolean;
}

// 总榜玩家数据
export interface TotalRankingPlayer {
  name: string;
  totalGames: number; // 参与游戏场次
  totalBuyIn: number; // 累计买入
  totalCashOut: number; // 累计结算
  totalProfit: number; // 累计盈亏
  winCount: number; // 盈利次数
  lossCount: number; // 亏损次数
  breakEvenCount: number; // 保本次数
  avgProfit: number; // 平均盈亏
}

// 总榜数据
export interface TotalRanking {
  players: TotalRankingPlayer[];
  totalGames: number; // 总游戏场次
  totalPool: number; // 总池子金额
}
