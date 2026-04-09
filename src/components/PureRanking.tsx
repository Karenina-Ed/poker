import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, ChevronRight, X, ArrowUpRight, ArrowDownRight, PencilLine } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export type PlayerRank = {
  name: string;
  score: number;
};

export type DailyMatch = {
  id: string;
  date: string;
  title: string;
  records: PlayerRank[];
};

export type PlayerProfile = {
  signature?: string;
};

const DB_TABLE_NAME = 'pure_ranking';

export function PureRanking() {
  const [matches, setMatches] = useState<DailyMatch[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PlayerProfile>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  
  // Profile edit dialog state
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [editingProfileName, setEditingProfileName] = useState('');
  const [editingSignature, setEditingSignature] = useState('');

  const [errorText, setErrorText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'total' | 'history'>('total');

  // Edit match state
  const [editingParams, setEditingParams] = useState<{ id: string; date: string; title: string }>({
    id: '', date: '', title: ''
  });
  const [editingRecords, setEditingRecords] = useState<{ id: number; name: string; score: string }[]>([]);
  const [recordIdCounter, setRecordIdCounter] = useState(0);

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
          console.error(error);
          return;
        }
        
        const rawData = dbData?.data;
        let loadedMatches: DailyMatch[] = [];
        let loadedProfiles: Record<string, PlayerProfile> = {};
        
        if (Array.isArray(rawData)) {
          // Legacy or migrated format where data is just an array of matches
          loadedMatches = rawData;
          if (loadedMatches.length > 0 && (loadedMatches[0] as any).name && typeof (loadedMatches[0] as any).score === 'number' && !loadedMatches[0].records) {
            loadedMatches = [{
               id: 'legacy-data',
               date: new Date().toISOString().split('T')[0],
               title: '历史沉淀数据',
               records: loadedMatches as any
            }];
          }
        } else if (rawData && typeof rawData === 'object') {
          loadedMatches = rawData.matches || [];
          loadedProfiles = rawData.profiles || {};
        }
        
        setMatches(loadedMatches);
        setProfiles(loadedProfiles);
      } catch (err) {
        console.error('Fetch err', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRankingData();
  }, []);

  const overallRanking = useMemo(() => {
    const map: Record<string, { name: string; score: number }> = {};
    matches.forEach(match => {
      match.records.forEach(r => {
        const normalizedName = (r.name || '').trim();
        const key = normalizedName.toLowerCase();
        if (!map[key]) map[key] = { name: normalizedName, score: 0 };
        map[key].score += (r.score || 0);
      });
    });
    return Object.values(map).sort((a, b) => b.score - a.score);
  }, [matches]);

  const prevRanking = useMemo(() => {
    if (matches.length <= 1) return null;
    const map: Record<string, { name: string; score: number }> = {};
    // skip the latest match (matches[0])
    matches.slice(1).forEach(match => {
      match.records.forEach(r => {
        const normalizedName = (r.name || '').trim();
        const key = normalizedName.toLowerCase();
        if (!map[key]) map[key] = { name: normalizedName, score: 0 };
        map[key].score += (r.score || 0);
      });
    });
    return Object.values(map).sort((a, b) => b.score - a.score);
  }, [matches]);

  const getRankChangeInfo = (nameToFind: string, currentRankIndex: number) => {
    if (!prevRanking) return null;
    const keyToFind = nameToFind.toLowerCase();
    const prevRankIndex = prevRanking.findIndex(p => p.name.toLowerCase() === keyToFind);
    
    if (prevRankIndex === -1) {
       // New player
       return { type: 'new' };
    }
    
    if (currentRankIndex < prevRankIndex) return { type: 'up', diff: prevRankIndex - currentRankIndex };
    if (currentRankIndex > prevRankIndex) return { type: 'down', diff: currentRankIndex - prevRankIndex };
    return { type: 'flat' };
  };

  const saveData = async (newMatches: DailyMatch[], newProfiles: Record<string, PlayerProfile>) => {
    setIsSaving(true);
    try {
      const payload = { matches: newMatches, profiles: newProfiles };
      const { error } = await supabase
        .from(DB_TABLE_NAME)
        .upsert({ id: 1, data: payload }, { onConflict: 'id' });
      
      if (error) throw error;
      setMatches(newMatches);
      setProfiles(newProfiles);
      setIsOpen(false);
      setIsProfileOpen(false);
      toast.success('数据已更新并上线');
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || '保存失败');
      toast.error('保存失败，请稍后重试');
    } finally {
      setIsSaving(false);
    }
  };

  const openNewMatchDialog = () => {
    setEditingParams({
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      title: '日常对局',
    });
    const uniquePlayers = overallRanking.map((r, i) => ({ id: i, name: r.name, score: '' })).slice(0, 8);
    if(uniquePlayers.length === 0) {
      setEditingRecords([{ id: 0, name: '', score: '' }]);
      setRecordIdCounter(1);
    } else {
      setEditingRecords(uniquePlayers);
      setRecordIdCounter(uniquePlayers.length);
    }
    setErrorText('');
    setIsOpen(true);
  };

  const openEditMatchDialog = (match: DailyMatch) => {
    setEditingParams({ id: match.id, date: match.date, title: match.title || '对局' });
    const recs = match.records.map((r, i) => ({ id: i, name: r.name, score: String(r.score) }));
    setEditingRecords(recs);
    setRecordIdCounter(recs.length);
    setErrorText('');
    setIsOpen(true);
  };

  const deleteMatch = async (matchId: string) => {
    if (!confirm('确认删除这条对局记录吗？总榜数据也将同步改变。')) return;
    const newMatches = matches.filter(m => m.id !== matchId);
    await saveData(newMatches, profiles);
  };

  const handleSaveMatch = () => {
    const validRecords: PlayerRank[] = [];
    for (const r of editingRecords) {
      const nm = r.name.trim();
      if (!nm) continue;
      const sc = Number(r.score);
      if (!isNaN(sc) && r.score !== '') {
        validRecords.push({ name: nm, score: sc });
      }
    }
    
    if (validRecords.length === 0) {
      setErrorText('请至少添加一条有效的玩家流水记录');
      return;
    }
    
    const total = validRecords.reduce((acc, curr) => acc + curr.score, 0);
    if (Math.abs(total) > 0.01 && editingParams.id !== 'legacy-data') {
      if (!confirm(`检测到该局流水合计为 ${total}, 尚未平账（应为0），确认强行保存吗？`)) return;
    }

    const finalMatch: DailyMatch = {
      id: editingParams.id,
      date: editingParams.date,
      title: editingParams.title,
      records: validRecords
    };
    
    const exists = matches.some(m => m.id === finalMatch.id);
    let newMatches;
    if (exists) {
      newMatches = matches.map(m => m.id === finalMatch.id ? finalMatch : m);
    } else {
      newMatches = [finalMatch, ...matches];
    }
    newMatches.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    saveData(newMatches, profiles);
  };

  const openProfileDialog = (name: string) => {
    const key = name.toLowerCase();
    setEditingProfileName(name);
    setEditingSignature(profiles[key]?.signature || '');
    setIsProfileOpen(true);
  };

  const handleSaveProfile = () => {
    const key = editingProfileName.toLowerCase();
    const newProfiles = { ...profiles, [key]: { ...(profiles[key] || {}), signature: editingSignature.trim() } };
    saveData(matches, newProfiles);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-[#111] text-[#f5f5f5] flex items-center justify-center font-sans">
        <div className="text-[#888] font-mono text-sm uppercase tracking-widest animate-pulse">
          Loading blockchain...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#111] text-[#f5f5f5] font-sans selection:bg-white selection:text-black flex flex-col font-light">
      
      <header className="pt-24 pb-8 md:pt-32 md:pb-16 px-6 md:px-12 w-full max-w-5xl mx-auto flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] md:text-xs font-mono uppercase tracking-[0.3em] text-[#888]">
            Texas Hold'em
          </p>
          <div className="bg-[#222] p-1 rounded-full flex gap-1 border border-[#333]">
            <button 
              onClick={() => setActiveTab('total')}
              className={`px-4 py-1.5 text-xs font-medium tracking-widest rounded-full transition-all ${activeTab === 'total' ? 'bg-[#ededed] text-[#111] shadow-sm' : 'text-[#888] hover:text-[#ddd]'}`}
            >
              TOTAL
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`px-4 py-1.5 text-xs font-medium tracking-widest rounded-full transition-all ${activeTab === 'history' ? 'bg-[#ededed] text-[#111] shadow-sm' : 'text-[#888] hover:text-[#ddd]'}`}
            >
              LOGS
            </button>
          </div>
        </div>
        <h1 className="text-5xl md:text-[6rem] font-medium tracking-tighter leading-none mt-4 transition-all">
          {activeTab === 'total' ? 'Leaderboard.' : 'Sessions.'}
        </h1>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-6 md:px-12 pb-40">

        {/* ========== 总榜 ========== */}
        {activeTab === 'total' && (
          <div className="flex flex-col border-t border-[#333]">
             {overallRanking.length === 0 ? (
               <div className="py-20 text-[#888] font-mono text-sm uppercase tracking-widest text-center">
                 No Data Found.
               </div>
             ) : (
                overallRanking.map((player, index) => {
                  const profitStr = (player.score || 0).toFixed(1).replace(/\.0$/, '');
                  const isWin = (player.score || 0) > 0;
                  const isTop = index < 3;
                  const key = player.name.toLowerCase();
                  const sig = profiles[key]?.signature;
                  const rankChange = getRankChangeInfo(player.name, index);
                  
                  return (
                    <div
                      key={index}
                      className={`group flex items-center justify-between py-6 md:py-8 border-b border-[#222] hover:bg-[#1a1a1a] transition-colors duration-300 animate-in fade-in slide-in-from-bottom-4`}
                      style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'both' }}
                    >
                      <div className="flex items-center gap-6 md:gap-12 flex-1 min-w-0">
                        <div className="flex flex-col items-center justify-center w-6 md:w-8 shrink-0 relative">
                          <span className="text-sm md:text-base font-mono text-[#555]">
                            {(index + 1).toString().padStart(2, '0')}
                          </span>
                          {rankChange && rankChange.type !== 'flat' && (
                             <div className={`absolute -bottom-4 text-[10px] font-bold font-mono tracking-tighter flex items-center ${rankChange.type === 'up' ? 'text-green-500' : rankChange.type === 'down' ? 'text-red-500' : 'text-blue-400'}`}>
                               {rankChange.type === 'up' && <><ArrowUpRight className="w-3 h-3"/>{rankChange.diff}</>}
                               {rankChange.type === 'down' && <><ArrowDownRight className="w-3 h-3"/>{rankChange.diff}</>}
                               {rankChange.type === 'new' && <span className="opacity-80">NEW</span>}
                             </div>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0 pr-4">
                          <div className="flex items-center gap-3">
                            <span className={`text-2xl md:text-4xl tracking-tight truncate ${isTop ? 'font-medium text-[#f5f5f5]' : 'font-light text-[#888] group-hover:text-[#eee] transition-colors'}`}>
                              {player.name}
                            </span>
                            <button onClick={() => openProfileDialog(player.name)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-[#555] hover:text-[#eee] rounded-full hover:bg-white/10 shrink-0">
                              <PencilLine className="w-4 h-4"/>
                            </button>
                          </div>
                          {sig && (
                            <span className="text-xs md:text-sm text-[#666] font-mono mt-1 pr-2 truncate max-w-[200px] md:max-w-md">
                              "{sig}"
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`font-mono text-2xl md:text-5xl tabular-nums tracking-tighter shrink-0 ${isWin ? 'text-[#f5f5f5]' : 'text-[#666]'}`}>
                        {isWin ? '+' : ''}{profitStr}
                      </div>
                    </div>
                  );
                })
             )}
          </div>
        )}

        {/* ========== 每日对局记录 ========== */}
        {activeTab === 'history' && (
          <div className="flex flex-col border-t border-[#333] space-y-6 pt-6">
             {matches.length === 0 ? (
               <div className="py-20 text-[#888] font-mono text-sm uppercase tracking-widest text-center">
                 No Sessions Recorded.
               </div>
             ) : (
               matches.map((m, m_idx) => {
                 const matchTotal = m.records.reduce((a,c)=>a+c.score,0);
                 const validBalance = Math.abs(matchTotal) < 0.01;

                 return (
                   <div 
                     key={m.id} 
                     className="bg-[#181818] border border-[#222] rounded-3xl p-6 md:p-8 hover:border-[#444] transition-colors group animate-in fade-in slide-in-from-bottom-4"
                     style={{ animationDelay: `${m_idx * 40}ms`, animationFillMode: 'both' }}
                   >
                     <div className="flex items-start justify-between border-b border-[#222] pb-6 mb-6">
                       <div>
                         <h3 className="text-2xl tracking-tight font-medium text-[#eee]">
                           {m.title || 'Game Session'}
                           {!validBalance && m.id !== 'legacy-data' && (
                             <span className="ml-3 text-[10px] uppercase font-mono tracking-widest bg-red-950/40 text-red-400 px-2 py-1 rounded-full border border-red-900/50 align-middle">
                               Unbalanced
                             </span>
                           )}
                         </h3>
                         <p className="text-[#888] font-mono text-xs mt-2 uppercase tracking-wider">
                           {m.date}
                         </p>
                       </div>
                       <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                           onClick={() => openEditMatchDialog(m)}
                           className="p-2 text-[#888] hover:text-white hover:bg-[#333] rounded-full transition-all"
                         >
                           <ChevronRight className="w-5 h-5"/>
                         </button>
                         <button 
                           onClick={() => deleteMatch(m.id)}
                           className="p-2 text-[#888] hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all"
                         >
                           <Trash2 className="w-4 h-4"/>
                         </button>
                       </div>
                     </div>
                     
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                        {m.records.map((r, idx) => (
                           <div key={idx} className="flex justify-between items-center group/item">
                             <div className="flex items-center gap-2">
                               <span className="text-[#555] font-mono text-xs">{(idx+1).toString().padStart(2,'0')}</span>
                               <span className="text-[#ccc] group-hover/item:text-white transition-colors">{r.name}</span>
                             </div>
                             <span className={`font-mono tabular-nums text-sm ${r.score >= 0 ? 'text-[#f5f5f5]' : 'text-[#666]'}`}>
                               {r.score > 0 ? '+' : ''}{(r.score || 0).toFixed(1).replace(/\.0$/, '')}
                             </span>
                           </div>
                        ))}
                     </div>
                   </div>
                 );
               })
             )}
          </div>
        )}
      </main>

      {/* 底部悬浮交互池 */}
      <div className="fixed bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#111] to-transparent pointer-events-none flex items-end justify-center pb-8 z-50">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
             <div className="flex flex-col items-center gap-2 cursor-pointer pointer-events-auto group">
               <button 
                 onClick={openNewMatchDialog}
                 className="text-[10px] md:text-xs font-mono uppercase tracking-[0.2em] text-[#999] group-hover:text-[#f5f5f5] transition-colors border-b border-[#333] group-hover:border-[#ededed] pb-1"
               >
                 Add Session Log
               </button>
             </div>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-2xl bg-[#111] border border-[#222] text-[#f5f5f5] shadow-2xl rounded-2xl p-8 max-h-[90vh] overflow-y-auto">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-3xl font-medium tracking-tight">
                {editingParams.id ? 'Edit Session' : 'New Session'}
              </DialogTitle>
              <div className="text-sm text-[#888] font-light mt-1">
                Enter game details and player performance.
              </div>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 pb-6 border-b border-[#222]">
               <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-[#666] mb-2 block">Session Title</label>
                  <Input 
                    value={editingParams.title}
                    onChange={e => setEditingParams({...editingParams, title: e.target.value})}
                    placeholder="Friday Night Poker"
                    className="bg-[#181818] border-[#333] h-12 text-[#eee] focus-visible:ring-0 focus-visible:border-white transition-colors"
                  />
               </div>
               <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-[#666] mb-2 block">Date</label>
                  <Input
                    type="date"
                    value={editingParams.date}
                    onChange={e => setEditingParams({...editingParams, date: e.target.value})}
                    className="bg-[#181818] border-[#333] h-12 text-[#eee] text-[15px] focus-visible:ring-0 focus-visible:border-white transition-colors"
                  />
               </div>
            </div>
            
            <div className="py-4 space-y-2">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#666]">Player Balance</span>
                <span className={`text-xs font-mono tabular-nums ${Math.abs(editingRecords.reduce((a,c) => a + (Number(c.score)||0), 0)) > 0.01 ? 'text-red-400' : 'text-green-400'}`}>
                  Sum: {(editingRecords.reduce((a,c) => a + (Number(c.score)||0), 0)).toFixed(1).replace(/\.0$/, '')}
                </span>
              </div>
              
              {editingRecords.map((r, idx) => (
                <div key={r.id} className="flex gap-4 items-center group">
                  <span className="text-[#555] font-mono text-xs w-6 text-right">
                    {(idx + 1).toString().padStart(2, '0')}
                  </span>
                  <Input 
                    value={r.name} 
                    onChange={(e) => setEditingRecords(prev => prev.map(p => p.id === r.id ? { ...p, name: e.target.value } : p))} 
                    placeholder="Name" 
                    className="flex-1 bg-[#181818] border-none shadow-none text-lg tracking-tight rounded-none border-b border-[#222] focus-visible:ring-0 focus-visible:border-[#ededed] transition-colors px-4 h-12 text-[#f5f5f5]"
                  />
                  <Input 
                    value={r.score} 
                    type="number"
                    step="0.1"
                    onChange={(e) => setEditingRecords(prev => prev.map(p => p.id === r.id ? { ...p, score: e.target.value } : p))} 
                    placeholder="Score" 
                    className="w-32 bg-[#181818] border-none shadow-none text-lg tabular-nums rounded-none border-b border-[#222] focus-visible:ring-0 focus-visible:border-[#ededed] transition-colors px-4 h-12 text-right font-mono text-[#f5f5f5]"
                  />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setEditingRecords(prev => prev.filter(p => p.id !== r.id))}
                    className="text-[#555] hover:text-[#f5f5f5] hover:bg-white/10 rounded-full shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              
              <Button 
                variant="ghost" 
                onClick={() => {
                  setEditingRecords(prev => [...prev, { id: recordIdCounter, name: '', score: '' }]);
                  setRecordIdCounter(recordIdCounter + 1);
                }}
                className="w-full mt-6 text-[#888] hover:text-[#ededed] hover:bg-[#181818] font-light tracking-wide rounded-xl py-6"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Row
              </Button>
              
              {errorText && (
                <div className="mt-4 text-red-500 text-sm font-medium animate-in fade-in">
                  {errorText}
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-6 pt-6 border-t border-[#222]">
              <button 
                onClick={() => setIsOpen(false)} 
                className="text-sm font-medium tracking-wide text-[#888] hover:text-[#ededed] transition-colors disabled:opacity-50"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveMatch} 
                disabled={isSaving} 
                className="text-sm font-medium tracking-wide bg-[#ededed] text-[#111] px-8 py-3 rounded-full hover:bg-[#ffffff] hover:scale-105 transition-all shadow-xl shadow-black/50 disabled:opacity-50 disabled:hover:scale-100"
              >
                {isSaving ? 'Saving...' : 'Apply Session'}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Profile Dialog */}
        <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
           <DialogContent className="sm:max-w-md bg-[#111] border border-[#222] text-[#f5f5f5] shadow-2xl rounded-2xl p-8">
              <DialogHeader className="mb-6">
                <DialogTitle className="text-2xl font-medium tracking-tight">Edit Profile</DialogTitle>
                <div className="text-sm text-[#888] font-light mt-1">Set signature for {editingProfileName}</div>
              </DialogHeader>
              <div className="space-y-4">
                 <div>
                    <label className="text-[10px] font-mono uppercase tracking-widest text-[#666] mb-2 block">Signature</label>
                    <Input 
                      value={editingSignature}
                      onChange={e => setEditingSignature(e.target.value)}
                      placeholder="e.g. All in or fold"
                      className="bg-[#181818] border-[#333] h-12 text-[#eee] focus-visible:ring-0 focus-visible:border-white transition-colors"
                      maxLength={100}
                    />
                 </div>
              </div>
              <div className="flex justify-end gap-6 mt-8 pt-6 border-t border-[#222]">
                <button onClick={() => setIsProfileOpen(false)} className="text-sm font-medium tracking-wide text-[#888] hover:text-[#ededed] transition-colors" disabled={isSaving}>Cancel</button>
                <button onClick={handleSaveProfile} disabled={isSaving} className="text-sm font-medium tracking-wide bg-[#ededed] text-[#111] px-6 py-2.5 rounded-full hover:bg-[#ffffff] hover:scale-105 transition-all shadow-xl shadow-black/50 disabled:opacity-50">Save</button>
              </div>
           </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
