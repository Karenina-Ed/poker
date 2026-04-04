import { createClient } from '@supabase/supabase-js';
import type { GameSession, Player, BuyInRecord, CashOutRecord } from '@/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY');
}

// 创建 Supabase 客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
});

// 游戏会话的数据库类型
interface DBGameSession {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  access_code: string;
}

// 玩家的数据库类型
interface DBPlayer {
  id: string;
  session_id: string;
  name: string;
  created_at: string;
  buy_ins: BuyInRecord[];
  cash_out?: CashOutRecord;
}

// 生成访问码
export const generateAccessCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// 创建游戏会话
export const createGameSession = async (name?: string): Promise<GameSession | null> => {
  try {
    const accessCode = generateAccessCode();
    const { data, error } = await supabase
      .from('game_sessions')
      .insert([
        {
          name: name || `游戏 ${new Date().toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
          is_active: true,
          access_code: accessCode,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id as string,
      name: data.name,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
      players: [],
      isActive: data.is_active,
      accessCode: data.access_code,
    };
  } catch (error) {
    console.error('Error creating game session:', error);
    return null;
  }
};

// 通过访问码获取游戏会话
export const getGameSessionByCode = async (accessCode: string): Promise<GameSession | null> => {
  try {
    const { data: sessionData, error: sessionError } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('access_code', accessCode.toUpperCase())
      .single();

    if (sessionError || !sessionData) return null;

    // 获取玩家数据
    const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('session_id', sessionData.id)
      .order('created_at', { ascending: true });

    if (playersError) throw playersError;

    const players: Player[] = (playersData || []).map((p: DBPlayer) => ({
      id: p.id,
      name: p.name,
      buyIns: p.buy_ins || [],
      cashOut: p.cash_out,
      createdAt: new Date(p.created_at).getTime(),
    }));

    return {
      id: sessionData.id,
      name: sessionData.name,
      createdAt: new Date(sessionData.created_at).getTime(),
      updatedAt: new Date(sessionData.updated_at).getTime(),
      players,
      isActive: sessionData.is_active,
      accessCode: sessionData.access_code,
    };
  } catch (error) {
    console.error('Error getting game session:', error);
    return null;
  }
};

// 获取游戏会话
export const getGameSession = async (sessionId: string): Promise<GameSession | null> => {
  try {
    const { data: sessionData, error: sessionError } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !sessionData) return null;

    // 获取玩家数据
    const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (playersError) throw playersError;

    const players: Player[] = (playersData || []).map((p: DBPlayer) => ({
      id: p.id,
      name: p.name,
      buyIns: p.buy_ins || [],
      cashOut: p.cash_out,
      createdAt: new Date(p.created_at).getTime(),
    }));

    return {
      id: sessionData.id,
      name: sessionData.name,
      createdAt: new Date(sessionData.created_at).getTime(),
      updatedAt: new Date(sessionData.updated_at).getTime(),
      players,
      isActive: sessionData.is_active,
      accessCode: sessionData.access_code,
    };
  } catch (error) {
    console.error('Error getting game session:', error);
    return null;
  }
};

// 获取所有游戏会话
export const getAllGameSessions = async (): Promise<GameSession[]> => {
  try {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((session: DBGameSession) => ({
      id: session.id,
      name: session.name,
      createdAt: new Date(session.created_at).getTime(),
      updatedAt: new Date(session.updated_at).getTime(),
      players: [],
      isActive: session.is_active,
      accessCode: session.access_code,
    }));
  } catch (error) {
    console.error('Error getting game sessions:', error);
    return [];
  }
};

// 结束游戏会话
export const endGameSession = async (sessionId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('game_sessions')
      .update({ is_active: false })
      .eq('id', sessionId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error ending game session:', error);
    return false;
  }
};

// 删除游戏会话
export const deleteGameSession = async (sessionId: string): Promise<boolean> => {
  try {
    // 先删除玩家（外键约束）
    await supabase.from('players').delete().eq('session_id', sessionId);
    
    // 再删除会话
    const { error } = await supabase
      .from('game_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting game session:', error);
    return false;
  }
};

// 添加玩家
export const addPlayer = async (
  sessionId: string,
  name: string,
  initialBuyIn: number = 0
): Promise<Player | null> => {
  try {
    const buyIns: BuyInRecord[] = initialBuyIn > 0 
      ? [{ id: crypto.randomUUID(), amount: initialBuyIn, timestamp: Date.now() }]
      : [];

    const { data, error } = await supabase
      .from('players')
      .insert([
        {
          session_id: sessionId,
          name: name.trim(),
          buy_ins: buyIns,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // 更新会话的 updated_at
    await supabase
      .from('game_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    return {
      id: data.id,
      name: data.name,
      buyIns: data.buy_ins || [],
      cashOut: data.cash_out,
      createdAt: new Date(data.created_at).getTime(),
    };
  } catch (error) {
    console.error('Error adding player:', error);
    return null;
  }
};

// 删除玩家
export const removePlayer = async (playerId: string, sessionId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', playerId);

    if (error) throw error;

    // 更新会话的 updated_at
    await supabase
      .from('game_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    return true;
  } catch (error) {
    console.error('Error removing player:', error);
    return false;
  }
};

// 更新玩家名称
export const updatePlayerName = async (playerId: string, name: string, sessionId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('players')
      .update({ name: name.trim() })
      .eq('id', playerId);

    if (error) throw error;

    // 更新会话的 updated_at
    await supabase
      .from('game_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    return true;
  } catch (error) {
    console.error('Error updating player name:', error);
    return false;
  }
};

// 添加买入
export const addBuyIn = async (playerId: string, amount: number, sessionId: string): Promise<boolean> => {
  try {
    // 先获取当前买入记录
    const { data: player, error: getError } = await supabase
      .from('players')
      .select('buy_ins')
      .eq('id', playerId)
      .single();

    if (getError) throw getError;

    const newBuyIn: BuyInRecord = {
      id: crypto.randomUUID(),
      amount,
      timestamp: Date.now(),
    };

    const buyIns = [...(player?.buy_ins || []), newBuyIn];

    const { error } = await supabase
      .from('players')
      .update({ buy_ins: buyIns })
      .eq('id', playerId);

    if (error) throw error;

    // 更新会话的 updated_at
    await supabase
      .from('game_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    return true;
  } catch (error) {
    console.error('Error adding buy in:', error);
    return false;
  }
};

// 撤销最后一次买入
export const undoLastBuyIn = async (playerId: string, sessionId: string): Promise<boolean> => {
  try {
    // 先获取当前买入记录
    const { data: player, error: getError } = await supabase
      .from('players')
      .select('buy_ins')
      .eq('id', playerId)
      .single();

    if (getError) throw getError;

    const buyIns = (player?.buy_ins || []).slice(0, -1);

    const { error } = await supabase
      .from('players')
      .update({ buy_ins: buyIns })
      .eq('id', playerId);

    if (error) throw error;

    // 更新会话的 updated_at
    await supabase
      .from('game_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    return true;
  } catch (error) {
    console.error('Error undoing buy in:', error);
    return false;
  }
};

// 结算玩家
export const cashOutPlayer = async (playerId: string, amount: number, sessionId: string): Promise<boolean> => {
  try {
    const cashOut: CashOutRecord = {
      amount,
      timestamp: Date.now(),
    };

    const { error } = await supabase
      .from('players')
      .update({ cash_out: cashOut })
      .eq('id', playerId);

    if (error) throw error;

    // 更新会话的 updated_at
    await supabase
      .from('game_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    return true;
  } catch (error) {
    console.error('Error cashing out player:', error);
    return false;
  }
};

// 取消结算
export const cancelCashOut = async (playerId: string, sessionId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('players')
      .update({ cash_out: null })
      .eq('id', playerId);

    if (error) throw error;

    // 更新会话的 updated_at
    await supabase
      .from('game_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    return true;
  } catch (error) {
    console.error('Error canceling cash out:', error);
    return false;
  }
};

// 订阅游戏会话变化（实时同步）
export const subscribeToSession = (
  sessionId: string,
  onUpdate: (session: GameSession) => void
) => {
  // 订阅玩家表的变化
  const playerSubscription = supabase
    .channel(`players:${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `session_id=eq.${sessionId}`,
      },
      async () => {
        // 数据变化时重新获取完整会话
        const session = await getGameSession(sessionId);
        if (session) onUpdate(session);
      }
    )
    .subscribe();

  // 订阅会话表的变化
  const sessionSubscription = supabase
    .channel(`session:${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'game_sessions',
        filter: `id=eq.${sessionId}`,
      },
      async () => {
        const session = await getGameSession(sessionId);
        if (session) onUpdate(session);
      }
    )
    .subscribe();

  // 返回取消订阅函数
  return () => {
    playerSubscription.unsubscribe();
    sessionSubscription.unsubscribe();
  };
};
