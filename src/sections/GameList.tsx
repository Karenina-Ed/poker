import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Plus, Play, Trash2, Calendar, Users, Clock } from 'lucide-react';
import type { GameSession } from '@/types';

interface GameListProps {
  sessions: GameSession[];
  currentSession: GameSession | null;
  onCreateGame: (name?: string) => void;
  onLoadGame: (sessionId: string) => void;
  onDeleteGame: (sessionId: string) => void;
}

export function GameList({ sessions, currentSession, onCreateGame, onLoadGame, onDeleteGame }: GameListProps) {
  const [newGameName, setNewGameName] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleCreate = () => {
    onCreateGame(newGameName);
    setNewGameName('');
    setIsDialogOpen(false);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (createdAt: number, updatedAt: number) => {
    const diff = updatedAt - createdAt;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    }
    return `${minutes}分钟`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">游戏列表</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              新建游戏
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建新游戏</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">游戏名称（可选）</label>
                <Input
                  placeholder="例如：周五晚局"
                  value={newGameName}
                  onChange={(e) => setNewGameName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <Button onClick={handleCreate} className="w-full">
                创建游戏
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {sessions.length === 0 ? (
        <Card className="border-dashed border-muted">
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>还没有游戏记录</p>
              <p className="text-sm mt-1">点击上方按钮创建新游戏</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-3 pr-4">
            {sessions.map((session) => (
              <Card
                key={session.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  currentSession?.id === session.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => onLoadGame(session.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{session.name}</h3>
                        {session.isActive ? (
                          <Badge variant="default" className="text-xs">进行中</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">已结束</Badge>
                        )}
                        {currentSession?.id === session.id && (
                          <Badge variant="outline" className="text-xs">当前</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(session.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {session.players.length}人
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(session.createdAt, session.updatedAt)}
                        </span>
                        {session.accessCode && (
                          <span className="flex items-center gap-1 font-mono text-xs bg-muted px-2 py-0.5 rounded">
                            码: {session.accessCode}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          onLoadGame(session.id);
                        }}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteGame(session.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
