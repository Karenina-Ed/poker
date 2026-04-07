import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export type PlayerRank = {
  name: string;
  score: number;
  [key: string]: unknown; // Allow other properties
};

// 预设数据示例，如果数据库为空或者请求失败将使用此数据
const defaultData: PlayerRank[] = [
  { name: '玩家A', score: 1250 },
  { name: '玩家B', score: 800 },
  { name: '玩家C', score: 300 },
  { name: '玩家D', score: -500 },
  { name: '玩家E', score: -1850 },
];

const DB_TABLE_NAME = 'pure_ranking'; // 请确保你的 Supabase 包含这个表，且有 id 和 data 字段

export function PureRanking() {
  const [data, setData] = useState<PlayerRank[]>(defaultData);
  const [isLoading, setIsLoading] = useState(true);
  const [editData, setEditData] = useState<{ id: number; name: string; score: string }[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 挂载时从 Supabase 数据库拉取排位数据
  useEffect(() => {
    const fetchRankingData = async () => {
      setIsLoading(true);
      try {
        const { data: dbData, error } = await supabase
          .from(DB_TABLE_NAME)
          .select('data')
          .eq('id', 1)
          .single();

        if (error && error.code !== 'PGRST116') {
          // PGRST116 是数据找不到错误，可以忽略
          console.error('Fetch ranking error:', error);
        } else if (dbData && dbData.data && Array.isArray(dbData.data)) {
          setData(dbData.data);
        }
      } catch (e) {
        console.error('Failed to load ranking data from DB', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRankingData();
  }, []);

  // 按分数从大到小排序
  const sortedData = [...data].sort((a, b) => (b.score || 0) - (a.score || 0));

  const handleAddField = () => {
    setEditData((prev) => [...prev, { id: Date.now(), name: '', score: '' }]);
  };

  const handleRemoveField = (id: number) => {
    setEditData((prev) => prev.filter((item) => item.id !== id));
  };

  const handleEditChange = (id: number, field: 'name' | 'score', value: string) => {
    setEditData((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleSave = async () => {
    try {
      const parsed: PlayerRank[] = editData
        .filter((i) => i.name.trim()) // ignore empty names
        .map((i) => ({
          name: i.name.trim(),
          score: parseFloat(i.score) || 0,
        }));
      
      setIsSaving(true);
      setErrorText('');

      // 同步到 Supabase
      const { error } = await supabase
        .from(DB_TABLE_NAME)
        .upsert({ id: 1, data: parsed });

      if (error) {
        throw new Error(error.message);
      }

      setData(parsed);
      setIsOpen(false);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setErrorText('保存失败: ' + e.message);
      } else {
        setErrorText('数据格式错误或网络异常');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#050505] text-[#f5f5f5] font-sans selection:bg-[#f5f5f5] selection:text-black flex flex-col font-light">
      
      {/* 極简顶部区域 */}
      <header className="pt-24 pb-8 md:pt-32 md:pb-16 px-6 md:px-12 w-full max-w-5xl mx-auto flex flex-col gap-2">
        <p className="text-[10px] md:text-xs font-mono uppercase tracking-[0.3em] text-[#666]">
          Official Results
        </p>
        <h1 className="text-6xl md:text-[7rem] font-medium tracking-tighter leading-none">
          WPT417.
        </h1>
      </header>

      {/* 列表主体 */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 md:px-12 pb-40">
        {isLoading ? (
          <div className="pt-12 text-[#666] font-mono text-sm uppercase tracking-widest animate-pulse">
            Loading data...
          </div>
        ) : (
          <div className="flex flex-col border-t border-[#1f1f1f]">
            {sortedData.map((player, index) => {
              const profitStr = (player.score || 0).toFixed(1).replace(/\.0$/, '');
              const isWin = (player.score || 0) > 0;
              const isTop = index < 3;
              
              return (
                <div
                  key={index}
                  className={`group flex items-baseline justify-between py-6 md:py-8 border-b border-[#1f1f1f] hover:bg-[#0f0f0f] transition-colors duration-300 animate-in fade-in slide-in-from-bottom-4`}
                  style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'both' }}
                >
                  <div className="flex items-baseline gap-6 md:gap-12">
                    <span className="text-sm md:text-base font-mono text-[#555] w-6 md:w-8 inline-block">
                      {(index + 1).toString().padStart(2, '0')}
                    </span>
                    <span className={`text-2xl md:text-5xl tracking-tight ${isTop ? 'font-medium text-[#f5f5f5]' : 'font-light text-[#999] group-hover:text-[#ededed] transition-colors'}`}>
                      {player.name}
                    </span>
                  </div>

                  <div className={`font-mono text-2xl md:text-5xl tabular-nums tracking-tighter ${isWin ? 'text-[#f5f5f5]' : 'text-[#666]'}`}>
                    {isWin ? '+' : ''}{profitStr}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 底部悬浮极简交互触发器 */}
      <div className="fixed bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#050505] to-transparent pointer-events-none flex items-end justify-center pb-8 z-50">
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (open) {
            setEditData(data.map((item, i) => ({
              id: Date.now() + i,
              name: item.name,
              score: String(item.score || 0)
            })));
            setErrorText('');
          }
        }}>
          <DialogTrigger asChild>
            <button className="pointer-events-auto text-[10px] md:text-xs font-mono uppercase tracking-[0.2em] text-[#666] hover:text-[#f5f5f5] transition-colors border-b border-[#333] hover:border-[#f5f5f5] pb-1">
              编辑数据
            </button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-2xl bg-[#111] border border-[#222] text-[#f5f5f5] shadow-2xl rounded-2xl p-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-3xl font-medium tracking-tight">
                更新数据
              </DialogTitle>
              <div className="text-sm text-[#888] font-light mt-1">
                在此编辑玩家名称和分数。
              </div>
            </DialogHeader>
            
            <div className="py-2 space-y-2 max-h-[50vh] overflow-y-auto px-1 pr-6 scrollbar-thin scrollbar-thumb-zinc-800">
              {editData.map((item, idx) => (
                <div key={item.id} className="flex gap-4 items-center group">
                  <span className="text-[#555] font-mono text-xs w-6 text-right">
                    {(idx + 1).toString().padStart(2, '0')}
                  </span>
                  <Input 
                    value={item.name} 
                    onChange={(e) => handleEditChange(item.id, 'name', e.target.value)} 
                    placeholder="Name" 
                    className="flex-1 bg-[#181818] border-none shadow-none text-lg tracking-tight rounded-none border-b border-[#222] focus-visible:ring-0 focus-visible:border-[#ededed] transition-colors px-0 h-12 text-[#f5f5f5]"
                  />
                  <Input 
                    value={item.score} 
                    type="number"
                    step="0.1"
                    onChange={(e) => handleEditChange(item.id, 'score', e.target.value)} 
                    placeholder="Score" 
                    className="w-32 bg-[#181818] border-none shadow-none text-lg tabular-nums rounded-none border-b border-[#222] focus-visible:ring-0 focus-visible:border-[#ededed] transition-colors px-0 h-12 text-right font-mono text-[#f5f5f5]"
                  />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleRemoveField(item.id)}
                    className="text-[#555] hover:text-[#f5f5f5] hover:bg-white/10 rounded-full"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              
              <Button 
                variant="ghost" 
                onClick={handleAddField} 
                className="w-full mt-6 text-[#888] hover:text-[#ededed] hover:bg-[#181818] font-light tracking-wide rounded-xl py-6"
              >
                <Plus className="w-4 h-4 mr-2" />
                添加玩家
              </Button>
              
              {errorText && (
                <div className="mt-4 text-red-500 text-sm font-medium animate-in fade-in">
                  {errorText}
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-6 mt-10 pt-6 border-t border-[#222]">
              <button 
                onClick={() => setIsOpen(false)} 
                className="text-sm font-medium tracking-wide text-[#888] hover:text-[#ededed] transition-colors disabled:opacity-50"
                disabled={isSaving}
              >
                取消
              </button>
              <button 
                onClick={handleSave} 
                disabled={isSaving} 
                className="text-sm font-medium tracking-wide bg-[#ededed] text-[#111] px-8 py-3 rounded-full hover:bg-[#ffffff] hover:scale-105 transition-all shadow-xl shadow-black/50 disabled:opacity-50 disabled:hover:scale-100"
              >
                {isSaving ? 'Saving...' : '保存'}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
