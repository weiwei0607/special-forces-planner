import { useState, useEffect, useCallback } from 'react';
import { db, type Itinerary, type Spot, generateId } from '../db';
import { buildSchedule, suggestDropOrder } from '../utils/scheduler';
import { ArrowLeft, Plus, Trash2, GripVertical, AlertTriangle, Footprints, Clock, DollarSign, Zap, Clock3 } from 'lucide-react';

interface Props {
  id: string | null;
  onBack: () => void;
  onPreview: (id: string) => void;
}

const emptyItinerary = (): Itinerary => ({
  id: generateId(),
  title: '未命名行程',
  city: '',
  date: new Date().toISOString().slice(0, 10),
  startTime: '09:00',
  endTime: '21:00',
  spots: [],
  plan: [],
  travelers: 1,
  intensity: 'medium',
  totalBudget: 0,
  transportMode: 'transit',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const Editor: React.FC<Props> = ({ id, onBack, onPreview }) => {
  const [it, setIt] = useState<Itinerary>(emptyItinerary);
  const [showSpotForm, setShowSpotForm] = useState(false);
  const [editingSpot, setEditingSpot] = useState<Spot | null>(null);
  const [existingGroups, setExistingGroups] = useState<string[]>([]);

  useEffect(() => {
    if (id) {
      db.itineraries.get(id).then(existing => {
        if (existing) setIt(existing);
      });
    } else {
      setIt(emptyItinerary());
    }
    // Load existing group names
    db.itineraries.toArray().then(all => {
      const groups = [...new Set(all.map(i => i.groupName).filter(Boolean) as string[])];
      setExistingGroups(groups);
    });
  }, [id]);

  const save = useCallback(async (updated: Itinerary) => {
    const next = { ...updated, updatedAt: Date.now() };
    setIt(next);
    await db.itineraries.put(next);
  }, []);

  const updateField = useCallback(<K extends keyof Itinerary>(key: K, value: Itinerary[K]) => {
    setIt(prev => {
      const next = { ...prev, [key]: value, updatedAt: Date.now() };
      db.itineraries.put(next);
      return next;
    });
  }, []);

  const addSpot = useCallback((spot: Spot) => {
    const nextSpots = [...it.spots, spot];
    const next = { ...it, spots: nextSpots, plan: [], updatedAt: Date.now() };
    save(next);
    setShowSpotForm(false);
    setEditingSpot(null);
  }, [it, save]);

  const removeSpot = useCallback((spotId: string) => {
    const nextSpots = it.spots.filter(s => s.id !== spotId);
    const next = { ...it, spots: nextSpots, plan: [], updatedAt: Date.now() };
    save(next);
  }, [it, save]);

  const moveSpot = useCallback((from: number, to: number) => {
    const arr = [...it.spots];
    const [removed] = arr.splice(from, 1);
    arr.splice(to, 0, removed);
    save({ ...it, spots: arr, plan: [] });
  }, [it, save]);

  const optimize = useCallback(() => {
    const result = buildSchedule(it.spots, it.startTime, it.endTime, it.transportMode, it.intensity);
    const next = { ...it, plan: result.plan, totalBudget: result.totalCost, updatedAt: Date.now() };
    save(next);
  }, [it, save]);

  const result = it.plan.length > 0 ? buildSchedule(it.spots, it.startTime, it.endTime, it.transportMode, it.intensity) : null;

  return (
    <div className="min-h-screen p-6">
      <header className="max-w-2xl mx-auto mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">返回列表</span>
        </button>
        <input
          value={it.title}
          onChange={e => updateField('title', e.target.value)}
          className="w-full bg-transparent text-2xl font-black text-zinc-100 placeholder-zinc-700 focus:outline-none"
          placeholder="行程名稱"
        />
      </header>

      <main className="max-w-2xl mx-auto space-y-6">
        {/* Basic Info */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 space-y-4">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">基本資訊</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">城市</label>
              <input value={it.city} onChange={e => updateField('city', e.target.value)} placeholder="例如：東京" className="w-full h-10 px-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-brand-light" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">日期</label>
              <input type="date" value={it.date} onChange={e => updateField('date', e.target.value)} className="w-full h-10 px-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-brand-light" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">開始時間</label>
              <input type="time" value={it.startTime} onChange={e => updateField('startTime', e.target.value)} className="w-full h-10 px-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-brand-light" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">結束時間</label>
              <input type="time" value={it.endTime} onChange={e => updateField('endTime', e.target.value)} className="w-full h-10 px-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-brand-light" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">人數</label>
              <input type="number" min={1} value={it.travelers} onChange={e => updateField('travelers', parseInt(e.target.value) || 1)} className="w-full h-10 px-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-brand-light" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">特種兵等級</label>
              <select value={it.intensity} onChange={e => updateField('intensity', e.target.value as Itinerary['intensity'])} className="w-full h-10 px-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-brand-light">
                <option value="light">輕度（4景點/6hr）</option>
                <option value="medium">中度（7景點/9hr）</option>
                <option value="hard">重度（12景點/14hr）</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">所屬旅程（選填）</label>
              <div className="relative">
                <input
                  list="groups"
                  value={it.groupName || ''}
                  onChange={e => updateField('groupName', e.target.value || undefined)}
                  placeholder="輸入新旅程名稱或選擇現有"
                  className="w-full h-10 px-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-brand-light"
                />
                <datalist id="groups">
                  {existingGroups.map(g => <option key={g} value={g} />)}
                </datalist>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">第幾天</label>
              <input
                type="number"
                min={1}
                value={it.dayIndex || 1}
                onChange={e => updateField('dayIndex', parseInt(e.target.value) || 1)}
                className="w-full h-10 px-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-brand-light"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-zinc-500 mb-1 block">主要交通方式</label>
              <div className="flex gap-2">
                {(['walk', 'transit', 'drive'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => updateField('transportMode', mode)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                      it.transportMode === mode
                        ? 'bg-brand-light text-zinc-900'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {mode === 'walk' ? '步行' : mode === 'transit' ? '大眾運輸' : '開車'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Spots */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">景點清單 ({it.spots.length})</h3>
            <button
              onClick={() => { setEditingSpot(null); setShowSpotForm(true); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-light/10 text-brand-light text-xs font-bold hover:bg-brand-light/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> 新增景點
            </button>
          </div>

          {it.spots.length === 0 && (
            <p className="text-zinc-600 text-sm text-center py-6">還沒有景點，先新增幾個想去的點吧</p>
          )}

          <div className="space-y-2">
            {it.spots.map((spot, idx) => (
              <div key={spot.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 border border-zinc-800">
                <div className="text-zinc-600 text-xs font-mono w-5">{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-200 truncate">{spot.name}</p>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                    <span className="flex items-center gap-0.5"><Clock3 className="w-3 h-3" /> {spot.openTime}-{spot.closeTime}</span>
                    <span>{spot.durationMin}分鐘</span>
                    {spot.price > 0 && <span className="flex items-center gap-0.5"><DollarSign className="w-3 h-3" />${spot.price}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {idx > 0 && (
                    <button onClick={() => moveSpot(idx, idx - 1)} className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-700 transition-colors">
                      <GripVertical className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => { setEditingSpot(spot); setShowSpotForm(true); }} className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-700 transition-colors text-xs font-bold">
                    編輯
                  </button>
                  <button onClick={() => removeSpot(spot.id)} className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {it.spots.length >= 2 && (
            <button
              onClick={optimize}
              className="w-full py-3 rounded-xl bg-brand-light text-zinc-900 font-bold text-sm hover:bg-brand-light/90 transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              一鍵最佳化路線
            </button>
          )}
        </div>

        {/* Warnings & Stats */}
        {result && (
          <div className="space-y-3">
            {result.warnings.length > 0 && (
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-yellow-400 text-xs font-bold uppercase">
                  <AlertTriangle className="w-4 h-4" />
                  規劃建議
                </div>
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-yellow-300/80 text-xs">• {w}</p>
                ))}
              </div>
            )}

            {!result.feasible && result.plan.some(p => p.warning) && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
                <p className="text-red-400 text-xs font-bold mb-2">部分景點可能來不及</p>
                <p className="text-red-300/70 text-xs">建議優先捨棄：{suggestDropOrder(it.spots, result.plan).slice(0, 3).join('、')}</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-3 text-center">
                <Footprints className="w-4 h-4 text-sky-400 mx-auto mb-1" />
                <p className="text-lg font-black text-zinc-100">{result.totalWalkKm.toFixed(1)}</p>
                <p className="text-[10px] text-zinc-500">公里步行</p>
              </div>
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-3 text-center">
                <Clock className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                <p className="text-lg font-black text-zinc-100">{Math.round(result.totalTransitMin)}</p>
                <p className="text-[10px] text-zinc-500">分鐘交通</p>
              </div>
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-3 text-center">
                <DollarSign className="w-4 h-4 text-green-400 mx-auto mb-1" />
                <p className="text-lg font-black text-zinc-100">${result.totalCost}</p>
                <p className="text-[10px] text-zinc-500">總花費</p>
              </div>
            </div>

            <button
              onClick={() => onPreview(it.id)}
              className="w-full py-3.5 rounded-xl bg-zinc-800 text-white font-bold text-sm hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
            >
              預覽完整時間軸
            </button>
          </div>
        )}
      </main>

      {/* Spot Form Modal */}
      {showSpotForm && (
        <SpotFormModal
          initial={editingSpot}
          onSave={addSpot}
          onClose={() => setShowSpotForm(false)}
        />
      )}
    </div>
  );
};

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

function SpotFormModal({ initial, onSave, onClose }: { initial: Spot | null; onSave: (s: Spot) => void; onClose: () => void }) {
  const [name, setName] = useState(initial?.name || '');
  const [lat, setLat] = useState(initial?.lat.toString() || '');
  const [lng, setLng] = useState(initial?.lng.toString() || '');
  const [openTime, setOpenTime] = useState(initial?.openTime || '09:00');
  const [closeTime, setCloseTime] = useState(initial?.closeTime || '18:00');
  const [duration, setDuration] = useState(initial?.durationMin.toString() || '60');
  const [price, setPrice] = useState(initial?.price.toString() || '0');
  const [notes, setNotes] = useState(initial?.notes || '');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Debounce search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5&accept-language=zh-TW`,
          { headers: { 'Accept-Language': 'zh-TW' } }
        );
        const data = await res.json();
        setSearchResults(data || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const applyResult = (r: NominatimResult) => {
    setName(r.display_name.split(',')[0]);
    setLat(r.lat);
    setLng(r.lon);
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: initial?.id || generateId(),
      name: name.trim() || '未命名景點',
      lat: parseFloat(lat) || 0,
      lng: parseFloat(lng) || 0,
      openTime,
      closeTime,
      durationMin: parseInt(duration) || 60,
      price: parseInt(price) || 0,
      tags: [],
      notes,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-zinc-100 mb-4">{initial ? '編輯景點' : '新增景點'}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Search */}
          <div className="relative">
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="🔍 搜尋地點（例如：台北101、淺草寺）"
              className="w-full h-10 px-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-brand-light"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-brand-light border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {searchResults.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden shadow-xl">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyResult(r)}
                    className="w-full text-left px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors border-b border-zinc-700/50 last:border-0"
                  >
                    <p className="truncate">{r.display_name}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <input value={name} onChange={e => setName(e.target.value)} placeholder="景點名稱" className="w-full h-10 px-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-brand-light" />
          <div className="grid grid-cols-2 gap-2">
            <input value={lat} onChange={e => setLat(e.target.value)} placeholder="緯度" className="w-full h-10 px-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-brand-light" />
            <input value={lng} onChange={e => setLng(e.target.value)} placeholder="經度" className="w-full h-10 px-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-brand-light" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-500 mb-1 block">開館時間</label>
              <input type="time" value={openTime} onChange={e => setOpenTime(e.target.value)} className="w-full h-10 px-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-brand-light" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 mb-1 block">閉館時間</label>
              <input type="time" value={closeTime} onChange={e => setCloseTime(e.target.value)} className="w-full h-10 px-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-brand-light" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-500 mb-1 block">預計停留（分鐘）</label>
              <input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="w-full h-10 px-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-brand-light" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 mb-1 block">門票價格</label>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="w-full h-10 px-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-brand-light" />
            </div>
          </div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="備註..." className="w-full h-20 p-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm resize-none focus:outline-none focus:border-brand-light" />
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-400 font-bold text-sm hover:bg-zinc-700 transition-colors">取消</button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-brand-light text-zinc-900 font-bold text-sm hover:bg-brand-light/90 transition-colors">儲存</button>
          </div>
        </form>
      </div>
    </div>
  );
}
