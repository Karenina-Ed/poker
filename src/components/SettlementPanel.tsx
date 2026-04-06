import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

type ReconcileMode = 'proportional' | 'assign' | 'reserve';

interface SettlementRow {
  id: string;
  nickname: string;
  leftEarly: boolean;
  buyInTotal: number;
  inputValue: number | string;
  profit: number;
}

interface AssignOption {
  id: string;
  nickname: string;
}

interface TransferItem {
  from: string;
  to: string;
  amount: number;
}

interface SettlementPanelProps {
  totalBuyInCurrency: number;
  totalBuyInChips: number;
  totalFinalChips: number;
  chipDelta: number;
  settlementRows: SettlementRow[];
  reconcileMode: ReconcileMode;
  assignPlayerId: string;
  assignOptions: AssignOption[];
  transferPlan: TransferItem[];
  formatMoney: (value: number) => string;
  onSetFinalChips: (playerId: string, chips: number) => void;
  onReconcileModeChange: (value: ReconcileMode) => void;
  onAssignPlayerChange: (value: string) => void;
  onReconcile: () => void;
  onCloseGame: () => void;
}

export const SettlementPanel = memo(function SettlementPanel({
  totalBuyInCurrency,
  totalBuyInChips,
  totalFinalChips,
  chipDelta,
  settlementRows,
  reconcileMode,
  assignPlayerId,
  assignOptions,
  transferPlan,
  formatMoney,
  onSetFinalChips,
  onReconcileModeChange,
  onAssignPlayerChange,
  onReconcile,
  onCloseGame,
}: SettlementPanelProps) {
  return (
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
            <p className="mt-1 text-xs text-muted-foreground">系统检测到筹码不守恒，请使用平账选项后再清盘。</p>
          )}
        </div>

        <div className="space-y-2">
          {settlementRows.map((row) => (
            <div
              key={row.id}
              className="grid items-center gap-2 rounded-md border border-border p-3 md:grid-cols-[1fr_180px_1fr]"
            >
              <div>
                <p className="text-sm font-semibold">{row.nickname}</p>
                <p className="text-xs text-muted-foreground">
                  买入 {row.buyInTotal}
                  {row.leftEarly ? ' · 已中途离桌(锁定)' : ''}
                </p>
              </div>
              <Input
                type="number"
                disabled={row.leftEarly}
                value={row.inputValue}
                onChange={(event) => onSetFinalChips(row.id, Number(event.target.value) || 0)}
                placeholder="最终筹码"
                className="h-11"
              />
              <div className="text-right text-sm font-semibold">盈亏 {formatMoney(row.profit)}</div>
            </div>
          ))}
        </div>

        <Separator />

        <div className="grid gap-3 md:grid-cols-4">
          <select
            className="h-11 rounded-md border border-border bg-background px-3 text-sm"
            value={reconcileMode}
            onChange={(event) => onReconcileModeChange(event.target.value as ReconcileMode)}
          >
            <option value="proportional">按比例分摊差额</option>
            <option value="assign">指定某人承担</option>
            <option value="reserve">记入公积金</option>
          </select>
          <select
            className="h-11 rounded-md border border-border bg-background px-3 text-sm"
            value={assignPlayerId}
            onChange={(event) => onAssignPlayerChange(event.target.value)}
            disabled={reconcileMode !== 'assign'}
          >
            <option value="">选择承担人</option>
            {assignOptions.map((player) => (
              <option key={player.id} value={player.id}>
                {player.nickname}
              </option>
            ))}
          </select>
          <Button className="h-11" variant="secondary" onClick={onReconcile}>
            执行平账
          </Button>
          <Button className="h-11" onClick={onCloseGame}>
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
  );
});
