import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HistoryStatsPanel } from './components/HistoryStatsPanel';
import { Input } from '@/components/ui/input';
import { LedgerEntriesPanel } from './components/LedgerEntriesPanel';
import { RoomMembersPanel } from './components/RoomMembersPanel';
import { SettlementPanel } from './components/SettlementPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Clock3,
  Crown,
  Medal,
  QrCode,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';

type Role = 'host' | 'bookkeeper' | 'player';
type LedgerActionType = 'buyin' | 'rebuy' | 'cashout';
type LedgerStatus = 'pending' | 'approved' | 'rejected';
type ReconcileMode = 'proportional' | 'assign' | 'reserve';

interface RoomSettings {
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  chipsPerCurrency: number;
}

interface PlayerSeat {
  id: string;
  nickname: string;
  role: Role;
  isAnonymous: boolean;
  buyIns: number[];
  cashOutChips?: number;
  finalChips?: number;
  leftEarly: boolean;
}

interface LedgerAction {
  id: string;
  type: LedgerActionType;
  playerId: string;
  amount: number;
  chips: number;
  createdAt: number;
  status: LedgerStatus;
}

interface Room {
  id: string;
  cloudSessionId?: string;
  name: string;
  inviteCode: string;
  inviteLink: string;
  settings: RoomSettings;
  players: PlayerSeat[];
  ledger: LedgerAction[];
  reservePoolChips: number;
  startedAt: number;
  closedAt?: number;
}

interface TransferPlan {
  from: string;
  to: string;
  amount: number;
}

interface HistoryGame {
  roomId: string;
  roomName: string;
  startedAt: number;
  closedAt: number;
  bigBlind: number;
  pnlByPlayer: Record<string, number>;
}

