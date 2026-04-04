import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useOnlineGameSession } from '@/hooks/useOnlineGameSession';
import { GameList } from '@/sections/GameList';
import { PlayerManager } from '@/sections/PlayerManager';
import { StatsPanel } from '@/sections/StatsPanel';
import { TotalRanking } from '@/sections/TotalRanking';
import { 
  Users, 
  BarChart3, 
  List, 
  RotateCcw, 
  LogOut,
  Trophy,
  AlertTriangle,
  Crown,
  LogIn,
  Copy,
  Check,
  Share2,
  ArrowLeft
} from 'lucide-react';

function App() {
  const {
    sessions,
    currentSession,
    isLoaded,
    isLoading,
    error,
    createGame,
    joinGameByCode,
    loadGame,
    deleteGame,
    endGame,
    exitGame,
    addPlayer,
    removePlayer,
    updatePlayerName,
    addBuyIn,
    undoLastBuyIn,
    cashOutPlayer,
    cancelCashOut,
    resetCurrentGame,
    getStats,
    getPlayerResults,
    canFinalize,
    getTotalRanking,
    clearError,
  } = useOnlineGameSession();

  const [activeTab, setActiveTab] = useState('players');
  const [showEndGameDialog, setShowEndGameDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);

  // 加载状态
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  const totalRanking = getTotalRanking();

  // 没有当前游戏时显示总榜
  if (!currentSession) {
    return (
      <div className="min-h-screen bg-background">
        {/* 顶部导航 */}
        <header className="border-b border-border/50 bg-card/80 backdrop-blur sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-full flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-black" />
                </div>
                <div>
                  <h1 className="font-bold text-base gold-gradient">德州扑克记分榜</h1>
                  <p className="text-xs text-muted-foreground">总榜 · {totalRanking.totalGames}场 · {totalRanking.players.length}人</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8"
                  onClick={() => setShowJoinDialog(true)}
                >
                  <LogIn className="w-3 h-3 mr-1" />
                  加入
                </Button>
                <Button 
                  size="sm" 
                  className="h-8"
                  onClick={() => createGame()}
                  disabled={isLoading}
                >
                  <Crown className="w-3 h-3 mr-1" />
                  新建
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* 总榜内容 */}
        <main className="max-w-7xl mx-auto px-4 py-6">
          <TotalRanking ranking={totalRanking} isHomePage />
        </main>

        {/* 加入游戏对话框 */}
        <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LogIn className="w-5 h-5" />
                加入游戏
              </DialogTitle>
              <DialogDescription>
                输入访问码加入已有游戏
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Input
                placeholder="输入6位访问码"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="text-center text-lg tracking-widest"
              />
              <Button 
                onClick={async () => {
                  const session = await joinGameByCode(joinCode);
                  if (session) {
                    setJoinCode('');
                    setShowJoinDialog(false);
                  }
                }} 
                className="w-full"
                disabled={joinCode.length !== 6 || isLoading}
              >
                {isLoading ? '加入中...' : '加入游戏'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* 错误提示 */}
        {error && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg shadow-lg">
            {error}
            <button onClick={clearError} className="ml-2 text-sm underline">关闭</button>
          </div>
        )}
      </div>
    );
  }

  const stats = getStats();
  const playerResults = getPlayerResults();
  const isFinalized = canFinalize();

  const handleEndGame = () => {
    endGame();
    setShowEndGameDialog(false);
  };

  const handleReset = () => {
    resetCurrentGame();
    setShowResetDialog(false);
  };

  const handleDeleteConfirm = () => {
    if (sessionToDelete) {
      deleteGame(sessionToDelete);
      setSessionToDelete(null);
      setShowDeleteDialog(false);
    }
  };

  const handleCopyCode = () => {
    if (currentSession.accessCode) {
      navigator.clipboard.writeText(currentSession.accessCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={exitGame}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-full flex items-center justify-center">
                <Trophy className="w-4 h-4 text-black" />
              </div>
              <div>
                <h1 className="font-bold text-sm">{currentSession.name}</h1>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>买入: <span className="text-foreground">{stats.totalBuyIn}</span></span>
                  <span className="text-border">|</span>
                  <span>结算: <span className="text-foreground">{stats.totalCashOut}</span></span>
                  <span className="text-border">|</span>
                  <span>{currentSession.players.length}人</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {currentSession.accessCode && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 hidden sm:flex"
                  onClick={() => setShowShareDialog(true)}
                >
                  <Share2 className="w-3 h-3 mr-1" />
                  分享
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:flex h-8"
                onClick={() => setShowResetDialog(true)}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                重置
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:flex h-8"
                onClick={() => setShowEndGameDialog(true)}
              >
                <LogOut className="w-3 h-3 mr-1" />
                结束
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* 桌面端标签 */}
          <div className="hidden md:block">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="players" className="gap-2">
                <Users className="w-4 h-4" />
                玩家管理
              </TabsTrigger>
              <TabsTrigger value="stats" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                统计面板
              </TabsTrigger>
              <TabsTrigger value="ranking" className="gap-2">
                <Crown className="w-4 h-4" />
                总榜
              </TabsTrigger>
              <TabsTrigger value="games" className="gap-2">
                <List className="w-4 h-4" />
                游戏列表
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 移动端底部导航 */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-50">
            <TabsList className="w-full grid grid-cols-4 rounded-none">
              <TabsTrigger value="players" className="gap-1 flex-col py-3">
                <Users className="w-5 h-5" />
                <span className="text-xs">玩家</span>
              </TabsTrigger>
              <TabsTrigger value="stats" className="gap-1 flex-col py-3">
                <BarChart3 className="w-5 h-5" />
                <span className="text-xs">统计</span>
              </TabsTrigger>
              <TabsTrigger value="ranking" className="gap-1 flex-col py-3">
                <Crown className="w-5 h-5" />
                <span className="text-xs">总榜</span>
              </TabsTrigger>
              <TabsTrigger value="games" className="gap-1 flex-col py-3">
                <List className="w-5 h-5" />
                <span className="text-xs">游戏</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 玩家管理 */}
          <TabsContent value="players" className="space-y-4">
            <PlayerManager
              players={currentSession.players}
              onAddPlayer={addPlayer}
              onRemovePlayer={removePlayer}
              onUpdatePlayerName={updatePlayerName}
              onAddBuyIn={addBuyIn}
              onUndoLastBuyIn={undoLastBuyIn}
              onCashOut={cashOutPlayer}
              onCancelCashOut={cancelCashOut}
            />
          </TabsContent>

          {/* 统计面板 */}
          <TabsContent value="stats" className="space-y-4">
            <StatsPanel
              stats={stats}
              playerResults={playerResults}
              canFinalize={isFinalized}
            />
          </TabsContent>

          {/* 总榜 */}
          <TabsContent value="ranking" className="space-y-4">
            <TotalRanking ranking={totalRanking} />
          </TabsContent>

          {/* 游戏列表 */}
          <TabsContent value="games" className="space-y-4">
            <GameList
              sessions={sessions}
              currentSession={currentSession}
              onCreateGame={createGame}
              onLoadGame={loadGame}
              onDeleteGame={(id) => {
                setSessionToDelete(id);
                setShowDeleteDialog(true);
              }}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* 移动端底部留白 */}
      <div className="md:hidden h-20" />

      {/* 分享对话框 */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              分享游戏
            </DialogTitle>
            <DialogDescription>
              分享访问码给其他玩家，他们可以直接加入游戏
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-lg p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">访问码</p>
                <p className="text-2xl font-bold tracking-widest font-mono">
                  {currentSession.accessCode}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-14 w-14"
                onClick={handleCopyCode}
              >
                {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              其他玩家点击"加入"按钮，输入访问码即可加入
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* 结束游戏对话框 */}
      <Dialog open={showEndGameDialog} onOpenChange={setShowEndGameDialog}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="w-5 h-5" />
              结束游戏
            </DialogTitle>
            <DialogDescription>
              结束游戏后，当前游戏将被标记为已完成，但数据会被保留。你可以随时从历史记录中查看。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEndGameDialog(false)}>
              取消
            </Button>
            <Button onClick={handleEndGame}>
              确认结束
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置游戏对话框 */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              重置游戏
            </AlertDialogTitle>
            <AlertDialogDescription>
              这将清除所有玩家的买入和结算记录，但保留玩家列表。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              确认重置
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除游戏对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              删除游戏
            </AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个游戏吗？所有数据将被永久删除，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSessionToDelete(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 错误提示 */}
      {error && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg shadow-lg z-50">
          {error}
          <button onClick={clearError} className="ml-2 text-sm underline">关闭</button>
        </div>
      )}
    </div>
  );
}

export default App;
