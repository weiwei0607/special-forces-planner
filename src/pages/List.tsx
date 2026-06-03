import { useState, useEffect } from 'react';
import { db, type Itinerary, type Spot, generateId } from '../db';
import { MapPin, Plus, Calendar, Users, Zap, ChevronRight, Trash2, Share2, FolderOpen, ChevronDown, Sparkles, Loader2, Key } from 'lucide-react';
import { generateItinerary, getGroqKey, saveGroqKey } from '../utils/groq';

interface Props {
  onNew: () => void;
  onOpen: (id: string) => void;
  onPreview: (id: string) => void;
}

export const List: React.FC<Props> = ({ onNew, onOpen, onPreview }) => {
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // AI Modal state
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiDestination, setAiDestination] = useState('');
  const [aiDays, setAiDays] = useState(3);
  const [aiBudget, setAiBudget] = useState<'free' | 'mid' | 'any'>('mid');
  const [aiStyle, setAiStyle] = useState<'hard' | 'medium'>('hard');
  const [aiApiKey, setAiApiKey] = useState(getGroqKey());
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const all = await db.itineraries.orderBy('updatedAt').reverse().toArray();
    setItineraries(all);
  }

  async function deleteIt(id: string) {
    if (!confirm('確定刪除這個行程？')) return;
    await db.itineraries.delete(id);
    await load();
  }

  const shareIt = (it: Itinerary) => {
    const json = JSON.stringify(it);
    const hash = btoa(encodeURIComponent(json));
    const url = `${window.location.origin}${window.location.pathname}#share=${hash}`;
    navigator.clipboard.writeText(url).then(() => alert('行程連結已複製！'));
  };

  async function handleAIGenerate() {
    if (!aiDestination.trim()) {
      setAiError('請輸入目的地');
      return;
    }
    if (!aiApiKey.trim()) {
      setAiError('請輸入 Groq API Key');
      return;
    }
    setAiError('');
    setAiLoading(true);
    saveGroqKey(aiApiKey);

    try {
      const days = await generateItinerary({
        destination: aiDestination.trim(),
        days: aiDays,
        budget: aiBudget,
        style: aiStyle,
        apiKey: aiApiKey.trim(),
      });

      const groupName = `${aiDestination.trim()}${aiDays}天`;
      const baseDate = new Date();
      const createdIds: string[] = [];

      for (const d of days) {
        const spotRecords: Spot[] = d.spots.map(s => ({
          id: generateId(),
          name: s.name,
          lat: 0,
          lng: 0,
          openTime: s.open,
          closeTime: s.close,
          durationMin: s.duration,
          price: s.price,
          tags: [],
          notes: [s.arrive ? `抵達：${s.arrive}` : '', s.tip, s.transit].filter(Boolean).join(' | '),
        }));

        const totalBudget = spotRecords.reduce((sum, s) => sum + s.price, 0);
        const itDate = new Date(baseDate);
        itDate.setDate(baseDate.getDate() + (d.day - 1));

        const it: Itinerary = {
          id: generateId(),
          title: `${aiDestination.trim()} 第${d.day}天${d.area ? `｜${d.area}` : ''}`,
          city: aiDestination.trim(),
          date: itDate.toISOString().slice(0, 10),
          startTime: '09:00',
          endTime: '21:00',
          spots: spotRecords,
          plan: [],
          travelers: 1,
          intensity: aiStyle === 'hard' ? 'hard' : 'medium',
          totalBudget,
          transportMode: 'transit',
          groupName,
          dayIndex: d.day,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await db.itineraries.add(it);
        createdIds.push(it.id);
      }

      setShowAIModal(false);
      setAiDestination('');
      setAiDays(3);
      await load();

      if (createdIds.length === 1) {
        onOpen(createdIds[0]);
      } else {
        // Expand the new group
        setExpandedGroups(prev => new Set(prev).add(groupName));
      }
    } catch (e: any) {
      setAiError(e.message || '生成失敗，請重試');
    } finally {
      setAiLoading(false);
    }
  }

  // Group itineraries
  const grouped = new Map<string, Itinerary[]>();
  const ungrouped: Itinerary[] = [];

  for (const it of itineraries) {
    if (it.groupName) {
      const arr = grouped.get(it.groupName) || [];
      arr.push(it);
      grouped.set(it.groupName, arr);
    } else {
      ungrouped.push(it);
    }
  }

  // Sort groups by latest updated itinerary
  const sortedGroups = Array.from(grouped.entries()).sort((a, b) => {
    const maxA = Math.max(...a[1].map(i => i.updatedAt));
    const maxB = Math.max(...b[1].map(i => i.updatedAt));
    return maxB - maxA;
  });

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="min-h-screen p-6">
      <header className="max-w-2xl mx-auto mb-8">
        <h1 className="text-3xl font-black tracking-tighter text-brand-light mb-2">特種兵行程規劃</h1>
        <p className="text-zinc-500 text-sm">在有限時間內最大化旅遊體驗</p>
      </header>

      <main className="max-w-2xl mx-auto space-y-4">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-zinc-800 text-zinc-500 hover:border-brand-light hover:text-brand-light transition-all"
        >
          <Plus className="w-5 h-5" />
          <span className="font-bold">新增行程</span>
        </button>

        <button
          onClick={() => { setShowAIModal(true); setAiError(''); setAiApiKey(getGroqKey()); }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-brand-light/10 text-brand-light hover:bg-brand-light/20 transition-all"
        >
          <Sparkles className="w-5 h-5" />
          <span className="font-bold">AI 幫我排</span>
        </button>

        {itineraries.length === 0 && (
          <div className="text-center py-20 text-zinc-600">
            <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">還沒有行程</p>
            <p className="text-xs mt-1">點擊上方新增你的第一個特種兵之旅</p>
          </div>
        )}

        {/* Grouped trips (multi-day) */}
        {sortedGroups.map(([groupName, items]) => {
          const isExpanded = expandedGroups.has(groupName);
          const sortedItems = [...items].sort((a, b) => (a.dayIndex ?? 0) - (b.dayIndex ?? 0));
          const cities = [...new Set(items.map(i => i.city).filter(Boolean))].join('、');
          return (
            <div key={groupName} className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
              <button
                onClick={() => toggleGroup(groupName)}
                className="w-full p-5 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-light/10 flex items-center justify-center">
                    <FolderOpen className="w-5 h-5 text-brand-light" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-zinc-100">{groupName}</h3>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-zinc-500">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {cities || '未設定城市'}</span>
                      <span>{sortedItems.length} 天</span>
                    </div>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 space-y-2">
                  {sortedItems.map(it => (
                    <div key={it.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 border border-zinc-800">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 text-xs font-bold">
                        {it.dayIndex ?? 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-zinc-200 truncate">{it.title}</p>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                          <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" /> {it.date}</span>
                          <span>{it.spots.length} 個景點</span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => onOpen(it.id)} className="px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-xs font-bold hover:bg-zinc-700 transition-colors">編輯</button>
                        <button onClick={() => onPreview(it.id)} className="px-2.5 py-1.5 rounded-lg bg-brand-light/10 text-brand-light text-xs font-bold hover:bg-brand-light/20 transition-colors">預覽</button>
                        <button onClick={() => shareIt(it)} className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300"><Share2 className="w-3 h-3" /></button>
                        <button onClick={() => deleteIt(it.id)} className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Ungrouped trips (single day) */}
        {ungrouped.length > 0 && (
          <div className="space-y-3">
            {sortedGroups.length > 0 && (
              <h3 className="text-xs font-bold text-zinc-600 uppercase tracking-wider px-1">單日行程</h3>
            )}
            {ungrouped.map(it => (
              <div key={it.id} className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden group">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-zinc-100">{it.title}</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {it.city}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {it.date}</span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                      it.intensity === 'light' ? 'bg-green-500/10 text-green-400'
                      : it.intensity === 'medium' ? 'bg-orange-500/10 text-orange-400'
                      : 'bg-red-500/10 text-red-400'
                    }`}>
                      {it.intensity === 'light' ? '輕度' : it.intensity === 'medium' ? '中度' : '重度'}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-zinc-500 mb-4">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {it.travelers} 人</span>
                    <span>{it.spots.length} 個景點</span>
                    <span>預算 ${it.totalBudget}</span>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => onOpen(it.id)} className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 transition-colors flex items-center justify-center gap-1.5">
                      編輯
                    </button>
                    <button onClick={() => onPreview(it.id)} className="flex-1 py-2.5 rounded-xl bg-brand-light/10 text-brand-light text-xs font-bold hover:bg-brand-light/20 transition-colors flex items-center justify-center gap-1.5">
                      預覽行程 <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => shareIt(it)} className="px-3 py-2.5 rounded-xl bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteIt(it.id)} className="px-3 py-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* AI Modal */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-brand-light" />
                  <h2 className="text-xl font-bold text-zinc-100">AI 幫我排行程</h2>
                </div>
                <button
                  onClick={() => setShowAIModal(false)}
                  className="text-zinc-500 hover:text-zinc-300 text-lg leading-none"
                >
                  ✕
                </button>
              </div>

              {/* Destination */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">目的地</label>
                <input
                  type="text"
                  value={aiDestination}
                  onChange={e => setAiDestination(e.target.value)}
                  placeholder="例如：東京、大阪、台北"
                  className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-brand-light transition-colors"
                />
              </div>

              {/* Days */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">天數</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={14}
                    value={aiDays}
                    onChange={e => setAiDays(Number(e.target.value))}
                    className="flex-1 accent-brand-light"
                  />
                  <span className="w-12 text-center font-bold text-brand-light">{aiDays} 天</span>
                </div>
              </div>

              {/* Budget */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">預算</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'free', label: '省錢' },
                    { key: 'mid', label: '正常' },
                    { key: 'any', label: '不限' },
                  ].map(b => (
                    <button
                      key={b.key}
                      onClick={() => setAiBudget(b.key as typeof aiBudget)}
                      className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                        aiBudget === b.key
                          ? 'bg-brand-light text-zinc-900'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Style */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">風格</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setAiStyle('hard')}
                    className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                      aiStyle === 'hard'
                        ? 'bg-red-500 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    特種兵 🔥
                  </button>
                  <button
                    onClick={() => setAiStyle('medium')}
                    className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                      aiStyle === 'medium'
                        ? 'bg-green-500 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    輕鬆 😌
                  </button>
                </div>
              </div>

              {/* API Key */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                  <Key className="w-3 h-3" /> Groq API Key
                </label>
                <input
                  type="password"
                  value={aiApiKey}
                  onChange={e => setAiApiKey(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-brand-light transition-colors text-sm"
                />
                <p className="text-[11px] text-zinc-600">
                  金鑰會存在你的瀏覽器裡，不會上傳到伺服器。
                  <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-brand-light hover:underline">取得金鑰 →</a>
                </p>
              </div>

              {aiError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {aiError}
                </div>
              )}

              <button
                onClick={handleAIGenerate}
                disabled={aiLoading}
                className="w-full py-3.5 rounded-xl bg-brand-light text-zinc-900 font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    AI 排程中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    生成行程
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