const STORAGE_ROOM = 'poker-redesign-room-v1';
const STORAGE_HISTORY = 'poker-redesign-history-v1';
const ROOM_STATE_PLAYER = '__ROOM_STATE__';
const PERSIST_DEBOUNCE_MS = 400;
const DEFAULT_SETTINGS: RoomSettings = {
  smallBlind: 1,
  bigBlind: 2,
  minBuyIn: 100,
  maxBuyIn: 1000,
  chipsPerCurrency: 1,
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const formatMoney = (value: number) => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${round2(value)}`;
};

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const createInviteCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

const getPlayerTotalBuyIn = (player: PlayerSeat) => sum(player.buyIns);

const toNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const normalizeRole = (value: unknown): Role =>
  value === 'host' || value === 'bookkeeper' || value === 'player' ? value : 'player';

const normalizeRoom = (input: unknown): Room | null => {
  if (!input || typeof input !== 'object') return null;
  const data = input as Record<string, unknown>;

  const rawPlayers = Array.isArray(data.players) ? data.players : [];
  const players: PlayerSeat[] = rawPlayers.reduce<PlayerSeat[]>((acc, item) => {
    if (!item || typeof item !== 'object') return acc;
    const p = item as Record<string, unknown>;
    if (typeof p.id !== 'string') return acc;

    const normalized: PlayerSeat = {
      id: p.id,
      nickname: typeof p.nickname === 'string' && p.nickname.trim() ? p.nickname : '玩家',
      role: normalizeRole(p.role),
      isAnonymous: Boolean(p.isAnonymous),
      buyIns: Array.isArray(p.buyIns) ? p.buyIns.map((v) => toNumber(v)).filter((v) => v >= 0) : [],
      leftEarly: Boolean(p.leftEarly),
    };

    if (p.cashOutChips !== undefined) {
      normalized.cashOutChips = toNumber(p.cashOutChips);
    }
    if (p.finalChips !== undefined) {
      normalized.finalChips = toNumber(p.finalChips);
    }

    acc.push(normalized);
    return acc;
  }, []);

  if (players.length === 0) return null;

  const rawLedger = Array.isArray(data.ledger) ? data.ledger : [];
  const ledger: LedgerAction[] = rawLedger
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const l = item as Record<string, unknown>;
      const type: LedgerActionType =
        l.type === 'buyin' || l.type === 'rebuy' || l.type === 'cashout' ? l.type : 'buyin';
      const status: LedgerStatus =
        l.status === 'approved' || l.status === 'rejected' || l.status === 'pending'
          ? l.status
          : 'pending';
      if (typeof l.id !== 'string' || typeof l.playerId !== 'string') return null;
      return {
        id: l.id,
        type,
        playerId: l.playerId,
        amount: toNumber(l.amount),
        chips: toNumber(l.chips),
        createdAt: toNumber(l.createdAt, Date.now()),
        status,
      } satisfies LedgerAction;
    })
    .filter((item): item is LedgerAction => item !== null);

  const rawSettings =
    data.settings && typeof data.settings === 'object'
      ? (data.settings as Record<string, unknown>)
      : {};

  const hostExists = players.some((player) => player.role === 'host');
  if (!hostExists) {
    players[0] = { ...players[0], role: 'host' };
  }

  return {
    id: typeof data.id === 'string' ? data.id : createId(),
    cloudSessionId: typeof data.cloudSessionId === 'string' ? data.cloudSessionId : undefined,
    name: typeof data.name === 'string' && data.name.trim() ? data.name : '德州局',
    inviteCode:
      typeof data.inviteCode === 'string' && data.inviteCode.trim() ? data.inviteCode : createInviteCode(),
    inviteLink:
      typeof data.inviteLink === 'string' && data.inviteLink.trim()
        ? data.inviteLink
        : `${window.location.origin}?room=${createInviteCode()}`,
    settings: {
      smallBlind: toNumber(rawSettings.smallBlind, DEFAULT_SETTINGS.smallBlind),
      bigBlind: toNumber(rawSettings.bigBlind, DEFAULT_SETTINGS.bigBlind),
      minBuyIn: toNumber(rawSettings.minBuyIn, DEFAULT_SETTINGS.minBuyIn),
      maxBuyIn: toNumber(rawSettings.maxBuyIn, DEFAULT_SETTINGS.maxBuyIn),
      chipsPerCurrency: Math.max(1, toNumber(rawSettings.chipsPerCurrency, DEFAULT_SETTINGS.chipsPerCurrency)),
    },
    players,
    ledger,
    reservePoolChips: toNumber(data.reservePoolChips),
    startedAt: toNumber(data.startedAt, Date.now()),
    closedAt: data.closedAt === undefined ? undefined : toNumber(data.closedAt),
  };
};

const normalizeHistory = (input: unknown): HistoryGame[] => {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const h = item as Record<string, unknown>;
      const pnlSource =
        h.pnlByPlayer && typeof h.pnlByPlayer === 'object'
          ? (h.pnlByPlayer as Record<string, unknown>)
          : {};
      const pnlByPlayer = Object.entries(pnlSource).reduce<Record<string, number>>((acc, [key, value]) => {
        acc[key] = toNumber(value);
        return acc;
      }, {});
      return {
        roomId: typeof h.roomId === 'string' ? h.roomId : createId(),
        roomName: typeof h.roomName === 'string' ? h.roomName : '德州局',
        startedAt: toNumber(h.startedAt, Date.now()),
        closedAt: toNumber(h.closedAt, Date.now()),
        bigBlind: Math.max(1, toNumber(h.bigBlind, 1)),
        pnlByPlayer,
      } satisfies HistoryGame;
    })
    .filter((item): item is HistoryGame => item !== null);
};

const loadRoomStateFromCloudByCode = async (
  inviteCode: string
): Promise<{ room: Room; history: HistoryGame[] } | null> => {
  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('access_code', inviteCode)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionError || !session) {
    return null;
  }

  const { data: stateRow } = await supabase
    .from('players')
    .select('*')
    .eq('session_id', session.id)
    .eq('name', ROOM_STATE_PLAYER)
    .single();

  const fallbackRoom: Room = {
    id: createId(),
    cloudSessionId: session.id,
    name: session.name || '德州局',
    inviteCode: session.access_code,
    inviteLink: `${window.location.origin}?room=${session.access_code}`,
    settings: { ...DEFAULT_SETTINGS },
    players: [],
    ledger: [],
    reservePoolChips: 0,
    startedAt: new Date(session.created_at).getTime(),
    closedAt: session.is_active ? undefined : new Date(session.updated_at).getTime(),
  };

  if (!stateRow?.cash_out || typeof stateRow.cash_out !== 'object') {
    return {
      room: fallbackRoom,
      history: [],
    };
  }

  const rawState = stateRow.cash_out as Record<string, unknown>;
  const parsedRoom = normalizeRoom(rawState.room);
  const parsedHistory = normalizeHistory(rawState.history);

  if (!parsedRoom) {
    return {
      room: fallbackRoom,
      history: parsedHistory,
    };
  }

  return {
    room: {
      ...parsedRoom,
      cloudSessionId: session.id,
      inviteCode: session.access_code,
      inviteLink: `${window.location.origin}?room=${session.access_code}`,
    },
    history: parsedHistory,
  };
};

const saveRoomStateToCloud = async (room: Room, history: HistoryGame[]) => {
  if (!room.cloudSessionId) return;

  const payload = {
    room,
    history,
    updatedAt: Date.now(),
  };

  const { data: existingRow } = await supabase
    .from('players')
    .select('id')
    .eq('session_id', room.cloudSessionId)
    .eq('name', ROOM_STATE_PLAYER)
    .single();

  if (existingRow?.id) {
    await supabase
      .from('players')
      .update({
        cash_out: payload,
        buy_ins: [],
      })
      .eq('id', existingRow.id);
    return;
  }

  await supabase.from('players').insert([
    {
      session_id: room.cloudSessionId,
      name: ROOM_STATE_PLAYER,
      buy_ins: [],
      cash_out: payload,
    },
  ]);
};

const getApprovedBuyInChips = (room: Room) =>
  sum(room.ledger.filter((item) => item.status === 'approved').map((item) => item.chips));

const getComputedFinalChips = (player: PlayerSeat) =>
  player.leftEarly ? player.cashOutChips ?? 0 : player.finalChips ?? 0;

const getProfitCurrency = (player: PlayerSeat, chipsPerCurrency: number) => {
  const buyInTotal = getPlayerTotalBuyIn(player);
  const finalCurrency = getComputedFinalChips(player) / chipsPerCurrency;
  return round2(finalCurrency - buyInTotal);
};

const computeTransfers = (pnlMap: Record<string, number>): TransferPlan[] => {
  const debtors = Object.entries(pnlMap)
    .filter(([, value]) => value < 0)
    .map(([name, value]) => ({ name, amount: -value }));
  const creditors = Object.entries(pnlMap)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, amount: value }));

  const result: TransferPlan[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = round2(Math.min(debtors[i].amount, creditors[j].amount));
    if (amount > 0) {
      result.push({ from: debtors[i].name, to: creditors[j].name, amount });
    }
    debtors[i].amount = round2(debtors[i].amount - amount);
    creditors[j].amount = round2(creditors[j].amount - amount);
    if (debtors[i].amount <= 0.01) i += 1;
    if (creditors[j].amount <= 0.01) j += 1;
  }
  return result;
};

const createRoomSkeleton = (hostName: string): Room => {
  const roomId = createId();
  const code = createInviteCode();
  const host: PlayerSeat = {
    id: createId(),
    nickname: hostName.trim() || '房主',
    role: 'host',
    isAnonymous: false,
    buyIns: [],
    leftEarly: false,
  };

  return {
    id: roomId,
    name: `${new Date().toLocaleDateString('zh-CN')} 德州局`,
    inviteCode: code,
    inviteLink: `${window.location.origin}?room=${code}`,
    settings: { ...DEFAULT_SETTINGS },
    players: [host],
    ledger: [],
    reservePoolChips: 0,
    startedAt: Date.now(),
  };
};

function App() {
  const [tab, setTab] = useState('room');
  const [room, setRoom] = useState<Room | null>(null);
  const [history, setHistory] = useState<HistoryGame[]>([]);
  const [actorId, setActorId] = useState<string>('');
  const [hostName, setHostName] = useState('');
  const [joinNickname, setJoinNickname] = useState('');
  const [requestedAmount, setRequestedAmount] = useState('');
  const [requestedType, setRequestedType] = useState<LedgerActionType>('buyin');
  const [assignPlayerId, setAssignPlayerId] = useState('');
  const [reconcileMode, setReconcileMode] = useState<ReconcileMode>('proportional');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const tabIdRef = useRef(createId());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const persistTimerRef = useRef<number | null>(null);
  const lastPersistedRoomRef = useRef<string | null>(null);
  const lastPersistedHistoryRef = useRef<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const inviteCodeFromUrl =
        new URLSearchParams(window.location.search).get('room')?.trim().toUpperCase() ?? '';

      const cachedRoom = localStorage.getItem(STORAGE_ROOM);
      const cachedHistory = localStorage.getItem(STORAGE_HISTORY);

      let resolvedRoom: Room | null = null;
      let resolvedHistory: HistoryGame[] = [];

      if (cachedRoom) {
        try {
          const parsed = normalizeRoom(JSON.parse(cachedRoom));
          if (parsed) {
            if (!inviteCodeFromUrl || parsed.inviteCode.toUpperCase() === inviteCodeFromUrl) {
              resolvedRoom = parsed;
              lastPersistedRoomRef.current = cachedRoom;
            }
          } else {
            localStorage.removeItem(STORAGE_ROOM);
          }
        } catch {
          localStorage.removeItem(STORAGE_ROOM);
        }
      }

      if (cachedHistory) {
        try {
          resolvedHistory = normalizeHistory(JSON.parse(cachedHistory));
          lastPersistedHistoryRef.current = cachedHistory;
        } catch {
          localStorage.removeItem(STORAGE_HISTORY);
        }
      }

      if (!resolvedRoom && inviteCodeFromUrl) {
        try {
          const cloudState = await loadRoomStateFromCloudByCode(inviteCodeFromUrl);
          if (cloudState) {
            resolvedRoom = cloudState.room;
            resolvedHistory = cloudState.history;
          } else {
            setError('未找到该房间，请确认邀请链接是否正确。');
          }
        } catch (err) {
          console.error(err);
          setError('云端房间加载失败，请稍后重试。');
        }
      }

      if (resolvedRoom) {
        setRoom(resolvedRoom);
        setActorId(resolvedRoom.players[0]?.id ?? '');
      }
      setHistory(resolvedHistory);
    };

    void init();

    if ('BroadcastChannel' in window) {
      channelRef.current = new BroadcastChannel('poker-realtime');
      channelRef.current.onmessage = (event: MessageEvent) => {
        const payload = event.data as {
          sender: string;
          room: Room | null;
          history: HistoryGame[];
        };
        if (!payload || payload.sender === tabIdRef.current) {
          return;
        }
        setRoom(normalizeRoom(payload.room));
        setHistory(normalizeHistory(payload.history));
      };
    }

    return () => {
      channelRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }

    persistTimerRef.current = window.setTimeout(() => {
      const nextRoom = JSON.stringify(room);
      const nextHistory = JSON.stringify(history);
      const roomChanged = nextRoom !== lastPersistedRoomRef.current;
      const historyChanged = nextHistory !== lastPersistedHistoryRef.current;

      if (!roomChanged && !historyChanged) {
        return;
      }

      if (roomChanged) {
        localStorage.setItem(STORAGE_ROOM, nextRoom);
        lastPersistedRoomRef.current = nextRoom;
      }

      if (historyChanged) {
        localStorage.setItem(STORAGE_HISTORY, nextHistory);
        lastPersistedHistoryRef.current = nextHistory;
      }

      if (room?.cloudSessionId) {
        void saveRoomStateToCloud(room, history);
      }

      if (channelRef.current) {
        channelRef.current.postMessage({
          sender: tabIdRef.current,
          room,
          history,
        });
      }
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
      }
    };
  }, [room, history]);

  const actor = useMemo(
    () => room?.players.find((player) => player.id === actorId) ?? null,
    [room, actorId]
  );

  const canApprove = actor?.role === 'host' || actor?.role === 'bookkeeper';

  const totalBuyInCurrency = useMemo(() => {
    if (!room) return 0;
    return sum(room.players.flatMap((player) => player.buyIns));
  }, [room]);

  const totalBuyInChips = useMemo(() => {
    if (!room) return 0;
    return getApprovedBuyInChips(room);
  }, [room]);

  const totalFinalChips = useMemo(() => {
    if (!room) return 0;
    return sum(room.players.map((player) => getComputedFinalChips(player)));
  }, [room]);

  const chipDelta = useMemo(() => round2(totalBuyInChips - totalFinalChips), [totalBuyInChips, totalFinalChips]);

  const pnlMap = useMemo(() => {
    if (!room) return {} as Record<string, number>;
    return room.players.reduce<Record<string, number>>((acc, player) => {
      acc[player.nickname] = getProfitCurrency(player, room.settings.chipsPerCurrency);
      return acc;
    }, {});
  }, [room]);

  const transferPlan = useMemo(() => computeTransfers(pnlMap), [pnlMap]);
  const pendingLedgerCount = useMemo(
    () => (room ? room.ledger.filter((item) => item.status === 'pending').length : 0),
    [room]
  );

  const roomRankingRows = useMemo(() => {
    if (!room) return [] as Array<{
      id: string;
      name: string;
      profit: number;
      totalBuyIn: number;
      leftEarly: boolean;
    }>;

    return room.players
      .map((player) => ({
        id: player.id,
        name: player.nickname,
        profit: getProfitCurrency(player, room.settings.chipsPerCurrency),
        totalBuyIn: getPlayerTotalBuyIn(player),
        leftEarly: player.leftEarly,
      }))
      .sort((a, b) => b.profit - a.profit);
  }, [room]);

  const settlementRows = useMemo(() => {
    if (!room) {
      return [] as Array<{
        id: string;
        nickname: string;
        leftEarly: boolean;
        buyInTotal: number;
        inputValue: number | string;
        profit: number;
      }>;
    }

    return room.players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      leftEarly: player.leftEarly,
      buyInTotal: getPlayerTotalBuyIn(player),
      inputValue: player.leftEarly ? player.cashOutChips ?? 0 : player.finalChips ?? '',
      profit: getProfitCurrency(player, room.settings.chipsPerCurrency),
    }));
  }, [room]);

  const rankingRows = useMemo(() => {
    const aggregate = new Map<
      string,
      {
        pnls: number[];
        totalHours: number;
        bigBlindSum: number;
        games: number;
      }
    >();

    history.forEach((game) => {
      const duration = Math.max((game.closedAt - game.startedAt) / (1000 * 60 * 60), 0.1);

      Object.entries(game.pnlByPlayer).forEach(([name, pnl]) => {
        if (!aggregate.has(name)) {
          aggregate.set(name, {
            pnls: [],
            totalHours: 0,
            bigBlindSum: 0,
            games: 0,
          });
        }

        const entry = aggregate.get(name);
        if (!entry) return;

        entry.pnls.push(pnl);
        entry.totalHours += duration;
        entry.bigBlindSum += game.bigBlind;
        entry.games += 1;
      });
    });

    return Array.from(aggregate.entries())
      .map(([name, entry]) => {
        const total = round2(sum(entry.pnls));
        const avg = round2(total / entry.pnls.length);
        let peak = 0;
        let running = 0;
        let maxDrawdown = 0;
        entry.pnls.forEach((value) => {
          running += value;
          peak = Math.max(peak, running);
          maxDrawdown = Math.min(maxDrawdown, running - peak);
        });

        const avgBigBlind = entry.bigBlindSum / Math.max(entry.games, 1);
        const bbPerHour =
          avgBigBlind > 0 ? round2(total / avgBigBlind / Math.max(entry.totalHours, 0.1)) : 0;

        return {
          name,
          games: entry.pnls.length,
          total,
          avg,
          bbPerHour,
          maxDrawdown: round2(maxDrawdown),
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [history]);

  const trendData = useMemo(() => {
    const cumulative = new Map<string, number>();
    return history.map((game) => {
      const point: Record<string, number | string> = {
        label: new Date(game.closedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
      };
      Object.entries(game.pnlByPlayer).forEach(([name, pnl]) => {
        const next = round2((cumulative.get(name) ?? 0) + pnl);
        cumulative.set(name, next);
      });
      cumulative.forEach((value, key) => {
        point[key] = value;
      });
      return point;
    });
  }, [history]);

  const createCloudRoom = async (hostDisplayName: string): Promise<Room | null> => {
    const next = createRoomSkeleton(hostDisplayName);

    try {
      const { data, error: createError } = await supabase
        .from('game_sessions')
        .insert([
          {
            name: next.name,
            is_active: true,
            access_code: next.inviteCode,
          },
        ])
        .select()
        .single();

      if (createError || !data) {
        throw createError || new Error('create room failed');
      }

      const cloudRoom: Room = {
        ...next,
        cloudSessionId: data.id,
        inviteCode: data.access_code,
        inviteLink: `${window.location.origin}?room=${data.access_code}`,
      };

      await saveRoomStateToCloud(cloudRoom, history);
      return cloudRoom;
    } catch (err) {
      console.error(err);
      setError('创建云端房间失败，请稍后重试。');
      return null;
    }
  };

  const createRoom = async () => {
    const cloudRoom = await createCloudRoom(hostName);
    if (!cloudRoom) {
      return;
    }

    setRoom(cloudRoom);
    setActorId(cloudRoom.players[0].id);
    setHostName('');
    setError('');
  };

  const startFreshRoom = async () => {
    const cloudRoom = await createCloudRoom(actor?.nickname || hostName || '房主');
    if (!cloudRoom) {
      return;
    }

    setRoom(cloudRoom);
    setActorId(cloudRoom.players[0].id);
    setTab('room');
    setError('');
  };

  const joinRoom = () => {
    if (!room) return;
    if (!joinNickname.trim()) {
      setError('请输入昵称后再加入。');
      return;
    }

    const nickname = joinNickname.trim();

    const next: PlayerSeat = {
      id: createId(),
      nickname,
      role: 'player',
      isAnonymous: false,
      buyIns: [],
      leftEarly: false,
    };

    setRoom({ ...room, players: [...room.players, next] });
    setActorId(next.id);
    setJoinNickname('');
    setError('');
  };

  const updateSetting = (key: keyof RoomSettings, value: number) => {
    if (!room) return;
    setRoom({
      ...room,
      settings: {
        ...room.settings,
        [key]: value,
      },
    });
  };

  const submitLedgerRequest = () => {
    if (!room || !actor) return;
    const amount = Number(requestedAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('请输入有效金额。');
      setError('请输入有效金额。');
      return;
    }
    if (requestedType !== 'cashout') {
      if (amount < room.settings.minBuyIn || amount > room.settings.maxBuyIn) {
        toast.error(`买入异常：单笔申请需在 ${room.settings.minBuyIn} - ${room.settings.maxBuyIn} 之间。`);
        setError(`买入需在 ${room.settings.minBuyIn} - ${room.settings.maxBuyIn} 之间。`);
        return;
      }
    }

    const action: LedgerAction = {
      id: createId(),
      type: requestedType,
      playerId: actor.id,
      amount,
      chips: round2(amount * room.settings.chipsPerCurrency),
      createdAt: Date.now(),
      status: 'pending',
    };

    setRoom({ ...room, ledger: [action, ...room.ledger] });
    setRequestedAmount('');
    setError('');
  };

  const applyBuyInToAllPlayers = () => {
    if (!room || !canApprove) return;
    const amount = Number(requestedAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('请输入有效买入金额。');
      setError('请输入有效买入金额。');
      return;
    }
    if (requestedType !== 'buyin') {
      toast.error('请将类型切换为“买入申请”再使用一键买入功能。');
      setError('请将类型切换为“买入申请”再使用一键买入功能。');
      return;
    }
    if (amount < room.settings.minBuyIn || amount > room.settings.maxBuyIn) {
      toast.error(`买入异常：单笔数额需在 ${room.settings.minBuyIn} - ${room.settings.maxBuyIn} 之间。`);
      setError(`买入需在 ${room.settings.minBuyIn} - ${room.settings.maxBuyIn} 之间。`);
      return;
    }

    const activePlayers = room.players.filter((p) => !p.leftEarly);
    if (activePlayers.length === 0) {
      toast.error('当前没有任何在桌的玩家。');
      setError('当前没有在桌玩家。');
      return;
    }

    if (!confirm(`确定为所有在桌玩家（共 ${activePlayers.length} 人）每人额外全自动买入 ${amount} 吗？\n这是管理员操作，立即生效且不可撤销。`)) {
      return;
    }

    toast.success(`全员指令成功，已向所有 ${activePlayers.length} 玩家各买入了 ${amount}`);
    const now = Date.now();
    const newActions: LedgerAction[] = [];
    const newPlayers = room.players.map((player) => {
      if (player.leftEarly) return player;
      
      const action: LedgerAction = {
        id: createId(),
        type: 'buyin',
        playerId: player.id,
        amount,
        chips: round2(amount * room.settings.chipsPerCurrency),
        createdAt: now,
        status: 'approved',
      };
      newActions.push(action);
      
      return {
        ...player,
        buyIns: [...player.buyIns, amount],
      };
    });

    setRoom({
      ...room,
      players: newPlayers,
      ledger: [...newActions, ...room.ledger],
    });
    setRequestedAmount('');
    setError('');
  };

  const approveRequest = (requestId: string, approved: boolean) => {
    if (!room || !canApprove) return;

    const request = room.ledger.find((item) => item.id === requestId);
    if (!request || request.status !== 'pending') return;

    let nextRoom: Room = {
      ...room,
      ledger: room.ledger.map((item) =>
        item.id === requestId
          ? {
              ...item,
              status: (approved ? 'approved' : 'rejected') as LedgerStatus,
            }
          : item
      ),
    };

    if (approved) {
      nextRoom = {
        ...nextRoom,
        players: nextRoom.players.map((player) => {
          if (player.id !== request.playerId) return player;

          if (request.type === 'cashout') {
            return {
              ...player,
              cashOutChips: request.chips,
              finalChips: request.chips,
              leftEarly: true,
            };
          }

          return {
            ...player,
            buyIns: [...player.buyIns, request.amount],
          };
        }),
      };
    }

    setRoom(nextRoom);
  };

  const setFinalChips = (playerId: string, chips: number | string) => {
    if (!room) return;
    setRoom({
      ...room,
      players: room.players.map((player) =>
        player.id === playerId
          ? {
              ...player,
              finalChips: chips as any, // Allowing string '' temporarily
            }
          : player
      ),
    });
  };

  const reconcile = () => {
    if (!room || chipDelta === 0) return;

    if (reconcileMode === 'reserve') {
      setRoom({
        ...room,
        reservePoolChips: round2(room.reservePoolChips + chipDelta),
      });
      return;
    }

    const adjustable = room.players.filter((player) => !player.leftEarly);
    if (adjustable.length === 0) return;

    if (reconcileMode === 'assign') {
      const target = assignPlayerId || adjustable[0].id;
      setRoom({
        ...room,
        players: room.players.map((player) =>
          player.id === target
            ? {
                ...player,
                finalChips: round2((player.finalChips ?? 0) + chipDelta),
              }
            : player
        ),
      });
      return;
    }

    const base = sum(adjustable.map((player) => Math.max(player.finalChips ?? 0, 1)));
    setRoom({
      ...room,
      players: room.players.map((player) => {
        if (player.leftEarly) return player;
        const ratio = Math.max(player.finalChips ?? 0, 1) / base;
        return {
          ...player,
          finalChips: round2((player.finalChips ?? 0) + chipDelta * ratio),
        };
      }),
    });
  };

  const closeGame = () => {
    if (!room) return;
    if (Math.abs(chipDelta) > 0.01) {
      setError('筹码未守恒，请先平账再清盘。');
      return;
    }

    const closedAt = Date.now();
    const record: HistoryGame = {
      roomId: room.id,
      roomName: room.name,
      startedAt: room.startedAt,
      closedAt,
      bigBlind: room.settings.bigBlind,
      pnlByPlayer: pnlMap,
    };

    setHistory((prev) => [record, ...prev]);
    setRoom({ ...room, closedAt });
    setError('');
  };

  const newRound = () => {
    if (!room) return;
    const reopened: Room = {
      ...room,
      id: createId(),
      startedAt: Date.now(),
      closedAt: undefined,
      ledger: [],
      players: room.players.map((player) => ({
        ...player,
        buyIns: [],
        leftEarly: false,
        cashOutChips: undefined,
        finalChips: undefined,
      })),
    };
    setRoom(reopened);
    setTab('room');
  };

  const copyInvite = async () => {
    if (!room) return;
    await navigator.clipboard.writeText(room.inviteLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleSwitchActor = useCallback((nextActorId: string) => {
    setActorId(nextActorId);
  }, []);

  const handlePromoteBookkeeper = useCallback(
    (playerId: string) => {
      if (!room) return;
      setRoom({
        ...room,
        players: room.players.map((item) =>
          item.id === playerId ? { ...item, role: 'bookkeeper' as Role } : item
        ),
      });
    },
    [room]
  );

  const handleReconcileModeChange = useCallback((value: ReconcileMode) => {
    setReconcileMode(value);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 md:pb-6">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-black tracking-tight">德州房间账本 Pro</h1>
            </div>
            <div className="flex items-center gap-2">
              {actor && (
                <Badge variant="outline" className="h-8 px-3">
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  {actor.role === 'host' ? '房主' : actor.role === 'bookkeeper' ? '记账员' : '玩家'}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-3 py-4 md:px-4">
        {!room ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Crown className="h-5 w-5 text-amber-400" />
                  创建房间
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  value={hostName}
                  onChange={(event) => setHostName(event.target.value)}
                  placeholder="输入房主昵称"
                  className="h-12 text-base"
                />
                <Button className="h-12 w-full text-base font-semibold" onClick={createRoom}>
                  开局并生成邀请
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">首页排行榜</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {rankingRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无历史数据。完成一次清盘后自动上榜。</p>
                ) : (
                  <>
                    <div className="grid gap-3 md:grid-cols-3">
                      {rankingRows.slice(0, 3).map((row, index) => (
                        <div
                          key={`home-podium-${row.name}`}
                          className={`rounded-xl border p-4 ${
                            index === 0
                              ? 'border-amber-300/50 bg-amber-400/10'
                              : index === 1
                                ? 'border-slate-300/40 bg-slate-200/5'
                                : 'border-orange-400/40 bg-orange-400/10'
                          }`}
                        >
                          <p className="text-xs font-bold">#{index + 1}</p>
                          <p className="truncate text-base font-bold">{row.name}</p>
                          <p className={`text-xl font-black ${row.total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatMoney(row.total)}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {rankingRows.slice(0, 10).map((row, index) => (
                        <div
                          key={`home-rank-${row.name}`}
                          className="flex items-center justify-between rounded-lg border border-border/70 bg-card/70 px-3 py-2"
                        >
                          <p className="text-sm font-semibold">#{index + 1} {row.name}</p>
                          <p className={`text-base font-black ${row.total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatMoney(row.total)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="pt-8">
              <Button 
                variant="destructive" 
                className="w-full mt-4 bg-red-950/40 hover:bg-red-900/60 border border-red-900/50 text-red-200" 
                onClick={() => {
                  if (confirm('确认清除本地所有历史缓存吗？')) {
                    localStorage.removeItem(STORAGE_HISTORY);
                    localStorage.removeItem(STORAGE_ROOM);
                    setHistory([]);
                  }
                }}
              >
                重建应用 (清除所有本地统计缓存)
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-3">
              <Button className="h-12 w-full text-base font-black" onClick={startFreshRoom}>
                开启新房间
              </Button>
            </div>

            <Card className="overflow-hidden border-amber-300/30 bg-gradient-to-br from-amber-500/20 via-background to-rose-500/10">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span className="text-lg font-black tracking-wide text-amber-200">房间实时排行榜</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {roomRankingRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无排行数据</p>
                ) : (
                  <>
                    <div className="flex flex-col gap-6 w-full">
                      {/* 炫酷领奖台 (Top 3) */}
                      {roomRankingRows.length > 0 && (
                        <div className="flex items-end justify-center h-[200px] mt-6 gap-2 w-full px-2">
                          {/* Rank 2 (Left) */}
                          {roomRankingRows[1] && (
                            <div className="relative flex flex-col items-center justify-end w-[30%] animate-in slide-in-from-bottom-8 duration-700">
                              <div className="absolute -top-16 flex flex-col items-center z-10 animate-bounce" style={{ animationDelay: '0.1s', animationDuration: '2.5s' }}>
                                <Medal className="w-8 h-8 text-slate-300 drop-shadow-md mb-1" />
                                <span className="font-bold text-white text-xs sm:text-sm truncate w-full max-w-[80px] text-center">{roomRankingRows[1].name}</span>
                                <span className={`text-xs sm:text-sm font-black tracking-tighter ${roomRankingRows[1].profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {formatMoney(roomRankingRows[1].profit)}
                                </span>
                              </div>
                              <div className="w-full bg-gradient-to-t from-slate-800/80 to-slate-500/80 rounded-t-lg h-24 border-t-2 border-slate-400 flex pt-2 justify-center shadow-[0_0_20px_rgba(148,163,184,0.2)]">
                                <span className="text-4xl font-black text-slate-300/80 drop-shadow-md">2</span>
                              </div>
                            </div>
                          )}

                          {/* Rank 1 (Center) */}
                          <div className="relative flex flex-col items-center justify-end w-[36%] z-20 animate-in slide-in-from-bottom-12 duration-1000">
                            <div className="absolute -top-20 flex flex-col items-center z-20 animate-bounce" style={{ animationDuration: '2s' }}>
                              <Crown className="w-12 h-12 text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)] mb-1" />
                              <span className="font-black text-amber-100 text-sm sm:text-base truncate w-full max-w-[100px] text-center drop-shadow-lg">{roomRankingRows[0].name}</span>
                              <span className={`text-sm sm:text-lg font-black tracking-tighter drop-shadow-md ${roomRankingRows[0].profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {formatMoney(roomRankingRows[0].profit)}
                              </span>
                            </div>
                            <div className="w-full bg-gradient-to-t from-amber-700/80 to-amber-500/80 rounded-t-xl h-32 border-t-[3px] border-amber-300 flex pt-2 justify-center shadow-[0_0_30px_rgba(251,191,36,0.4)] overflow-hidden relative group">
                              <span className="text-5xl font-black text-amber-200/90 drop-shadow-xl group-hover:scale-110 transition-transform">1</span>
                            </div>
                          </div>

                          {/* Rank 3 (Right) */}
                          {roomRankingRows[2] && (
                            <div className="relative flex flex-col items-center justify-end w-[30%] animate-in slide-in-from-bottom-4 duration-500">
                              <div className="absolute -top-14 flex flex-col items-center z-10 animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '2.2s' }}>
                                <Medal className="w-7 h-7 text-orange-400 drop-shadow-md mb-1" />
                                <span className="font-bold text-white text-xs sm:text-sm truncate w-full max-w-[80px] text-center">{roomRankingRows[2].name}</span>
                                <span className={`text-xs sm:text-sm font-black tracking-tighter ${roomRankingRows[2].profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {formatMoney(roomRankingRows[2].profit)}
                                </span>
                              </div>
                              <div className="w-full bg-gradient-to-t from-orange-900/80 to-orange-600/80 rounded-t-lg h-20 border-t-2 border-orange-400 flex pt-2 justify-center shadow-[0_0_15px_rgba(251,146,60,0.2)]">
                                <span className="text-3xl font-black text-orange-300/80 drop-shadow-md">3</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Remaining Ranks List */}
                      {roomRankingRows.length > 3 && (
                        <div className="grid gap-3">
                          {roomRankingRows.slice(3).map((row, index) => (
                            <div
                              key={`room-rank-${row.id}`}
                              className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-5 py-4 backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-white/10 hover:shadow-lg animate-in fade-in slide-in-from-bottom-2"
                              style={{ animationDelay: `${(index + 1) * 100}ms` }}
                            >
                              <div className="flex min-w-0 items-center justify-between sm:justify-start gap-4">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-black text-white/50 shadow-inner">
                                  {index + 4}
                                </div>
                                <div className="min-w-0 flex flex-col items-start gap-1">
                                  <p className="truncate text-base font-bold text-slate-200 group-hover:text-white transition-colors">
                                    {row.name}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="h-[20px] px-2 text-[10px] bg-black/20 text-muted-foreground border-white/10 shrink-0">
                                      买入 {row.totalBuyIn}
                                    </Badge>
                                    {row.leftEarly && (
                                      <Badge variant="destructive" className="h-[20px] px-2 text-[10px] shrink-0">
                                        已离桌
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right sm:pl-2">
                                <p className={`text-3xl font-black tabular-nums tracking-tight ${row.profit >= 0 ? 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]' : 'text-red-400'}`}>
                                  {formatMoney(row.profit)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="room">房间</TabsTrigger>
                <TabsTrigger value="ledger">账本</TabsTrigger>
                <TabsTrigger value="settlement">清盘</TabsTrigger>
                <TabsTrigger value="history">统计</TabsTrigger>
              </TabsList>

              <TabsContent value="room" className="space-y-4">
                  <RoomMembersPanel
                    players={room.players}
                    actorId={actorId}
                    actorRole={actor?.role}
                    joinNickname={joinNickname}
                    onJoinNicknameChange={setJoinNickname}
                    onJoin={joinRoom}
                    onSwitchActor={handleSwitchActor}
                    onPromoteBookkeeper={handlePromoteBookkeeper}
                  />

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">规则设定</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-md border border-border p-3">
                      <p className="text-sm font-semibold">小盲（每手强制下注的小盲）</p>
                      <p className="mb-2 text-xs text-muted-foreground">用于定义盲注结构和牌局节奏。</p>
                      <Input
                        type="number"
                        className="h-11"
                        value={room.settings.smallBlind}
                        onChange={(event) => updateSetting('smallBlind', Number(event.target.value) || 0)}
                      />
                    </div>
                    <div className="rounded-md border border-border p-3">
                      <p className="text-sm font-semibold">大盲（每手强制下注的大盲）</p>
                      <p className="mb-2 text-xs text-muted-foreground">用于计算 BB/h 等统计指标。</p>
                      <Input
                        type="number"
                        className="h-11"
                        value={room.settings.bigBlind}
                        onChange={(event) => updateSetting('bigBlind', Number(event.target.value) || 0)}
                      />
                    </div>
                    <div className="rounded-md border border-border p-3">
                      <p className="text-sm font-semibold">最小买入（单次申请下限）</p>
                      <p className="mb-2 text-xs text-muted-foreground">低于该金额的买入/重买会被拦截。</p>
                      <Input
                        type="number"
                        className="h-11"
                        value={room.settings.minBuyIn}
                        onChange={(event) => updateSetting('minBuyIn', Number(event.target.value) || 0)}
                      />
                    </div>
                    <div className="rounded-md border border-border p-3">
                      <p className="text-sm font-semibold">最大买入（单次申请上限）</p>
                      <p className="mb-2 text-xs text-muted-foreground">超过该金额的买入/重买会被拦截。</p>
                      <Input
                        type="number"
                        className="h-11"
                        value={room.settings.maxBuyIn}
                        onChange={(event) => updateSetting('maxBuyIn', Number(event.target.value) || 0)}
                      />
                    </div>
                    <div className="rounded-md border border-border p-3 md:col-span-2">
                      <p className="text-sm font-semibold">每单位货币筹码（货币与筹码兑换比例）</p>
                      <p className="mb-2 text-xs text-muted-foreground">例如 100 表示 1 单位货币 = 100 筹码。</p>
                      <Input
                        type="number"
                        className="h-11"
                        value={room.settings.chipsPerCurrency}
                        onChange={(event) => updateSetting('chipsPerCurrency', Number(event.target.value) || 1)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ledger" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">买入与离桌申请</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-4">
                    <select
                      className="h-11 rounded-md border border-border bg-background px-3 text-sm"
                      value={requestedType}
                      onChange={(event) => setRequestedType(event.target.value as LedgerActionType)}
                    >
                      <option value="buyin">买入申请</option>
                      <option value="rebuy">重买申请</option>
                      <option value="cashout">中途离桌</option>
                    </select>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={requestedAmount}
                      onChange={(event) => setRequestedAmount(event.target.value)}
                      placeholder={requestedType === 'cashout' ? '输入离桌时筹码折算金额' : '输入买入金额'}
                      className="h-11"
                    />
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button className="h-11 flex-1" onClick={submitLedgerRequest}>
                        提交申请
                      </Button>
                      {canApprove && (
                        <Button 
                          variant="outline"
                          className={`h-11 flex-1 whitespace-nowrap shadow-[0px_0px_10px_rgba(99,102,241,0.1)] border transition-all duration-300 ${
                            requestedType === 'buyin' 
                              ? 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border-indigo-500/30'
                              : 'bg-muted/20 text-muted-foreground border-transparent opacity-50 cursor-not-allowed'
                          }`}
                          onClick={requestedType === 'buyin' ? applyBuyInToAllPlayers : undefined}
                          title={requestedType === 'buyin' ? '为所有在桌玩家同时买入' : '仅在“买入申请”模式下可用'}
                        >
                          ⭐ 一键全员买入
                        </Button>
                      )}
                    </div>
                    <div className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
                      普通玩家仅可提交申请，房主/记账员审批后生效。
                    </div>
                  </CardContent>
                </Card>

                  <LedgerEntriesPanel
                    entries={room.ledger}
                    players={room.players}
                    canApprove={canApprove}
                    onApprove={approveRequest}
                  />
              </TabsContent>

              <TabsContent value="settlement" className="space-y-4">
                  <SettlementPanel
                    totalBuyInCurrency={totalBuyInCurrency}
                    totalBuyInChips={totalBuyInChips}
                    totalFinalChips={totalFinalChips}
                    chipDelta={chipDelta}
                    settlementRows={settlementRows}
                    reconcileMode={reconcileMode}
                    assignPlayerId={assignPlayerId}
                    assignOptions={room.players.map((player) => ({ id: player.id, nickname: player.nickname }))}
                    transferPlan={transferPlan}
                    formatMoney={formatMoney}
                    onSetFinalChips={setFinalChips}
                    onReconcileModeChange={handleReconcileModeChange}
                    onAssignPlayerChange={setAssignPlayerId}
                    onReconcile={reconcile}
                    onCloseGame={closeGame}
                  />
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                  <HistoryStatsPanel rankingRows={rankingRows} trendData={trendData} formatMoney={formatMoney} />
              </TabsContent>
            </Tabs>

            <Card>
              <CardContent className="grid gap-3 p-4 md:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">房间</p>
                  <p className="text-base font-semibold">{room.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">邀请码: {room.inviteCode}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="mb-1 text-xs text-muted-foreground">邀请链接</p>
                  <p className="truncate text-xs text-foreground">{room.inviteLink}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button className="h-11 flex-1" variant="secondary" onClick={copyInvite}>
                    {copied ? '已复制链接' : '复制邀请链接'}
                  </Button>
                  <a
                    className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border"
                    href={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                      room.inviteLink
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <QrCode className="h-5 w-5" />
                  </a>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3 md:grid-cols-3">
              <Card>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">审批状态</p>
                    <p className="font-semibold">
                        {pendingLedgerCount} 笔待审
                    </p>
                  </div>
                  <Clock3 className="h-5 w-5 text-amber-300" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">公积金</p>
                    <p className="font-semibold">{room.reservePoolChips} 筹码</p>
                  </div>
                  <Wallet className="h-5 w-5 text-cyan-300" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">清盘校验</p>
                    <p className="font-semibold">{chipDelta === 0 ? '已平衡' : '待平账'}</p>
                  </div>
                  {chipDelta === 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  ) : (
                    <XCircle className="h-5 w-5 text-amber-300" />
                  )}
                </CardContent>
              </Card>
            </div>

            {room.closedAt && (
              <div className="flex flex-wrap gap-2">
                <Button onClick={newRound}>基于当前成员开启新一局</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRoom(null);
                    setActorId('');
                    setTab('room');
                  }}
                >
                  返回建房页
                </Button>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/20 px-3 py-2 text-sm text-destructive-foreground">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
