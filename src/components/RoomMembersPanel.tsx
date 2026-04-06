import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Role = 'host' | 'bookkeeper' | 'player';

interface PlayerSummary {
  id: string;
  nickname: string;
  role: Role;
  isAnonymous: boolean;
}

interface RoomMembersPanelProps {
  players: PlayerSummary[];
  actorId: string;
  actorRole?: Role;
  joinNickname: string;
  onJoinNicknameChange: (value: string) => void;
  onJoin: () => void;
  onSwitchActor: (playerId: string) => void;
  onPromoteBookkeeper: (playerId: string) => void;
}

export const RoomMembersPanel = memo(function RoomMembersPanel({
  players,
  actorId,
  actorRole,
  joinNickname,
  onJoinNicknameChange,
  onJoin,
  onSwitchActor,
  onPromoteBookkeeper,
}: RoomMembersPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">成员与权限</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            value={joinNickname}
            onChange={(event) => onJoinNicknameChange(event.target.value)}
            placeholder="玩家昵称（必填）"
            className="h-11"
          />
          <Button className="h-11" onClick={onJoin}>
            新玩家加入
          </Button>
        </div>

        <div className="grid gap-2">
          {players.map((player) => (
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
                  onClick={() => onSwitchActor(player.id)}
                >
                  切换视角
                </Button>
                {actorRole === 'host' && player.role === 'player' && (
                  <Button size="sm" variant="secondary" onClick={() => onPromoteBookkeeper(player.id)}>
                    设为记账员
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});
