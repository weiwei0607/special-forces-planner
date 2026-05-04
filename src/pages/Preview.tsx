import { useState, useEffect } from 'react';
import { db, type Itinerary } from '../db';
import { recalculateFromDelay } from '../utils/scheduler';
import { ArrowLeft, MapPin, Clock, AlertTriangle, CheckCircle2, DollarSign, Share2, User, RefreshCw, X, Navigation } from 'lucide-react';

interface Props {
  id: string;
  onBack: () => void;
}

export const Preview: React.FC<Props> = ({ id, onBack }) => {
  const [it, setIt] = useState<Itinerary | null>(null);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [delayResult, setDelayResult] = useState<ReturnType<typeof recalculateFromDelay> | null>(null);
  const [activePlan, setActivePlan] = useState<'original' | 'planb'>('original');

  useEffect(() => {
    db.itineraries.get(id).then(data => setIt(data ?? null));
  }, [id]);

  if (!it) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-light border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentPlan = activePlan === 'planb' && delayResult ? delayResult.plan : it.plan;
  const currentSpots = activePlan === 'planb' && delayResult
    ? it.spots.filter(s => delayResult.plan.some(p => p.spotId === s.id))
    : it.spots;

  const totalDuration = currentPlan.length > 0
    ? `${it.startTime} – ${currentPlan[currentPlan.length - 1].departureTime}`
    : `${it.startTime} – ${it.endTime}`;

  const share = () => {
    const json = JSON.stringify(it);
    const hash = btoa(encodeURIComponent(json));
    const url = `${window.location.origin}${window.location.pathname}#share=${hash}`;
    navigator.clipboard.writeText(url).then(() => alert('行程連結已複製！'));
  };

  const handleDelayCalculated = (result: ReturnType<typeof recalculateFromDelay>) => {
    setDelayResult(result);
    setActivePlan('planb');
    setShowDelayModal(false);
  };

  return (
    <div className="min-h-screen p-6">
      <header className="max-w-2xl mx-auto mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">返回編輯</span>
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-100">{it.title}</h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {it.city || '未設定城市'}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {totalDuration}</span>
              <span className="flex items-center gap-1"><User className="w-3 h-3" /> {it.travelers}人</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDelayModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-500/10 text-orange-400 text-xs font-bold hover:bg-orange-500/20 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              我延誤了
            </button>
            <button onClick={share} className="p-2.5 rounded-xl bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors">
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Plan Toggle */}
        {delayResult && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActivePlan('original')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                activePlan === 'original' ? 'bg-zinc-700 text-white' : 'bg-zinc-800/50 text-zinc-500'
              }`}
            >
              原始計畫
            </button>
            <button
              onClick={() => setActivePlan('planb')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                activePlan === 'planb' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-zinc-800/50 text-zinc-500'
              }`}
            >
              動態調整後 ({delayResult.plan.length} 個景點)
            </button>
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto space-y-4">
        {/* Warnings for Plan B */}
        {delayResult && activePlan === 'planb' && delayResult.warnings.length > 0 && (
          <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-orange-400 text-xs font-bold uppercase">
              <AlertTriangle className="w-4 h-4" />
              調整後注意事項
            </div>
            {delayResult.warnings.map((w, i) => (
              <p key={i} className="text-orange-300/80 text-xs">• {w}</p>
            ))}
          </div>
        )}

        {/* Timeline */}
        {currentPlan.length === 0 ? (
          <div className="text-center py-20 text-zinc-600">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">尚未規劃時間軸</p>
            <p className="text-xs mt-1">回到編輯頁面點擊「一鍵最佳化路線」</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-[27px] top-4 bottom-4 w-px bg-zinc-800" />
            <div className="space-y-0">
              <div className="flex items-start gap-4 py-3">
                <div className="relative z-10 w-[54px] text-right shrink-0">
                  <span className="text-xs font-mono text-zinc-500">{activePlan === 'planb' && currentPlan.length > 0 ? currentPlan[0].arrivalTime : it.startTime}</span>
                </div>
                <div className="w-2 h-2 rounded-full bg-zinc-600 mt-1.5 shrink-0 ring-4 ring-zinc-950" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-zinc-400">出發</p>
                </div>
              </div>

              {currentPlan.map((p, idx) => {
                const spot = currentSpots.find(s => s.id === p.spotId);
                if (!spot) return null;
                const originalIdx = it.spots.findIndex(s => s.id === p.spotId);

                return (
                  <div key={p.spotId}>
                    {p.travelTimeFromPrev > 0 && (
                      <div className="flex items-start gap-4 py-1">
                        <div className="w-[54px] shrink-0" />
                        <div className="w-2 shrink-0 flex justify-center">
                          <div className="w-px h-full border-l border-dashed border-zinc-700" />
                        </div>
                        <div className="flex-1 flex items-center gap-1.5 text-[11px] text-zinc-600 pb-2">
                          <Navigation className="w-3 h-3" />
                          交通 {p.travelTimeFromPrev} 分鐘
                          {p.travelMode === 'walk' ? '（步行）' : p.travelMode === 'transit' ? '（大眾運輸）' : '（開車）'}
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-4 py-3">
                      <div className="relative z-10 w-[54px] text-right shrink-0">
                        <span className="text-xs font-mono text-brand-light font-bold">{p.arrivalTime}</span>
                        <p className="text-[10px] text-zinc-600 mt-0.5">{p.departureTime} 離開</p>
                      </div>
                      <div className={[
                        'w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ring-4 ring-zinc-950',
                        p.warning ? 'bg-red-500/20 border border-red-500/50' : 'bg-brand-light/20 border border-brand-light/50'
                      ].join(' ')}>
                        {p.warning ? (
                          <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
                        ) : (
                          <CheckCircle2 className="w-2.5 h-2.5 text-brand-light" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-zinc-100">{spot.name}</p>
                            <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                              <span>停留 {spot.durationMin} 分鐘</span>
                              {spot.price > 0 && <span className="flex items-center gap-0.5"><DollarSign className="w-3 h-3" />${spot.price}</span>}
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-zinc-800 text-zinc-500 shrink-0">
                            #{activePlan === 'planb' ? idx + 1 : originalIdx + 1}
                          </span>
                        </div>
                        {p.warning && (
                          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-red-400 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            {p.warning}
                          </div>
                        )}
                        {spot.notes && (
                          <p className="mt-2 text-[11px] text-zinc-600 bg-zinc-900 rounded-lg px-3 py-2 border border-zinc-800">
                            {spot.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="flex items-start gap-4 py-3">
                <div className="relative z-10 w-[54px] text-right shrink-0">
                  <span className="text-xs font-mono text-zinc-500">
                    {currentPlan.length > 0 ? currentPlan[currentPlan.length - 1].departureTime : it.endTime}
                  </span>
                </div>
                <div className="w-2 h-2 rounded-full bg-zinc-600 mt-1.5 shrink-0 ring-4 ring-zinc-950" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-zinc-400">結束</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
        {currentPlan.length > 0 && (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 mt-6">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">行程摘要</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-800/50 rounded-xl p-3">
                <p className="text-[10px] text-zinc-500 uppercase">景點數</p>
                <p className="text-xl font-black text-zinc-100">{currentPlan.length} <span className="text-xs font-medium text-zinc-500">個</span></p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-3">
                <p className="text-[10px] text-zinc-500 uppercase">總花費</p>
                <p className="text-xl font-black text-zinc-100">${currentSpots.reduce((s, spot) => s + spot.price, 0)}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-3">
                <p className="text-[10px] text-zinc-500 uppercase">總步行距離</p>
                <p className="text-xl font-black text-zinc-100">
                  {activePlan === 'original'
                    ? it.plan.reduce((sum, p, i) => {
                        if (i === 0 || p.travelMode !== 'walk') return sum;
                        const prev = it.spots.find(s => s.id === it.plan[i - 1].spotId);
                        const cur = it.spots.find(s => s.id === p.spotId);
                        if (!prev || !cur) return sum;
                        const d = Math.sqrt(Math.pow(prev.lat - cur.lat, 2) + Math.pow(prev.lng - cur.lng, 2)) * 111;
                        return sum + d * 1.4;
                      }, 0).toFixed(1)
                    : delayResult?.totalWalkKm.toFixed(1) ?? '0.0'}
                  <span className="text-xs font-medium text-zinc-500"> km</span>
                </p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-3">
                <p className="text-[10px] text-zinc-500 uppercase">交通時間</p>
                <p className="text-xl font-black text-zinc-100">
                  {currentPlan.reduce((s, p) => s + p.travelTimeFromPrev, 0)}
                  <span className="text-xs font-medium text-zinc-500"> 分鐘</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Delay Modal */}
      {showDelayModal && (
        <DelayModal
          it={it}
          onClose={() => setShowDelayModal(false)}
          onCalculate={handleDelayCalculated}
        />
      )}
    </div>
  );
};

function DelayModal({
  it,
  onClose,
  onCalculate,
}: {
  it: Itinerary;
  onClose: () => void;
  onCalculate: (result: ReturnType<typeof recalculateFromDelay>) => void;
}) {
  const [completedCount, setCompletedCount] = useState(0);
  const [delayMin, setDelayMin] = useState(30);
  const [customTime, setCustomTime] = useState('');

  const handleCalculate = () => {
    const now = new Date();
    const timeStr = customTime || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Current position = last completed spot, or start point if none
    let currentLat = 0;
    let currentLng = 0;
    if (completedCount > 0) {
      const lastCompleted = it.plan[completedCount - 1];
      const spot = it.spots.find(s => s.id === lastCompleted?.spotId);
      currentLat = spot?.lat ?? 0;
      currentLng = spot?.lng ?? 0;
    } else if (it.spots.length > 0) {
      currentLat = it.spots[0].lat;
      currentLng = it.spots[0].lng;
    }

    const result = recalculateFromDelay(it, completedCount, currentLat, currentLng, timeStr);
    onCalculate(result);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-zinc-100">行程延誤調整</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500 mb-2 block">目前已完成的景點</label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 border border-zinc-800 cursor-pointer">
                <input
                  type="radio"
                  name="completed"
                  checked={completedCount === 0}
                  onChange={() => setCompletedCount(0)}
                  className="accent-brand-light"
                />
                <span className="text-sm text-zinc-300">還沒開始（在起點）</span>
              </label>
              {it.plan.map((p, idx) => {
                const spot = it.spots.find(s => s.id === p.spotId);
                if (!spot) return null;
                return (
                  <label key={p.spotId} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 border border-zinc-800 cursor-pointer">
                    <input
                      type="radio"
                      name="completed"
                      checked={completedCount === idx + 1}
                      onChange={() => setCompletedCount(idx + 1)}
                      className="accent-brand-light"
                    />
                    <div className="flex-1">
                      <p className="text-sm text-zinc-300">{spot.name}</p>
                      <p className="text-[10px] text-zinc-600">預計 {p.departureTime} 離開</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-500 mb-2 block">延誤分鐘數</label>
            <input
              type="range"
              min={0}
              max={180}
              step={5}
              value={delayMin}
              onChange={e => setDelayMin(parseInt(e.target.value))}
              className="w-full accent-brand-light"
            />
            <div className="flex justify-between text-xs text-zinc-500 mt-1">
              <span>準時</span>
              <span className="text-brand-light font-bold">+{delayMin} 分鐘</span>
              <span>+3 小時</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-500 mb-1 block">或輸入現在實際時間</label>
            <input
              type="time"
              value={customTime}
              onChange={e => setCustomTime(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-brand-light"
            />
          </div>

          <button
            onClick={handleCalculate}
            className="w-full py-3 rounded-xl bg-brand-light text-zinc-900 font-bold text-sm hover:bg-brand-light/90 transition-colors"
          >
            重新計算行程
          </button>
        </div>
      </div>
    </div>
  );
}
