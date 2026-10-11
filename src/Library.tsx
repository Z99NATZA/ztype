import { useEffect, useRef, useState } from 'react';
import { BookOpen, Shuffle, Plus, Pencil, Trash2, X, ArrowUpRight, Search } from 'lucide-react';
import type { SetDraft, SetKind, TextSet } from '../shared/types';
import { bankWords, wordCount } from './typing';

interface Props {
  sets: TextSet[];
  onSave: (draft: SetDraft, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onPractice: (set: TextSet) => void;
}

export default function Library({ sets, onSave, onDelete, onPractice }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | SetKind>('all');
  const [editing, setEditing] = useState<TextSet | 'new' | null>(null);
  const [deleting, setDeleting] = useState<TextSet | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const visible = sets.filter((set) => (filter === 'all' || set.kind === filter) && `${set.name} ${set.content}`.toLowerCase().includes(search.toLowerCase()));

  const remove = async () => {
    if (!deleting) return;
    setBusy(true); setError('');
    try { await onDelete(deleting.id); setDeleting(null); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };

  return <>
    <div className="section-heading"><h1>ชุดข้อความ</h1><button className="button-primary" onClick={() => setEditing('new')}><Plus size={17} /> เพิ่มชุด</button></div>
    <div className="library-toolbar"><div className="segmented">{(['all', 'passage', 'words'] as const).map((kind) => <button className={filter === kind ? 'active' : ''} key={kind} onClick={() => setFilter(kind)}>{kind === 'all' ? 'ทั้งหมด' : kind === 'passage' ? 'ข้อความ' : 'คลังคำ'}</button>)}</div><label className="search-field"><Search size={16} /><input aria-label="ค้นหาชุดข้อความ" placeholder="ค้นหาชุดข้อความ" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
    {visible.length ? <div className="library-grid">{visible.map((set) => <article key={set.id} className="set-card">
      <div className="flex items-center justify-between"><span className="type-label">{set.kind === 'passage' ? <BookOpen size={15} /> : <Shuffle size={15} />}{set.kind === 'passage' ? 'ข้อความ' : 'คลังคำ'}</span><div className="flex gap-1"><button className="icon-button" aria-label={`แก้ไข ${set.name}`} onClick={() => setEditing(set)}><Pencil size={15} /></button><button className="icon-button" aria-label={`ลบ ${set.name}`} onClick={() => { setError(''); setDeleting(set); }}><Trash2 size={15} /></button></div></div>
      <h2 className="mt-5 mb-3 truncate text-lg font-medium" title={set.name}>{set.name}</h2><p className="set-preview">{set.content}</p><div className="card-bottom"><span>{set.kind === 'words' ? bankWords(set.content).length : wordCount(set.content)} คำ</span><button onClick={() => onPractice(set)}>ฝึกชุดนี้ <ArrowUpRight size={16} /></button></div>
    </article>)}</div> : <div className="empty-state"><BookOpen size={27} /><p>{sets.length ? 'ไม่พบชุดข้อความ' : 'เพิ่มข้อความหรือคำที่อยากฝึก'}</p><button className="button-secondary" onClick={() => setEditing('new')}><Plus size={16} /> เพิ่มชุด</button></div>}
    {editing && <SetEditor set={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSave={async (draft, id) => { await onSave(draft, id); setEditing(null); }} />}
    {deleting && <Modal label="ลบชุดข้อความ" onClose={() => { if (!busy) setDeleting(null); }}><h2 className="text-xl font-medium">ลบชุดข้อความ</h2><p className="mt-4 text-muted break-words">ลบ “{deleting.name}”?</p>{error && <p className="error-message" role="alert">{error}</p>}<div className="modal-actions"><button className="button-secondary" disabled={busy} onClick={() => setDeleting(null)}>ยกเลิก</button><button className="button-danger" disabled={busy} onClick={remove}>{busy ? 'กำลังลบ…' : 'ลบชุด'}</button></div></Modal>}
  </>;
}

function Modal({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="modal" aria-label={label} onCancel={(event) => { event.preventDefault(); onClose(); }}><button className="modal-close icon-button" aria-label="ปิด" onClick={onClose}><X size={20} /></button>{children}</dialog>;
}

function SetEditor({ set, onClose, onSave }: { set?: TextSet; onClose: () => void; onSave: (draft: SetDraft, id?: string) => Promise<void> }) {
  const [draft, setDraft] = useState<SetDraft>({ name: set?.name ?? '', kind: set?.kind ?? 'passage', content: set?.content ?? '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <Modal label={set ? 'แก้ไขชุดข้อความ' : 'เพิ่มชุดข้อความ'} onClose={() => { if (!busy) onClose(); }}><h2 className="mb-7 text-xl font-medium">{set ? 'แก้ไขชุดข้อความ' : 'เพิ่มชุดข้อความ'}</h2><form onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await onSave({ ...draft, name: draft.name.trim(), content: draft.content.trim() }, set?.id); }
    catch (error) { setError((error as Error).message); setBusy(false); }
  }}>
    <fieldset disabled={busy} className="space-y-5">
      <label className="field-label">ชื่อชุด<input autoFocus required maxLength={100} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="ตั้งชื่อให้จำง่าย" /></label>
      <div><span className="field-label mb-2">รูปแบบ</span><div className="kind-picker">{(['passage', 'words'] as const).map((kind) => <button key={kind} type="button" aria-pressed={draft.kind === kind} className={draft.kind === kind ? 'active' : ''} onClick={() => setDraft({ ...draft, kind })}>{kind === 'passage' ? <BookOpen size={17} /> : <Shuffle size={17} />}<span>{kind === 'passage' ? 'ข้อความ' : 'คลังคำสุ่ม'}<small>{kind === 'passage' ? 'พิมพ์ตามลำดับ' : 'สุ่มคำในแต่ละรอบ'}</small></span></button>)}</div></div>
      <label className="field-label">{draft.kind === 'passage' ? 'ข้อความ' : 'คำที่ต้องการฝึก'}<textarea required maxLength={50000} rows={8} value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder={draft.kind === 'passage' ? 'วางข้อความที่ต้องการฝึกที่นี่' : 'แยกคำด้วยช่องว่าง จุลภาค หรือขึ้นบรรทัดใหม่'} /></label>
      <div className="flex justify-between gap-3 text-xs text-muted"><span>{draft.kind === 'words' ? 'แยกคำด้วยช่องว่าง จุลภาค หรือขึ้นบรรทัดใหม่' : 'รองรับข้อความไทยและอังกฤษ'}</span><span className="shrink-0">{draft.content.length.toLocaleString()} / 50,000</span></div>
    </fieldset>
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="modal-actions"><button type="button" className="button-secondary" disabled={busy} onClick={onClose}>ยกเลิก</button><button type="submit" className="button-primary" disabled={busy || !draft.name.trim() || !draft.content.trim()}>{busy ? 'กำลังบันทึก…' : 'บันทึกชุด'}</button></div>
  </form></Modal>;
}
