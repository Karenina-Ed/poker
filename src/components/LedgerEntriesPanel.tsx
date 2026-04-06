import { memo, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type LedgerStatus = 'pending' | 'approved' | 'rejected';
type LedgerActionType = 'buyin' | 'rebuy' | 'cashout';

interface LedgerEntry {
  id: string;
  type: LedgerActionType;
  playerId: string;
  amount: number;
  chips: number;
  createdAt: number;
  status: LedgerStatus;
}

interface PlayerSummary {
  id: string;
  nickname: string;
}

interface LedgerEntriesPanelProps {
  entries: LedgerEntry[];
  players: PlayerSummary[];
  canApprove: boolean;
  onApprove: (requestId: string, approved: boolean) => void;
}

export const LedgerEntriesPanel = memo(function LedgerEntriesPanel({
  entries,
  players,
  canApprove,
  onApprove,
}: LedgerEntriesPanelProps) {
  const playerNameById = useMemo(() => {
    const map = new Map<string, string>();
    players.forEach((player) => map.set(player.id, player.nickname));
    return map;
  }, [players]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">实时账本</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.length === 0 && <p className="text-sm text-muted-foreground">暂无申请记录</p>}
        {entries.map((entry) => {
          const ownerName = playerNameById.get(entry.playerId) || '未知玩家';
          return (
            <div key={entry.id} className="rounded-md border border-border bg-card/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {ownerName} · {entry.type.toUpperCase()}
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
                      <Button size="sm" className="h-8" disabled={!canApprove} onClick={() => onApprove(entry.id, true)}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={!canApprove}
                        onClick={() => onApprove(entry.id, false)}
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
  );
});
