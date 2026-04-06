import { useState, useEffect, useCallback, useRef } from 'react';
import {
  createGameSession,
  getGameSession,
  getGameSessionByCode,
  getAllGameSessions,
  endGameSession,
  deleteGameSession,
  addPlayer as addPlayerDB,
  removePlayer as removePlayerDB,
  updatePlayerName as updatePlayerNameDB,
  addBuyIn as addBuyInDB,
  undoLastBuyIn as undoLastBuyInDB,
  cashOutPlayer as cashOutPlayerDB,
  cancelCashOut as cancelCashOutDB,
  subscribeToSession,
} from '@/lib/supabase';
import type { GameSession, GameStats, PlayerResult, TotalRanking, TotalRankingPlayer } from '@/types';

// 本地存储当前会话ID
const CURRENT_SESSION_KEY = 'poker-current-session-id';

export function useOnlineGameSession() {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // 初始化加载
  useEffect(() => {
    const init = async () => {
      try {
        // 加载所有会话
        const allSessions = await getAllGameSessions();
        setSessions(allSessions);

        // 尝试恢复上次会话
        const savedSessionId = localStorage.getItem(CURRENT_SESSION_KEY);
        if (savedSessionId) {
          const session = await getGameSession(savedSessionId);
          if (session) {
            setCurrentSession(session);
            // 订阅实时更新
            unsubscribeRef.current = subscribeToSession(session.id, (updatedSession) => {
              setCurrentSession(updatedSession);
            });
          }
        }
      } catch (error) {
        console.error('Init error:', error);
        setError('初始化失败，请检查网络连接');
      } finally {
        setIsLoaded(true);
      }
    };

    init();

    // 清理订阅
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // 创建新游戏
  const createGame = useCallback(async (name?: string) => {
    setIsLoading(true);
    try {
      const newSession = await createGameSession(name);
      if (!newSession) {
        throw new Error('创建游戏失败');
      }
      const sessionId = newSession.id;
      setSessions((prev) => [newSession, ...prev]);
      setCurrentSession(newSession);
      localStorage.setItem(CURRENT_SESSION_KEY, sessionId);

      // 取消旧订阅，订阅新会话
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      unsubscribeRef.current = subscribeToSession(sessionId, (updatedSession) => {
        setCurrentSession(updatedSession);
      });

      return newSession;
    } catch {
      setError('创建游戏失败');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 通过访问码加入游戏
  const joinGameByCode = useCallback(async (accessCode: string) => {
    setIsLoading(true);
    try {
      const session = await getGameSessionByCode(accessCode);
      if (session) {
        setCurrentSession(session);
        localStorage.setItem(CURRENT_SESSION_KEY, session.id);

        // 取消旧订阅，订阅新会话
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }
        unsubscribeRef.current = subscribeToSession(session.id, (updatedSession) => {
          setCurrentSession(updatedSession);
        });

        // 更新会话列表
        const allSessions = await getAllGameSessions();
        setSessions(allSessions);

        return session;
      }
      throw new Error('游戏不存在');
    } catch {
      setError('加入游戏失败，请检查访问码');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 加载游戏
  const loadGame = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    try {
      const session = await getGameSession(sessionId);
      if (session) {
        setCurrentSession(session);
        localStorage.setItem(CURRENT_SESSION_KEY, sessionId);

        // 取消旧订阅，订阅新会话
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }
        unsubscribeRef.current = subscribeToSession(sessionId, (updatedSession) => {
          setCurrentSession(updatedSession);
        });

        return session;
      }
      throw new Error('游戏不存在');
    } catch {
      setError('加载游戏失败');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 删除游戏
  const deleteGame = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    try {
      const success = await deleteGameSession(sessionId);
      if (success) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (currentSession?.id === sessionId) {
          setCurrentSession(null);
          localStorage.removeItem(CURRENT_SESSION_KEY);
          if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
          }
        }
        return true;
      }
      throw new Error('删除失败');
    } catch {
      setError('删除游戏失败');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentSession]);

  // 结束游戏
  const endGame = useCallback(async () => {
    if (!currentSession) return;
    setIsLoading(true);
    try {
      const success = await endGameSession(currentSession.id);
      if (success) {
        const updatedSession = { ...currentSession, isActive: false };
        setCurrentSession(updatedSession);
        setSessions((prev) =>
          prev.map((s) => (s.id === currentSession.id ? updatedSession : s))
        );
      }
      } catch {
      setError('结束游戏失败');
    } finally {
      setIsLoading(false);
    }
  }, [currentSession]);

  // 添加玩家
  const addPlayer = useCallback(
    async (name: string, initialBuyIn: number = 0) => {
      if (!currentSession) return null;
      setIsLoading(true);
      try {
        const player = await addPlayerDB(currentSession.id, name, initialBuyIn);
        if (player) {
          const updatedSession = {
            ...currentSession,
            players: [...currentSession.players, player],
          };
          setCurrentSession(updatedSession);
          return player;
        }
        throw new Error('添加玩家失败');
      } catch {
        setError('添加玩家失败');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [currentSession]
  );

  // 删除玩家
  const removePlayer = useCallback(
    async (playerId: string) => {
      if (!currentSession) return;
      setIsLoading(true);
      try {
        const success = await removePlayerDB(playerId, currentSession.id);
        if (success) {
          const updatedSession = {
            ...currentSession,
            players: currentSession.players.filter((p) => p.id !== playerId),
          };
          setCurrentSession(updatedSession);
        }
      } catch {
        setError('删除玩家失败');
      } finally {
        setIsLoading(false);
      }
    },
    [currentSession]
  );

  // 更新玩家名称
  const updatePlayerName = useCallback(
    async (playerId: string, name: string) => {
      if (!currentSession) return;
      setIsLoading(true);
      try {
        const success = await updatePlayerNameDB(playerId, name, currentSession.id);
        if (success) {
          const updatedSession = {
            ...currentSession,
            players: currentSession.players.map((p) =>
              p.id === playerId ? { ...p, name: name.trim() } : p
            ),
          };
          setCurrentSession(updatedSession);
        }
      } catch {
        setError('更新玩家名称失败');
      } finally {
        setIsLoading(false);
      }
    },
    [currentSession]
  );

  // 添加买入
  const addBuyIn = useCallback(
    async (playerId: string, amount: number) => {
      if (!currentSession || amount <= 0) return;
      setIsLoading(true);
      try {
        const success = await addBuyInDB(playerId, amount, currentSession.id);
        if (success) {
          const updatedSession = {
            ...currentSession,
            players: currentSession.players.map((p) =>
              p.id === playerId
                ? {
                    ...p,
                    buyIns: [
                      ...p.buyIns,
                      {
                        id: crypto.randomUUID(),
                        amount,
                        timestamp: Date.now(),
                      },
                    ],
                  }
                : p
            ),
          };
          setCurrentSession(updatedSession);
        }
      } catch {
        setError('添加买入失败');
      } finally {
        setIsLoading(false);
      }
    },
    [currentSession]
  );

  // 撤销最后一次买入
  const undoLastBuyIn = useCallback(
    async (playerId: string) => {
      if (!currentSession) return;
      setIsLoading(true);
      try {
        const success = await undoLastBuyInDB(playerId, currentSession.id);
        if (success) {
          const updatedSession = {
            ...currentSession,
            players: currentSession.players.map((p) => {
              if (p.id === playerId && p.buyIns.length > 0) {
                return { ...p, buyIns: p.buyIns.slice(0, -1) };
              }
              return p;
            }),
          };
          setCurrentSession(updatedSession);
        }
      } catch {
        setError('撤销买入失败');
      } finally {
        setIsLoading(false);
      }
    },
    [currentSession]
  );

  // 结算玩家
  const cashOutPlayer = useCallback(
    async (playerId: string, amount: number) => {
      if (!currentSession) return;
      setIsLoading(true);
      try {
        const success = await cashOutPlayerDB(playerId, amount, currentSession.id);
        if (success) {
          const updatedSession = {
            ...currentSession,
            players: currentSession.players.map((p) =>
              p.id === playerId
                ? {
                    ...p,
                    cashOut: {
                      amount,
                      timestamp: Date.now(),
                    },
                  }
                : p
            ),
          };
          setCurrentSession(updatedSession);
        }
        } catch {
        setError('结算失败');
      } finally {
        setIsLoading(false);
      }
    },
    [currentSession]
  );

  // 取消结算
  const cancelCashOut = useCallback(
    async (playerId: string) => {
      if (!currentSession) return;
      setIsLoading(true);
      try {
        const success = await cancelCashOutDB(playerId, currentSession.id);
        if (success) {
          const updatedSession = {
            ...currentSession,
            players: currentSession.players.map((p) =>
              p.id === playerId ? { ...p, cashOut: undefined } : p
            ),
          };
          setCurrentSession(updatedSession);
        }
      } catch {
        setError('取消结算失败');
      } finally {
        setIsLoading(false);
      }
    },
    [currentSession]
  );

  // 重置当前游戏
  const resetCurrentGame = useCallback(async () => {
    if (!currentSession) return;
    setIsLoading(true);
    try {
      // 删除所有玩家
      for (const player of currentSession.players) {
        await removePlayerDB(player.id, currentSession.id);
      }
      const updatedSession = {
        ...currentSession,
        players: [],
      };
      setCurrentSession(updatedSession);
    } catch {
      setError('重置游戏失败');
    } finally {
      setIsLoading(false);
    }
  }, [currentSession]);

  // 退出当前游戏（不清除数据）
  const exitGame = useCallback(() => {
    setCurrentSession(null);
    localStorage.removeItem(CURRENT_SESSION_KEY);
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  }, []);

  // 计算统计数据
  const getStats = useCallback((): GameStats => {
    if (!currentSession) {
      return {
        totalBuyIn: 0,
        totalCashOut: 0,
        totalProfit: 0,
        playerCount: 0,
        activePlayerCount: 0,
      };
    }

    const totalBuyIn = currentSession.players.reduce(
      (sum, p) => sum + p.buyIns.reduce((s, b) => s + b.amount, 0),
      0
    );

    const totalCashOut = currentSession.players.reduce(
      (sum, p) => sum + (p.cashOut?.amount || 0),
      0
    );

    const activePlayerCount = currentSession.players.filter((p) => !p.cashOut).length;

    return {
      totalBuyIn,
      totalCashOut,
      totalProfit: totalCashOut - totalBuyIn,
      playerCount: currentSession.players.length,
      activePlayerCount,
    };
  }, [currentSession]);

  // 获取玩家结果列表
  const getPlayerResults = useCallback((): PlayerResult[] => {
    if (!currentSession) return [];

    return currentSession.players.map((player) => {
      const totalBuyIn = player.buyIns.reduce((sum, b) => sum + b.amount, 0);
      const cashOutAmount = player.cashOut?.amount || 0;
      return {
        player,
        totalBuyIn,
        profit: cashOutAmount - totalBuyIn,
        isSettled: !!player.cashOut,
      };
    });
  }, [currentSession]);

  // 检查是否可以结算
  const canFinalize = useCallback((): boolean => {
    const results = getPlayerResults();
    if (results.length === 0) return false;
    if (results.some((r) => !r.isSettled)) return false;
    const totalProfit = results.reduce((sum, r) => sum + r.profit, 0);
    return Math.abs(totalProfit) < 0.01;
  }, [getPlayerResults]);

  // 计算总榜
  const getTotalRanking = useCallback((): TotalRanking => {
    const endedSessions = sessions.filter((s) => !s.isActive);

    const playerMap = new Map<string, TotalRankingPlayer>();
    let totalPool = 0;

    endedSessions.forEach((session) => {
      session.players.forEach((player) => {
        const totalBuyIn = player.buyIns.reduce((sum, b) => sum + b.amount, 0);
        const cashOutAmount = player.cashOut?.amount || 0;
        const profit = cashOutAmount - totalBuyIn;

        totalPool += totalBuyIn;

        const existing = playerMap.get(player.name);
        if (existing) {
          existing.totalGames += 1;
          existing.totalBuyIn += totalBuyIn;
          existing.totalCashOut += cashOutAmount;
          existing.totalProfit += profit;
          if (profit > 0) existing.winCount += 1;
          else if (profit < 0) existing.lossCount += 1;
          else existing.breakEvenCount += 1;
          existing.avgProfit = existing.totalProfit / existing.totalGames;
        } else {
          playerMap.set(player.name, {
            name: player.name,
            totalGames: 1,
            totalBuyIn,
            totalCashOut: cashOutAmount,
            totalProfit: profit,
            winCount: profit > 0 ? 1 : 0,
            lossCount: profit < 0 ? 1 : 0,
            breakEvenCount: profit === 0 ? 1 : 0,
            avgProfit: profit,
          });
        }
      });
    });

    const players = Array.from(playerMap.values()).sort((a, b) => b.totalProfit - a.totalProfit);

    return {
      players,
      totalGames: endedSessions.length,
      totalPool,
    };
  }, [sessions]);

  // 清除错误
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
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
  };
}
