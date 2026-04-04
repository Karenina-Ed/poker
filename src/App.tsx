import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import {
  Award,
  CheckCircle2,
  Clock3,
  Crown,
  Medal,
  QrCode,
  ShieldCheck,
  Trophy,
  Users,
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
    localStorage.setItem(STORAGE_ROOM, JSON.stringify(room));
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history));

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

  const rankingRows = useMemo(() => {
    const aggregate = new Map<string, number[]>();
    history.forEach((game) => {
      Object.entries(game.pnlByPlayer).forEach(([name, pnl]) => {
        if (!aggregate.has(name)) aggregate.set(name, []);
        aggregate.get(name)?.push(pnl);
      });
    });

    return Array.from(aggregate.entries())
      .map(([name, pnls]) => {
        const total = round2(sum(pnls));
        const avg = round2(total / pnls.length);
        let peak = 0;
        let running = 0;
        let maxDrawdown = 0;
        pnls.forEach((value) => {
          running += value;
          peak = Math.max(peak, running);
          maxDrawdown = Math.min(maxDrawdown, running - peak);
        });

        const games = history.filter((item) => item.pnlByPlayer[name] !== undefined);
        const totalHours = games.reduce((hours, item) => {
          const duration = (item.closedAt - item.startedAt) / (1000 * 60 * 60);
          return hours + Math.max(duration, 0.1);
        }, 0);
        const avgBigBlind = games.reduce((acc, item) => acc + item.bigBlind, 0) / Math.max(games.length, 1);
        const bbPerHour = avgBigBlind > 0 ? round2(total / avgBigBlind / Math.max(totalHours, 0.1)) : 0;

        return {
          name,
          games: pnls.length,
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
      setError('请输入有效金额。');
      return;
    }
    if (requestedType !== 'cashout') {
      if (amount < room.settings.minBuyIn || amount > room.settings.maxBuyIn) {
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

  const setFinalChips = (playerId: string, chips: number) => {
    if (!room) return;
    setRoom({
      ...room,
      players: room.players.map((player) =>
        player.id === playerId
          ? {
              ...player,
              finalChips: Number.isFinite(chips) ? chips : 0,
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
                    <div className="rounded-2xl border border-amber-300/40 bg-amber-400/10 p-5">
                      <div className="mb-2 flex items-center gap-2">
                        <Crown className="h-6 w-6 text-amber-300" />
                        <p className="text-xs tracking-[0.2em] text-amber-200">TOP 1</p>
                      </div>
                      <p className="truncate text-3xl font-black text-white md:text-4xl">
                        {roomRankingRows[0].name}
                      </p>
                      <p
                        className={`mt-2 text-4xl font-black tracking-tight md:text-5xl ${
                          roomRankingRows[0].profit >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {formatMoney(roomRankingRows[0].profit)}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        总买入 {roomRankingRows[0].totalBuyIn}
                        {roomRankingRows[0].leftEarly ? ' · 已中途离桌' : ''}
                      </p>
                    </div>

                    <div className="grid gap-2">
                      {roomRankingRows.map((row, index) => (
                        <div
                          key={`room-rank-${row.id}`}
                          className="flex items-center justify-between rounded-xl border border-border/70 bg-card/70 px-4 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${
                                index === 0
                                  ? 'bg-amber-300/30 text-amber-100'
                                  : index === 1
                                    ? 'bg-slate-300/20 text-slate-100'
                                    : index === 2
                                      ? 'bg-orange-400/25 text-orange-100'
                                      : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {index + 1}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">{row.name}</p>
                              <p className="text-xs text-muted-foreground">买入 {row.totalBuyIn}</p>
                            </div>
                          </div>
                          <p className={`text-2xl font-black ${row.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatMoney(row.profit)}
                          </p>
                        </div>
                      ))}
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
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">成员与权限</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        value={joinNickname}
                        onChange={(event) => setJoinNickname(event.target.value)}
                        placeholder="玩家昵称（必填）"
                        className="h-11"
                      />
                      <Button className="h-11" onClick={joinRoom}>
                        新玩家加入
                      </Button>
                    </div>

                    <div className="grid gap-2">
                      {room.players.map((player) => (
                        <div
                          key={player.id}
                          className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium">{player.nickname}</p>
                            <p className="text-xs text-muted-foreground">
                              {player.isAnonymous ? '匿名' : '实名'} · {player.role}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant={actorId === player.id ? 'default' : 'outline'}
                              onClick={() => setActorId(player.id)}
                            >
                              切换视角
                            </Button>
                            {actor?.role === 'host' && player.role === 'player' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setRoom({
                                    ...room,
                                    players: room.players.map((item) =>
                                      item.id === player.id ? { ...item, role: 'bookkeeper' } : item
                                    ),
                                  });
                                }}
                              >
                                设为记账员
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

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
                      type="number"
                      value={requestedAmount}
                      onChange={(event) => setRequestedAmount(event.target.value)}
                      placeholder={requestedType === 'cashout' ? '输入离桌时筹码折算金额' : '输入买入金额'}
                      className="h-11"
                    />
                    <Button className="h-11" onClick={submitLedgerRequest}>
                      提交申请
                    </Button>
                    <div className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
                      普通玩家仅可提交申请，房主/记账员审批后生效。
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">实时账本</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {room.ledger.length === 0 && (
                      <p className="text-sm text-muted-foreground">暂无申请记录</p>
                    )}
                    {room.ledger.map((entry) => {
                      const owner = room.players.find((player) => player.id === entry.playerId);
                      return (
                        <div
                          key={entry.id}
                          className="rounded-md border border-border bg-card/70 p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold">
                                {owner?.nickname || '未知玩家'} · {entry.type.toUpperCase()}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(entry.createdAt).toLocaleTimeString('zh-CN')} · 金额 {entry.amount} · 筹码 {entry.chips}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  entry.status === 'approved'
                                    ? 'default'
                                    : entry.status === 'rejected'
                                      ? 'destructive'
                                      : 'secondary'
                                }
                              >
                                {entry.status}
                              </Badge>
                              {entry.status === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    className="h-8"
                                    disabled={!canApprove}
                                    onClick={() => approveRequest(entry.id, true)}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8"
                                    disabled={!canApprove}
                                    onClick={() => approveRequest(entry.id, false)}
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settlement" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">筹码守恒校验</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs text-muted-foreground">历史买入总额</p>
                        <p className="text-lg font-bold">{totalBuyInCurrency}</p>
                      </div>
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs text-muted-foreground">应有筹码总和</p>
                        <p className="text-lg font-bold">{totalBuyInChips}</p>
                      </div>
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs text-muted-foreground">实际筹码总和</p>
                        <p className="text-lg font-bold">{totalFinalChips}</p>
                      </div>
                    </div>

                    <div className="rounded-md border border-border p-3">
                      <p className="text-sm">
                        差额: <span className={chipDelta === 0 ? 'text-green-400' : 'text-amber-300'}>{chipDelta}</span>
                      </p>
                      {chipDelta !== 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          系统检测到筹码不守恒，请使用平账选项后再清盘。
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      {room.players.map((player) => (
                        <div
                          key={player.id}
                          className="grid items-center gap-2 rounded-md border border-border p-3 md:grid-cols-[1fr_180px_1fr]"
                        >
                          <div>
                            <p className="text-sm font-semibold">{player.nickname}</p>
                            <p className="text-xs text-muted-foreground">
                              买入 {getPlayerTotalBuyIn(player)}
                              {player.leftEarly ? ' · 已中途离桌(锁定)' : ''}
                            </p>
                          </div>
                          <Input
                            type="number"
                            disabled={player.leftEarly}
                            value={player.leftEarly ? player.cashOutChips ?? 0 : player.finalChips ?? ''}
                            onChange={(event) =>
                              setFinalChips(player.id, Number(event.target.value) || 0)
                            }
                            placeholder="最终筹码"
                            className="h-11"
                          />
                          <div className="text-right text-sm font-semibold">
                            盈亏 {formatMoney(getProfitCurrency(player, room.settings.chipsPerCurrency))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    <div className="grid gap-3 md:grid-cols-4">
                      <select
                        className="h-11 rounded-md border border-border bg-background px-3 text-sm"
                        value={reconcileMode}
                        onChange={(event) => setReconcileMode(event.target.value as ReconcileMode)}
                      >
                        <option value="proportional">按比例分摊差额</option>
                        <option value="assign">指定某人承担</option>
                        <option value="reserve">记入公积金</option>
                      </select>
                      <select
                        className="h-11 rounded-md border border-border bg-background px-3 text-sm"
                        value={assignPlayerId}
                        onChange={(event) => setAssignPlayerId(event.target.value)}
                        disabled={reconcileMode !== 'assign'}
                      >
                        <option value="">选择承担人</option>
                        {room.players.map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.nickname}
                          </option>
                        ))}
                      </select>
                      <Button className="h-11" variant="secondary" onClick={reconcile}>
                        执行平账
                      </Button>
                      <Button className="h-11" onClick={closeGame}>
                        清盘并生成账单
                      </Button>
                    </div>

                    <div className="rounded-md border border-border bg-card/60 p-3">
                      <p className="mb-2 text-sm font-semibold">最优转账路径（最少次数）</p>
                      {transferPlan.length === 0 ? (
                        <p className="text-xs text-muted-foreground">暂无转账，可能所有人保本或尚未完成清盘。</p>
                      ) : (
                        <div className="space-y-1">
                          {transferPlan.map((item, index) => (
                            <p key={`${item.from}-${item.to}-${index}`} className="text-sm">
                              {item.from} 转给 {item.to} {item.amount}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
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
                                <p className="mt-1 text-xs text-muted-foreground">
                                  场均 {formatMoney(row.avg)} · BB/h {row.bbPerHour}
                                </p>
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
                                <p
                                  className={`text-lg font-black ${
                                    row.total >= 0 ? 'text-green-400' : 'text-red-400'
                                  }`}
                                >
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
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
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
                      {room.ledger.filter((item) => item.status === 'pending').length} 笔待审
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
