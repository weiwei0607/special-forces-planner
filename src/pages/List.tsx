import { useState, useEffect } from 'react';
import { db, type Itinerary, type Spot, generateId } from '../db';
import { MapPin, Plus, Calendar, Users, Zap, ChevronRight, Trash2, Share2, FolderOpen, ChevronDown, Sparkles, Loader2, Key, X } from 'lucide-react';
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

  useEffect(() => { load(); }, []);

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
    if (!aiDestination.trim()) { setAiError('請輸入目的地'); return; }
    if (!aiApiKey.trim()) { setAiError('請輸入 Groq API Key'); return; }
    setAiError('');
    setAiLoading(true);
    saveGroqKey(aiApiKey);
    try {
      const days = await generateItinerary({
        destination: aiDestination.trim(), days: aiDays,
        budget: aiBudget, style: aiStyle, apiKey: aiApiKey.trim(),
      });
      const groupName = `${aiDestination.trim()}${aiDays}天`;
      const baseDate = new Date();
      const createdIds: string[] = [];
      for (const d of days) {
        const spotRecords: Spot[] = d.spots.map(s => ({
          id: generateId(), name: s.name, lat: 0, lng: 0,
          openTime: s.open, closeTime: s.close, durationMin: s.duration, price: s.price,
          tags: [], notes: [s.arrive ? `抵達：${s.arrive}` : '', s.tip, s.transit].filter(Boolean).join(' | '),
        }));
        const totalBudget = spotRecords.reduce((sum, s) => sum + s.price, 0);
        const itDate = new Date(baseDate);
        itDate.setDate(baseDate.getDate() + (d.day - 1));
        const it: Itinerary = {
          id: generateId(), title: `${aiDestination.trim()} 第${d.day}天${d.area ? `｜${d.area}` : ''}`,
          city: aiDestination.trim(), date: itDate.toISOString().slice(0, 10),
          startTime: '09:00', endTime: '21:00', spots: spotRecords, plan: [],
          travelers: 1, intensity: aiStyle === 'hard' ? 'hard' : 'medium',
          totalBudget, transportMode: 'transit', groupName, dayIndex: d.day,
          createdAt: Date.now(), updatedAt: Date.now(),
        };
        await db.itineraries.add(it);
        createdIds.push(it.id);
      }
      setShowAIModal(false);
      setAiDestination('');
      setAiDays(3);
      await load();
      if (createdIds.length === 1) onOpen(createdIds[0]);
      else setExpandedGroups(prev => new Set(prev).add(groupName));
    } catch (e: any) {
      setAiError(e.message || '生成失敗，請重試');
    } finally {
      setAiLoading(false);
    }
  }

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
  const sortedGroups = Array.from(grouped.entries()).sort((a, b) => {
    const maxA = Math.max(...a[1].map(i => i.updatedAt));
    const maxB = Math.max(...b[1].map(i => i.updatedAt));
    return maxB - maxA;
  });
  const toggleGroup = (name: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const intensityLabel = (i: string) =>
    i === 'light' ? { text: '輕度', bg: 'rgba(34,197,94,0.10)', color: '#4ADE80', border: 'rgba(34,197,94,0.20)' }
    : i === 'medium' ? { text: '中度', bg: 'rgba(245,158,11,0.10)', color: 'var(--op-amber)', border: 'rgba(245,158,11,0.22)' }
    : { text: '特種', bg: 'rgba(239,68,68,0.10)', color: '#F87171', border: 'rgba(239,68,68,0.22)' };

  return (
    <div className="min-h-screen p-5" style={{ background: 'var(--op-bg)' }}>

      {/* ── Header ── */}
      <header className="max-w-2xl mx-auto mb-8 pt-4">
        <div className="flex items-center gap-3 mb-3">
          <div style={{ height: '1px', flex: 1, background: 'linear-gradient(90deg, rgba(245,158,11,0.35), transparent)' }} />
          <span className="font-mono-tactical" style={{ fontSize: '9px', letterSpacing: '0.28em', color: 'var(--op-text-3)', textTransform: 'uppercase' }}>Mission Briefing</span>
          <div style={{ height: '1px', flex: 1, background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.35))' }} />
        </div>
        <h1 className="font-mono-tactical" style={{ fontSize: 'clamp(1.6rem,6vw,2.4rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--op-amber)', lineHeight: 1 }}>
          特種兵行程規劃
        </h1>
        <p style={{ fontSize: '11px', marginTop: 6, color: 'var(--op-text-3)', letterSpacing: '0.08em' }}>
          在有限時間內最大化旅遊體驗 · MAXIMIZE EXPERIENCE
        </p>
      </header>

      <main className="max-w-2xl mx-auto space-y-3">

        {/* ── Action buttons ── */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button onClick={onNew} className="btn-op-ghost flex items-center justify-center gap-2 py-4 rounded-2xl transition-all active:scale-95">
            <Plus className="w-4 h-4" />
            <span style={{ fontSize: '13px', fontWeight: 700 }}>新增行程</span>
          </button>
          <button onClick={() => { setShowAIModal(true); setAiError(''); setAiApiKey(getGroqKey()); }}
            className="btn-mission flex items-center justify-center gap-2 py-4 rounded-2xl">
            <Sparkles className="w-4 h-4" />
            <span>AI 幫我排</span>
          </button>
        </div>

        {/* ── Empty state ── */}
        {itineraries.length === 0 && (
          <div className="text-center py-20">
            <div className="mx-auto mb-4 w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--op-amber-dim)', border: '1px solid var(--op-border)' }}>
              <Zap className="w-7 h-7" style={{ color: 'var(--op-amber)', opacity: 0.7 }} />
            </div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--op-text-2)' }}>還沒有行程</p>
            <p style={{ fontSize: '11px', marginTop: 4, color: 'var(--op-text-3)' }}>點擊上方新增你的第一個特種兵之旅</p>
          </div>
        )}

        {/* ── Grouped trips ── */}
        {sortedGroups.map(([groupName, items]) => {
          const isExpanded = expandedGroups.has(groupName);
          const sortedItems = [...items].sort((a, b) => (a.dayIndex ?? 0) - (b.dayIndex ?? 0));
          const cities = [...new Set(items.map(i => i.city).filter(Boolean))].join('、');
          return (
            <div key={groupName} className="op-card rounded-2xl overflow-hidden">
              <button onClick={() => toggleGroup(groupName)} className="w-full p-4 flex items-center justify-between text-left transition-all"
                style={{ background: isExpanded ? 'var(--op-surface-2)' : 'transparent' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'var(--op-amber-dim)', border: '1px solid var(--op-border-2)' }}>
                    <FolderOpen className="w-5 h-5" style={{ color: 'var(--op-amber)' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--op-text-1)' }}>{groupName}</h3>
                    <div className="flex items-center gap-3 mt-0.5" style={{ fontSize: '11px', color: 'var(--op-text-3)' }}>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{cities || '未設定'}</span>
                      <span>{sortedItems.length} 天</span>
                    </div>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  style={{ color: 'var(--op-text-3)' }} />
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-2">
                  {sortedItems.map(it => (
                    <div key={it.id} className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: 'var(--op-bg)', border: '1px solid var(--op-border)' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-mono-tactical"
                        style={{ background: 'var(--op-amber-dim)', border: '1px solid var(--op-border-2)', fontSize: '12px', fontWeight: 800, color: 'var(--op-amber)', flexShrink: 0 }}>
                        {it.dayIndex ?? 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--op-text-1)' }} className="truncate">{it.title}</p>
                        <div className="flex items-center gap-2 mt-0.5" style={{ fontSize: '10px', color: 'var(--op-text-3)' }}>
                          <span className="flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" />{it.date}</span>
                          <span>{it.spots.length} 景點</span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => onOpen(it.id)} className="btn-op-ghost px-2.5 py-1.5 rounded-lg" style={{ fontSize: '11px' }}>編輯</button>
                        <button onClick={() => onPreview(it.id)} className="btn-mission px-2.5 py-1.5 rounded-lg" style={{ fontSize: '11px' }}>預覽</button>
                        <button onClick={() => shareIt(it)} className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--op-text-3)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--op-amber)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--op-text-3)')}>
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteIt(it.id)} className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--op-text-3)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--op-red)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--op-text-3)')}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* ── Ungrouped (single day) trips ── */}
        {ungrouped.length > 0 && (
          <div className="space-y-3">
            {sortedGroups.length > 0 && (
              <div className="op-divider-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.20em', textTransform: 'uppercase', color: 'var(--op-text-3)' }}>單日行程</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--op-border)' }} />
              </div>
            )}
            {ungrouped.map(it => {
              const il = intensityLabel(it.intensity || 'hard');
              return (
                <div key={it.id} className="mission-card rounded-2xl overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="truncate" style={{ fontSize: '15px', fontWeight: 800, color: 'var(--op-text-1)', letterSpacing: '-0.01em' }}>{it.title}</h3>
                        <div className="flex items-center gap-3 mt-1" style={{ fontSize: '11px', color: 'var(--op-text-3)' }}>
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{it.city}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{it.date}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 6, background: il.bg, color: il.color, border: `1px solid ${il.border}`, flexShrink: 0 }}>
                        {il.text}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mb-4" style={{ fontSize: '11px', color: 'var(--op-text-3)' }}>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{it.travelers} 人</span>
                      <span>{it.spots.length} 個景點</span>
                      <span style={{ color: 'var(--op-amber)' }}>預算 ${it.totalBudget}</span>
                    </div>

                    {/* Priority bar */}
                    <div className="mb-4 op-progress-track" style={{ height: '2px', borderRadius: 2, background: 'var(--op-border)' }}>
                      <div style={{
                        height: '100%', borderRadius: 2,
                        background: it.intensity === 'hard'
                          ? 'linear-gradient(90deg, var(--op-red), rgba(239,68,68,0.3))'
                          : it.intensity === 'medium'
                          ? 'linear-gradient(90deg, var(--op-amber), rgba(245,158,11,0.3))'
                          : 'linear-gradient(90deg, var(--op-green), rgba(34,197,94,0.3))',
                        width: it.intensity === 'hard' ? '90%' : it.intensity === 'medium' ? '60%' : '30%',
                        boxShadow: `0 0 6px ${il.color}66`,
                        transition: 'width 0.3s',
                      }} />
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => onOpen(it.id)} className="btn-op-ghost flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5" style={{ fontSize: '12px' }}>
                        編輯
                      </button>
                      <button onClick={() => onPreview(it.id)} className="btn-mission flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5" style={{ fontSize: '12px' }}>
                        預覽行程 <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => shareIt(it)} className="px-3 py-2.5 rounded-xl transition-all btn-op-ghost">
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteIt(it.id)} className="px-3 py-2.5 rounded-xl transition-all"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: '#F87171' }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── AI Modal ── */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(8px)' }}>
          <div className="op-card rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" style={{ color: 'var(--op-amber)' }} />
                  <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--op-text-1)', letterSpacing: '-0.01em' }}>AI 幫我排行程</h2>
                </div>
                <button onClick={() => setShowAIModal(false)} className="w-7 h-7 flex items-center justify-center rounded-xl transition-all"
                  style={{ background: 'var(--op-surface-2)', border: '1px solid var(--op-border)', color: 'var(--op-text-3)' }}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Destination */}
              <div className="space-y-1.5">
                <label className="font-mono-tactical" style={{ fontSize: '9px', letterSpacing: '0.18em', color: 'var(--op-text-3)', textTransform: 'uppercase', display: 'block' }}>目的地</label>
                <input type="text" value={aiDestination} onChange={e => setAiDestination(e.target.value)}
                  placeholder="例如：東京、大阪、台北" className="op-input w-full px-4 py-3 rounded-xl" />
              </div>

              {/* Days */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-mono-tactical" style={{ fontSize: '9px', letterSpacing: '0.18em', color: 'var(--op-text-3)', textTransform: 'uppercase' }}>天數</label>
                  <span className="font-mono-tactical" style={{ fontSize: '14px', fontWeight: 800, color: 'var(--op-amber)' }}>{aiDays} 天</span>
                </div>
                <input type="range" min={1} max={14} value={aiDays} onChange={e => setAiDays(Number(e.target.value))}
                  className="w-full" style={{ accentColor: 'var(--op-amber)' }} />
              </div>

              {/* Budget */}
              <div className="space-y-2">
                <label className="font-mono-tactical" style={{ fontSize: '9px', letterSpacing: '0.18em', color: 'var(--op-text-3)', textTransform: 'uppercase', display: 'block' }}>預算</label>
                <div className="grid grid-cols-3 gap-2">
                  {[{ key: 'free', label: '省錢' }, { key: 'mid', label: '正常' }, { key: 'any', label: '不限' }].map(b => (
                    <button key={b.key} onClick={() => setAiBudget(b.key as typeof aiBudget)}
                      className="py-2.5 rounded-xl transition-all"
                      style={{
                        fontSize: '12px', fontWeight: 700,
                        background: aiBudget === b.key ? 'var(--op-amber)' : 'var(--op-surface-2)',
                        color: aiBudget === b.key ? '#0A0600' : 'var(--op-text-2)',
                        border: `1px solid ${aiBudget === b.key ? 'var(--op-amber)' : 'var(--op-border)'}`,
                      }}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Style */}
              <div className="space-y-2">
                <label className="font-mono-tactical" style={{ fontSize: '9px', letterSpacing: '0.18em', color: 'var(--op-text-3)', textTransform: 'uppercase', display: 'block' }}>風格</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ key: 'hard', label: '特種兵 🔥', activeColor: 'var(--op-red)', activeBg: 'rgba(239,68,68,0.15)' },
                    { key: 'medium', label: '輕鬆 😌', activeColor: 'var(--op-green)', activeBg: 'rgba(34,197,94,0.12)' }].map(s => (
                    <button key={s.key} onClick={() => setAiStyle(s.key as typeof aiStyle)}
                      className="py-2.5 rounded-xl transition-all"
                      style={{
                        fontSize: '12px', fontWeight: 700,
                        background: aiStyle === s.key ? s.activeBg : 'var(--op-surface-2)',
                        color: aiStyle === s.key ? s.activeColor : 'var(--op-text-2)',
                        border: `1px solid ${aiStyle === s.key ? s.activeColor : 'var(--op-border)'}`,
                        boxShadow: aiStyle === s.key ? `0 0 12px ${s.activeColor}33` : 'none',
                      }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* API Key */}
              <div className="space-y-1.5">
                <label className="font-mono-tactical flex items-center gap-1" style={{ fontSize: '9px', letterSpacing: '0.18em', color: 'var(--op-text-3)', textTransform: 'uppercase' }}>
                  <Key className="w-3 h-3" /> Groq API Key
                </label>
                <input type="password" value={aiApiKey} onChange={e => setAiApiKey(e.target.value)}
                  placeholder="gsk_..." className="op-input w-full px-4 py-3 rounded-xl" style={{ fontFamily: 'monospace', fontSize: '13px' }} />
                <p style={{ fontSize: '10px', color: 'var(--op-text-3)' }}>
                  金鑰存在瀏覽器本機，不會上傳。{' '}
                  <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{ color: 'var(--op-amber)' }}>取得金鑰 →</a>
                </p>
              </div>

              {aiError && (
                <div className="p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', color: '#F87171', fontSize: '12px' }}>
                  {aiError}
                </div>
              )}

              <button onClick={handleAIGenerate} disabled={aiLoading} className="btn-mission w-full py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {aiLoading ? <><Loader2 className="w-4 h-4 animate-spin" />AI 排程中...</>
                  : <><Sparkles className="w-4 h-4" />生成行程</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
