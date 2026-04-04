import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, 
  UserX, 
  Edit2, 
  Check, 
  X, 
  RotateCcw,
  Coins,
  UserPlus
} from 'lucide-react';
import type { Player } from '@/types';

interface PlayerManagerProps {
  players: Player[];
  onAddPlayer: (name: string, initialBuyIn: number) => void;
  onRemovePlayer: (playerId: string) => void;
  onUpdatePlayerName: (playerId: string, name: string) => void;
  onAddBuyIn: (playerId: string, amount: number) => void;
  onUndoLastBuyIn: (playerId: string) => void;
  onCashOut: (playerId: string, amount: number) => void;
  onCancelCashOut: (playerId: string) => void;
}

const PRESET_BUY_INS = [100, 200, 500, 1000];

export function PlayerManager({
  players,
  onAddPlayer,
  onRemovePlayer,
  onUpdatePlayerName,
  onAddBuyIn,
  onUndoLastBuyIn,
  onCashOut,
  onCancelCashOut,
}: PlayerManagerProps) {
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerBuyIn, setNewPlayerBuyIn] = useState('');
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [cashOutAmount, setCashOutAmount] = useState<Record<string, string>>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [quickBuyIn, setQuickBuyIn] = useState<Record<string, string>>({});

  const handleAddPlayer = () => {
    if (newPlayerName.trim()) {
      onAddPlayer(newPlayerName.trim(), Number(newPlayerBuyIn) || 0);
      setNewPlayerName('');
      setNewPlayerBuyIn('');
      setIsAddDialogOpen(false);
    }
  };

  const startEdit = (player: Player) => {
    setEditingPlayer(player.id);
    setEditName(player.name);
  };

  const saveEdit = () => {
    if (editingPlayer && editName.trim()) {
      onUpdatePlayerName(editingPlayer, editName.trim());
      setEditingPlayer(null);
    }
  };

  const cancelEdit = () => {
    setEditingPlayer(null);
    setEditName('');
  };

  const getTotalBuyIn = (player: Player) => {
    return player.buyIns.reduce((sum, b) => sum + b.amount, 0);
  };

  const getBuyInCount = (player: Player) => {
    return player.buyIns.length;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">玩家管理</h2>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="w-4 h-4" />
              添加玩家
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>添加新玩家</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">玩家名称</label>
                <Input
                  placeholder="输入玩家名称"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer()}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">初始买入（可选）</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={newPlayerBuyIn}
                  onChange={(e) => setNewPlayerBuyIn(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer()}
                />
              </div>
              <Button onClick={handleAddPlayer} className="w-full" disabled={!newPlayerName.trim()}>
                添加玩家
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {players.length === 0 ? (
        <Card className="border-dashed border-muted">
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground">
              <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>还没有玩家</p>
              <p className="text-sm mt-1">点击上方按钮添加玩家</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="space-y-3 pr-4">
            {players.map((player) => {
              const totalBuyIn = getTotalBuyIn(player);
              const buyInCount = getBuyInCount(player);
              const isSettled = !!player.cashOut;

              return (
                <Card key={player.id} className={`overflow-hidden ${isSettled ? 'opacity-75' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        {editingPlayer === player.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-8"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit();
                                if (e.key === 'Escape') cancelEdit();
                              }}
                            />
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveEdit}>
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{player.name}</h3>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(player)}>
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            {isSettled && (
                              <Badge variant="secondary" className="text-xs">已结算</Badge>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Coins className="w-3 h-3" />
                            买入: <span className="font-medium text-foreground">{totalBuyIn}</span>
                            {buyInCount > 1 && <span className="text-xs">({buyInCount}次)</span>}
                          </span>
                          {isSettled && (
                            <span className="flex items-center gap-1">
                              结算: <span className="font-medium text-foreground">{player.cashOut!.amount}</span>
                            </span>
                          )}
                          {isSettled && (
                            <span className={`font-medium ${player.cashOut!.amount - totalBuyIn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {player.cashOut!.amount - totalBuyIn >= 0 ? '+' : ''}{player.cashOut!.amount - totalBuyIn}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive h-8 w-8"
                        onClick={() => onRemovePlayer(player.id)}
                      >
                        <UserX className="w-4 h-4" />
                      </Button>
                    </div>

                    {!isSettled ? (
                      <div className="space-y-3">
                        {/* 快速买入 */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground whitespace-nowrap">快速买入:</span>
                          <div className="flex gap-1">
                            {PRESET_BUY_INS.map((amount) => (
                              <Button
                                key={amount}
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => onAddBuyIn(player.id, amount)}
                              >
                                +{amount}
                              </Button>
                            ))}
                          </div>
                          <div className="flex gap-1 ml-auto">
                            <Input
                              type="number"
                              placeholder="自定义"
                              className="h-7 w-20 text-xs"
                              value={quickBuyIn[player.id] || ''}
                              onChange={(e) => setQuickBuyIn({ ...quickBuyIn, [player.id]: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && quickBuyIn[player.id]) {
                                  onAddBuyIn(player.id, Number(quickBuyIn[player.id]));
                                  setQuickBuyIn({ ...quickBuyIn, [player.id]: '' });
                                }
                              }}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2"
                              disabled={!quickBuyIn[player.id]}
                              onClick={() => {
                                onAddBuyIn(player.id, Number(quickBuyIn[player.id]));
                                setQuickBuyIn({ ...quickBuyIn, [player.id]: '' });
                              }}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                          {buyInCount > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => onUndoLastBuyIn(player.id)}
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />
                              撤销
                            </Button>
                          )}
                        </div>

                        {/* 结算 */}
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <span className="text-sm text-muted-foreground whitespace-nowrap">结算:</span>
                          <Input
                            type="number"
                            placeholder="结算筹码"
                            className="h-8 flex-1"
                            value={cashOutAmount[player.id] || ''}
                            onChange={(e) => setCashOutAmount({ ...cashOutAmount, [player.id]: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && cashOutAmount[player.id]) {
                                onCashOut(player.id, Number(cashOutAmount[player.id]));
                                setCashOutAmount({ ...cashOutAmount, [player.id]: '' });
                              }
                            }}
                          />
                          <Button
                            variant="default"
                            size="sm"
                            disabled={!cashOutAmount[player.id]}
                            onClick={() => {
                              onCashOut(player.id, Number(cashOutAmount[player.id]));
                              setCashOutAmount({ ...cashOutAmount, [player.id]: '' });
                            }}
                          >
                            结算
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => onCancelCashOut(player.id)}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          取消结算
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
