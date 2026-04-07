const fs = require('fs');
const file = 'src/components/PureRanking.tsx';
let content = fs.readFileSync(file, 'utf8');

const startMarker = '  return (';

const startIndex = content.indexOf(startMarker);

if (startIndex === -1) {
  console.log('Start marker missing');
  process.exit(1);
}

const newUI = `  return (
    <div className="min-h-screen w-full bg-[#050505] text-[#fcfcfc] font-sans selection:bg-[#fff] selection:text-black flex flex-col font-light">
      
      {/* 极简顶部区域 */}
      <header className="pt-24 pb-8 md:pt-32 md:pb-16 px-6 md:px-12 w-full max-w-5xl mx-auto flex flex-col gap-2">
        <p className="text-[10px] md:text-xs font-mono uppercase tracking-[0.3em] text-[#666]">
          Official Results
        </p>
        <h1 className="text-6xl md:text-[7rem] font-medium tracking-tighter leading-none">
          Leaderboard.
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
              const profitStr = (player.score || 0).toFixed(1).replace(/\\.0$/, '');
              const isWin = (player.score || 0) > 0;
              const isTop = index < 3;
              
              return (
                <div
                  key={index}
                  className={\`group flex items-baseline justify-between py-6 md:py-8 border-b border-[#1f1f1f] hover:bg-[#0f0f0f] transition-colors duration-300 animate-in fade-in slide-in-from-bottom-4\`}
                  style={{ animationDelay: \`\${index * 30}ms\`, animationFillMode: 'both' }}
                >
                  <div className="flex items-baseline gap-6 md:gap-12">
                    <span className="text-sm md:text-base font-mono text-[#444] w-6 md:w-8 inline-block">
                      {(index + 1).toString().padStart(2, '0')}
                    </span>
                    <span className={\`text-2xl md:text-5xl tracking-tight \${isTop ? 'font-medium text-[#fcfcfc]' : 'font-light text-[#999] group-hover:text-[#eee] transition-colors'}\`}>
                      {player.name}
                    </span>
                  </div>

                  <div className={\`font-mono text-2xl md:text-5xl tabular-nums tracking-tighter \${isWin ? 'text-[#fcfcfc]' : 'text-[#666]'}\`}>
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
            <button className="pointer-events-auto text-[10px] md:text-xs font-mono uppercase tracking-[0.2em] text-[#666] hover:text-[#fcfcfc] transition-colors border-b border-[#333] hover:border-[#fcfcfc] pb-1">
              Edit Data
            </button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-2xl bg-[#111] border border-[#222] text-[#fcfcfc] shadow-2xl rounded-2xl p-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-3xl font-medium tracking-tight">
                Update Data
              </DialogTitle>
              <div className="text-sm text-[#888] font-light mt-1">
                Edit player name and score. Invalid scores default to 0.
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
                    className="flex-1 bg-[#181818] border-none shadow-none text-lg tracking-tight rounded-none border-b border-[#222] focus-visible:ring-0 focus-visible:border-[#eee] transition-colors px-0 h-12 text-[#fcfcfc]"
                  />
                  <Input 
                    value={item.score} 
                    type="number"
                    step="0.1"
                    onChange={(e) => handleEditChange(item.id, 'score', e.target.value)} 
                    placeholder="Score" 
                    className="w-32 bg-[#181818] border-none shadow-none text-lg tabular-nums rounded-none border-b border-[#222] focus-visible:ring-0 focus-visible:border-[#eee] transition-colors px-0 h-12 text-right font-mono text-[#fcfcfc]"
                  />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleRemoveField(item.id)}
                    className="text-[#555] hover:text-white hover:bg-white/10 rounded-full"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              
              <Button 
                variant="ghost" 
                onClick={handleAddField} 
                className="w-full mt-6 text-[#888] hover:text-[#eee] hover:bg-[#181818] font-light tracking-wide rounded-xl py-6"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Player
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
                className="text-sm font-medium tracking-wide text-[#888] hover:text-[#eee] transition-colors disabled:opacity-50"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button 
                onClick={handleSave} 
                disabled={isSaving} 
                className="text-sm font-medium tracking-wide bg-[#eee] text-[#111] px-8 py-3 rounded-full hover:bg-[#fff] hover:scale-105 transition-all shadow-xl shadow-black/50 disabled:opacity-50 disabled:hover:scale-100"
              >
                {isSaving ? 'Saving...' : 'Apply Changes'}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
`;

content = content.substring(0, startIndex) + newUI;

fs.writeFileSync(file, content, 'utf8');
console.log('DARK MODE SUCCESS');
