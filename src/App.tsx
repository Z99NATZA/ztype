import { useEffect, useState } from 'react';
import { Keyboard, Library as LibraryIcon, BookOpen, Shuffle, ChevronDown, Plus, RefreshCw } from 'lucide-react';
import type { Settings, SetDraft, TextSet, TestMode } from '../shared/types';
import { api } from './api';
import Practice from './Practice';
import Library from './Library';

function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem('softtype.settings') ?? 'null');
    if (saved && typeof saved.setId === 'string' && ['time', 'words'].includes(saved.mode) && Number.isInteger(saved.amount) && saved.amount >= 1 && saved.amount <= (saved.mode === 'time' ? 3600 : 1000)) return saved;
  } catch { /* Use defaults if storage is unavailable or old settings are invalid. */ }
  return { setId: '', mode: 'time', amount: 30 };
}

export default function App() {
  const [page, setPage] = useState<'practice' | 'library'>('practice');
  const [sets, setSets] = useState<TextSet[]>([]);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [round, setRound] = useState(0);
  const [custom, setCustom] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const selected = sets.find((set) => set.id === settings.setId) ?? sets[0];

  const reload = async () => {
    setLoading(true); setError('');
    try { setSets(await api.list()); }
    catch (error) { setError((error as Error).message); }
    finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, []);
  useEffect(() => { try { localStorage.setItem('softtype.settings', JSON.stringify(settings)); } catch { /* Preferences are optional. */ } }, [settings]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 2600); return () => clearTimeout(timer); }, [notice]);

  const save = async (draft: SetDraft, id?: string) => {
    const saved = id ? await api.update(id, draft) : await api.create(draft);
    setSets((current) => id ? current.map((set) => set.id === id ? saved : set) : [...current, saved]);
    setNotice('บันทึกแล้ว');
  };
  const remove = async (id: string) => {
    await api.delete(id);
    setSets((current) => current.filter((set) => set.id !== id));
    setNotice('ลบชุดแล้ว');
  };
  const switchMode = (mode: TestMode) => { setSettings({ ...settings, mode, amount: mode === 'time' ? 30 : 25 }); setCustomOpen(false); };

  return <div className="app-shell">
    <header className="site-header"><a href="#" className="brand" onClick={(event) => { event.preventDefault(); setPage('practice'); }} aria-label="softtype หน้าฝึกพิมพ์"><span className="brand-mark"><Keyboard size={23} strokeWidth={1.6} /></span><span>softtype<span className="brand-dot">.</span></span></a><nav aria-label="หน้าหลัก"><button className={page === 'practice' ? 'active' : ''} onClick={() => setPage('practice')}><Keyboard size={16} />ฝึกพิมพ์</button><button className={page === 'library' ? 'active' : ''} onClick={() => setPage('library')}><LibraryIcon size={16} />ชุดข้อความ</button></nav></header>
    <main>
      {loading ? <div className="empty-state"><RefreshCw className="animate-spin" size={22} /><p>กำลังโหลด…</p></div> : error ? <div className="empty-state" role="alert"><p>{error}</p><button className="button-secondary" onClick={reload}><RefreshCw size={16} /> ลองอีกครั้ง</button></div> : page === 'library' ? <Library sets={sets} onSave={save} onDelete={remove} onPractice={(set) => { setSettings({ ...settings, setId: set.id }); setRound((value) => value + 1); setPage('practice'); }} /> : <>
        <div className="section-heading"><h1>ฝึกพิมพ์</h1><button className="quiet-button" onClick={() => setPage('library')}><Plus size={16} /> จัดการชุดข้อความ</button></div>
        {selected ? <>
          <div className="practice-settings">
            <label className="set-select"><span className="field-caption">ชุดที่ฝึก</span><span className="select-wrapper">{selected.kind === 'words' ? <Shuffle size={17} /> : <BookOpen size={17} />}<select aria-label="เลือกชุดข้อความ" value={selected.id} onChange={(event) => setSettings({ ...settings, setId: event.target.value })}><optgroup label="ข้อความ">{sets.filter((set) => set.kind === 'passage').map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}</optgroup><optgroup label="คลังคำสุ่ม">{sets.filter((set) => set.kind === 'words').map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}</optgroup></select><ChevronDown size={15} className="pointer-events-none" /></span></label>
            <div className="test-settings"><div className="segmented mode-picker"><button className={settings.mode === 'time' ? 'active' : ''} onClick={() => switchMode('time')}>เวลา</button><button className={settings.mode === 'words' ? 'active' : ''} onClick={() => switchMode('words')}>จำนวนคำ</button></div><span className="settings-divider" /><div className="amount-picker">{(settings.mode === 'time' ? [15, 30, 60, 120] : [10, 25, 50, 100]).map((amount) => <button key={amount} className={settings.amount === amount && !customOpen ? 'active' : ''} onClick={() => { setSettings({ ...settings, amount }); setCustomOpen(false); }}>{amount}</button>)}<button className={customOpen || !(settings.mode === 'time' ? [15, 30, 60, 120] : [10, 25, 50, 100]).includes(settings.amount) ? 'active' : ''} onClick={() => { setCustom(String(settings.amount)); setCustomOpen(!customOpen); }}>กำหนดเอง</button></div><span className="text-xs text-muted">{settings.mode === 'time' ? 'วิ' : 'คำ'}</span></div>
          </div>
          {customOpen && <form className="custom-amount" onSubmit={(event) => { event.preventDefault(); const amount = Number(custom); if (Number.isInteger(amount) && amount >= 1 && amount <= (settings.mode === 'time' ? 3600 : 1000)) { setSettings({ ...settings, amount }); setCustomOpen(false); } }}><label htmlFor="custom-amount">{settings.mode === 'time' ? 'เวลา (1–3,600 วิ)' : 'จำนวนคำ (1–1,000)'}</label><input id="custom-amount" type="number" autoFocus min={1} max={settings.mode === 'time' ? 3600 : 1000} step={1} required value={custom} onChange={(event) => setCustom(event.target.value)} /><button className="button-secondary" type="submit">ใช้ค่านี้</button></form>}
          <div className="selected-meta"><span>{selected.kind === 'words' ? 'สุ่มคำจากคลัง' : 'พิมพ์ข้อความตามลำดับ'}</span><span>{settings.mode === 'time' ? `${settings.amount} วินาที` : `${settings.amount} คำ`}</span></div>
          <Practice key={`${selected.id}:${selected.updatedAt}:${settings.mode}:${settings.amount}:${round}`} set={selected} settings={settings} onRestart={() => setRound((value) => value + 1)} />
        </> : <div className="empty-state"><BookOpen size={28} /><p>เพิ่มชุดข้อความเพื่อเริ่มฝึก</p><button className="button-primary" onClick={() => setPage('library')}><Plus size={16} /> เพิ่มชุด</button></div>}
      </>}
    </main>
    <footer className="site-footer"><span>WPM = 5 ตัวอักษรต่อคำ</span></footer>
    {notice && <div className="toast" role="status">{notice}</div>}
  </div>;
}
