import { useState, useEffect } from 'react';
import { List } from './pages/List';
import { Editor } from './pages/Editor';
import { Preview } from './pages/Preview';
import { db, generateId, type Itinerary } from './db';
import { SplashScreen } from './components/SplashScreen';

type View = 'list' | 'editor' | 'preview';

function loadSharedItinerary(): Itinerary | null {
  const hash = window.location.hash;
  if (!hash.startsWith('#share=')) return null;
  try {
    const encoded = hash.slice('#share='.length);
    const json = decodeURIComponent(atob(encoded));
    const it: Itinerary = JSON.parse(json);
    // 分享連結可能被截斷或手動竄改，補齊缺欄位避免下游 TypeError（白屏）。
    if (typeof it !== 'object' || it === null) return null;
    if (!Array.isArray(it.spots)) it.spots = [];
    if (!Array.isArray(it.plan)) it.plan = [];
    if (typeof it.title !== 'string') it.title = '未命名行程';
    if (typeof it.startTime !== 'string') it.startTime = '09:00';
    if (typeof it.endTime !== 'string') it.endTime = '21:00';
    it.id = generateId();
    it.createdAt = Date.now();
    it.updatedAt = Date.now();
    return it;
  } catch {
    return null;
  }
}

function shouldShowSplash(): boolean {
  try {
    if (sessionStorage.getItem('sfp_splash')) return false;
    sessionStorage.setItem('sfp_splash', '1');
    return true;
  } catch { return false; }
}

export default function App() {
  const [view, setView]         = useState<View>('list');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [shareLoaded, setShareLoaded] = useState(false);
  const [splash, setSplash]     = useState<boolean>(shouldShowSplash);

  useEffect(() => {
    if (shareLoaded) return;
    setShareLoaded(true);
    const shared = loadSharedItinerary();
    if (!shared) return;
    db.itineraries.put(shared).then(() => {
      setActiveId(shared.id);
      setView('preview');
      window.history.replaceState(null, '', window.location.pathname);
    }).catch(() => {
      window.history.replaceState(null, '', window.location.pathname);
    });
  }, [shareLoaded]);

  const openEditor = (id?: string) => { setActiveId(id || null); setView('editor'); };
  const openPreview = (id: string) => { setActiveId(id); setView('preview'); };

  return (
    <div className="min-h-screen" style={{ background: 'var(--op-bg)', color: 'var(--op-text-1)' }}>
      {splash && <SplashScreen onDone={() => setSplash(false)} />}
      {view === 'list'    && <List onNew={() => openEditor()} onOpen={(id) => openEditor(id)} onPreview={(id) => openPreview(id)} />}
      {view === 'editor'  && <Editor id={activeId} onBack={() => setView('list')} onPreview={(id) => openPreview(id)} />}
      {view === 'preview' && activeId && <Preview id={activeId} onBack={() => setView('editor')} />}
    </div>
  );
}
