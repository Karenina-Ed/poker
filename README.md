# 🃏 德州房间账本 Pro (Texas Hold'em Poker Ledger)

一款专为德州扑克线下组局设计的现代化对账与记分单页应用 (SPA)。告别繁琐的纸笔对账，帮助房主与玩家轻松管理买入（Buy-in）、重买（Rebuy）、离桌提现（Cash-out），并自动结算盈亏。

## ✨ 核心功能 (Features)

- **🏆 炫酷 3D 排行榜**：内置独立的高对比领奖台视图，带有专属金银牌荣誉动画与实时收益展示。
- **☁️ 云端房间同步**：基于 Supabase 进行游戏状态的实时上云。分享房间专属邀请链接（或者房间码），任何设备均可无缝加入同一牌局。
- **💰 记账与结算全自动化**：支持记录成员的多次买入与随时清盘离桌，游戏结束后智能计算每位玩家的最终盈亏 (PnL)。
- **📈 统计与复盘**：自动保存并梳理过去的房间清盘历史，内置趋势图帮助玩家回顾历史战绩。
- **🧹 缓存管理**：内置一键“应用重建”功能清理异常及废弃的数据缓存，保证客户端时刻干爽运行。

## 🛠 技术栈 (Tech Stack)

该项目基于前沿 Web 开发工具构建，保证了极为快速流畅的用户体验：

- **核心框架**: [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- **构建工具**: [Vite](https://vitejs.dev)
- **UI & 样式**: [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com/) (Radix UI 基建) + [Lucide Icons](https://lucide.dev/)
- **后端 & 数据库同步**: [Supabase](https://supabase.com)
- **部署平台**: [Vercel](https://vercel.com/)

## ☁️ Supabase 数据库配置 (Database Setup)

要使云端房间同步完全工作，你需要前往 Supabase 后台的 **SQL Editor** 中执行下方的建表语句（同时会开启允许所有人读写的 RLS 策略）：

```sql
-- 创建游戏房间/会话主表
CREATE TABLE public.game_sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text,
    access_code text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 添加访问码索引以供快速查找
CREATE UNIQUE INDEX idx_game_sessions_access_code ON public.game_sessions(access_code);

-- 创建玩家状态（及云端序列化状态）表
CREATE TABLE public.players (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id uuid REFERENCES public.game_sessions(id) ON DELETE CASCADE,
    name text NOT NULL,
    buy_ins jsonb DEFAULT '[]'::jsonb,
    cash_out jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- 添加外键与专用标识名称索引
CREATE INDEX idx_players_session_id ON public.players(session_id);
CREATE INDEX idx_players_name ON public.players(name);

-- 开启所有表的 RLS (Row-Level Security)
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- 允许所有客户端匿名（anon）进行任意增删改查
-- 注意：这里为了方便无登录的快速组局而开放了最高读写权限，实际商用需加上更严格的 User Auth 策略
CREATE POLICY "Allow public all access to game_sessions" ON public.game_sessions FOR ALL USING (true);
CREATE POLICY "Allow public all access to players" ON public.players FOR ALL USING (true);
```

## 🚀 本地开发 (Local Development)

### 1. 克隆代码 & 安装依赖
```bash
git clone https://github.com/Karenina-Ed/poker.git
cd poker
npm install
```

### 2. 环境配置
在项目根目录创建 `.env.local` 文件，并将其设为你的专属 Supabase 凭证：
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

### 3. 启动开发服务器
```bash
npm run dev
```
服务器启动后，浏览器打开 `http://localhost:5173` 即可预览。

## 🌐 线上部署 (Deployment)

推荐使用 **Vercel** 进行快速零配置部署：
```bash
npm install -g vercel
npx vercel
```
*提示：在部署到生产环境（Production）时，请务必在 Vercel 面板或者通过 CLI(`vercel env add`) 添加上述 `VITE_SUPABASE_URL` 以及 `VITE_SUPABASE_PUBLISHABLE_KEY` 环境变量，否则应用会由于缺少关键配置导致白屏。*

## 📜 许可证 (License)
本项目仅供用于朋友间积分娱乐与账目梳理，请勿将其用作任何涉及真实资金的非法用途。

---
*Created by [yejiangtao] - Have fun and fold pre-flop!*
