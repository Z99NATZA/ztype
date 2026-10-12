import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { BookOpen, Check, ChevronDown, Search, Shuffle } from 'lucide-react';
import type { TextSet } from '../shared/types';

interface Props { sets: TextSet[]; selected: TextSet; onSelect: (set: TextSet) => void }

export default function SetPicker({ sets, selected, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();
  const visible = useMemo(() => ['passage', 'words'].flatMap((kind) => sets.filter((set) =>
    set.kind === kind && set.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  )), [sets, query]);

  useEffect(() => {
    if (!open) return;
    search.current?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  useEffect(() => {
    const option = document.getElementById(`${listId}-${active}`);
    const region = list.current;
    if (!open || !option || !region) return;
    const bounds = option.getBoundingClientRect();
    const area = region.getBoundingClientRect();
    if (bounds.top < area.top) region.scrollTop += bounds.top - area.top;
    else if (bounds.bottom > area.bottom) region.scrollTop += Math.min(bounds.bottom - area.bottom, bounds.top - area.top);
  }, [open, active, listId, query]);

  const show = () => {
    setQuery('');
    const ordered = [...sets.filter((set) => set.kind === 'passage'), ...sets.filter((set) => set.kind === 'words')];
    setActive(Math.max(0, ordered.findIndex((set) => set.id === selected.id)));
    setOpen(true);
  };
  const choose = (set: TextSet) => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
    onSelect(set);
  };
  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape' && open) {
      event.preventDefault(); setOpen(false); trigger.current?.focus({ preventScroll: true });
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) show();
      else if (visible.length) setActive((index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + visible.length) % visible.length);
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      if (visible[active]) choose(visible[active]);
    }
  };

  return <div ref={root} className="set-select" onKeyDown={handleKey} onBlur={(event) => {
    if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <span className="field-caption">ชุดที่ฝึก</span>
    <button ref={trigger} type="button" className={`set-picker-trigger ${open ? 'is-open' : ''}`} aria-label="เลือกชุดข้อความ" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} onClick={() => open ? setOpen(false) : show()}>
      <span className="set-picker-icon">{selected.kind === 'words' ? <Shuffle size={17} /> : <BookOpen size={17} />}</span>
      <span className="set-picker-name" title={selected.name}>{selected.name}</span>
      <ChevronDown className="set-picker-chevron" size={16} />
    </button>
    {open && <div className="set-picker-popover">
      <div className="set-picker-search"><Search size={16} /><input ref={search} type="text" role="combobox" aria-label="ค้นหาชุดฝึก" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={visible[active] ? `${listId}-${active}` : undefined} autoComplete="off" placeholder="ค้นหาชุดข้อความ…" value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} /></div>
      <div ref={list} id={listId} role="listbox" aria-label="ชุดข้อความที่เลือกได้" className="set-picker-list">
        {(['passage', 'words'] as const).map((kind) => {
          const group = visible.filter((set) => set.kind === kind);
          if (!group.length) return null;
          return <div key={kind} role="group" aria-label={kind === 'passage' ? 'ข้อความ' : 'คลังคำสุ่ม'}>
            <div className="set-picker-group" aria-hidden="true"><span>{kind === 'passage' ? 'ข้อความ' : 'คลังคำสุ่ม'}</span><span>{group.length}</span></div>
            {group.map((set) => {
              const index = visible.indexOf(set);
              return <button type="button" key={set.id} id={`${listId}-${index}`} role="option" aria-label={set.name} aria-selected={selected.id === set.id} tabIndex={-1} className={`set-picker-option ${active === index ? 'is-active' : ''}`} onPointerMove={() => setActive(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(set)}>
                {kind === 'passage' ? <BookOpen size={16} /> : <Shuffle size={16} />}
                <span title={set.name}>{set.name}</span>
                {selected.id === set.id && <Check size={16} className="set-picker-check" />}
              </button>;
            })}
          </div>;
        })}
      </div>
      {!visible.length && <p className="set-picker-empty" role="status">ไม่พบชุดข้อความ</p>}
    </div>}
  </div>;
}
