const fs = require('fs');
const file = 'src/components/PureRanking.tsx';
let content = fs.readFileSync(file, 'utf8');

const startMarker = '  return (\n    <div className="relative min-h-screen';
const endMarker = '          )}\n\n        {/* 底部列表按钮区 */}';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.log('MARKERS NOT FOUND');
  process.exit(1);
}

const newUI = `  return (
    <div className="relative min-h-screen w-full bg-[#0a0a0a] flex flex-col items-center py-12 px-4 md:px-8 overflow-hidden font-sans text-slate-200">
      {/* 高端赛事质感暗调背景 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800/20 via-[#0a0a0a] to-[#0a0a0a] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[300px] bg-gradient-to-b from-yellow-600/10 via-yellow-700/5 to-transparent pointer-events-none blur-3xl rounded-full" />
      
      {/* 扫光动画线 */}
      <div className="absolute top-0 w-full h-[1px] bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent opacity-50" />

      <div className="w-full max-w-4xl z-10 flex flex-col h-full">
        {/* 赛事级别的霸气 Header */}
        <div className="mb-12 text-center space-y-2 relative">
          <p className="text-yellow-600/90 font-bold tracking-[0.3em] text-xs md:text-sm uppercase inline-block border-b border-yellow-600/30 pb-2 mb-2">
            King Poker Championship
          </p>
          <h1 className="text-5xl md:text-7xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-400 uppercase drop-shadow-lg" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.05)' }}>
            KPC 417
          </h1>
          <h2 className="text-lg md:text-xl font-light tracking-[0.25em] text-slate-500 uppercase mt-2">
            Official Leaderboard
          </h2>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-500"></div>
          </div>
        ) : (
          <div className="flex-1 bg-black/40 backdrop-blur-xl border border-white/5 rounded-xl shadow-2xl overflow-hidden pb-2 ring-1 ring-white/5">
            {/* 严谨的专业表头 */}
            <div className="flex items-center px-6 py-3 border-b border-white/10 bg-white/5 text-[10px] md:text-xs font-black text-slate-400 tracking-[0.2em] uppercase">
              <div className="w-16 md:w-24 text-center">Rank</div>
              <div className="flex-1 pl-4">Player / ID</div>
              <div className="w-32 md:w-48 text-right pr-4">Total Score</div>
            </div>
            
            {/* 列表流 */}
            <div className="flex-1 divide-y divide-white/5">
              {sortedData.map((player, index) => {
                const isFirst = index === 0;
                const isSecond = index === 1;
                const isThird = index === 2;
                
                // 行级背景与左侧彩带
                const rowClasses = 
                  isFirst ? 'bg-gradient-to-r from-yellow-500/10 via-yellow-500/5 to-transparent border-l-4 border-yellow-500' :
                  isSecond ? 'bg-gradient-to-r from-slate-300/10 via-slate-300/5 to-transparent border-l-4 border-slate-300' :
                  isThird ? 'bg-gradient-to-r from-amber-700/10 via-amber-700/5 to-transparent border-l-4 border-amber-700' :
                  'border-l-4 border-transparent hover:bg-white/[0.02]';

                // 排名字体
                const rankTextDisplay = 
                  isFirst ? <span className="text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]">1</span> :
                  isSecond ? <span className="text-slate-300 drop-shadow-[0_0_8px_rgba(203,213,225,0.4)]">2</span> :
                  isThird ? <span className="text-amber-600 drop-shadow-[0_0_8px_rgba(217,119,6,0.4)]">3</span> :
                  <span className="text-slate-600 font-light">{index + 1}</span>;

                return (
                  <div
                    key={index}
                    className={\`flex items-center px-6 py-4 transition-colors \${rowClasses} animate-in fade-in slide-in-from-bottom-2\`}
                    style={{ animationDelay: \`\${index * 40}ms\`, animationFillMode: 'both' }}
                  >
                    {/* Rank */}
                    <div className="w-16 md:w-24 text-center font-black text-2xl md:text-3xl italic font-mono">
                      {rankTextDisplay}
                    </div>
                    
                    {/* Player */}
                    <div className="flex-1 pl-4 flex items-center gap-3 border-l border-white/5 h-10">
                      <div className="flex flex-col justify-center">
                        <span className={\`font-semibold text-lg md:text-xl tracking-wide \${isFirst || isSecond || isThird ? 'text-white' : 'text-slate-300'}\`}>
                          {player.name}
                        </span>
                      </div>
                    </div>

                    {/* Score */}
                    <div className="w-32 md:w-48 text-right pr-4">
                      <span className={\`font-mono text-xl md:text-2xl font-bold tabular-nums tracking-tight \${
                        (player.score || 0) >= 0 ? 'text-emerald-400' : 'text-rose-500'
                      }\`}>
                        {(player.score || 0) > 0 ? '+' : ''}{(player.score || 0).toFixed(1).replace(/\\.0$/, '')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
`;

content = content.substring(0, startIndex) + newUI + "\n        )}\n\n        {/* 底部列表按钮区 */}" + content.substring(endIndex + endMarker.length);
fs.writeFileSync(file, content, 'utf8');
console.log('UI Updated cleanly!');
