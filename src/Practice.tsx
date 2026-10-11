import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, RotateCcw, Clock3, Hash, Keyboard, BookOpen } from 'lucide-react';
import type { Settings, TextSet } from '../shared/types';
import { useTyping } from './useTyping';
import { completedWords } from './typing';
import TypingText from './TypingText';

interface Props { set: TextSet; settings: Settings; onRestart: () => void }

export default function Practice({ set, settings, onRestart }: Props) {
  const typing = useTyping(set, settings);
  const input = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    if (typing.status === 'done') return;
    const startWithEnter = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      const element = event.target;
      if (element instanceof Element && element.closest('input, textarea, select, button, a, [contenteditable="true"], dialog')) return;
      event.preventDefault();
      input.current?.focus();
    };
    window.addEventListener('keydown', startWithEnter);
    return () => window.removeEventListener('keydown', startWithEnter);
  }, [typing.status]);

  const accept = (value: string) => { setDraft(typing.commit(value)); };
  const time = settings.mode === 'time' ? Math.max(0, Math.ceil(settings.amount - typing.elapsed)) : Math.floor(typing.elapsed);
  const progress = settings.mode === 'time' ? typing.elapsed / settings.amount : typing.cursor / typing.expected.length;
  const completed = useMemo(() => settings.mode === 'words' ? Math.min(settings.amount, completedWords(set, typing.target, typing.typed)) : 0, [set.kind, typing.target, typing.typed, settings.mode, settings.amount]);
  const label = settings.mode === 'original' ? `${Math.floor(progress * 100)}%` : settings.mode === 'time' ? `${time} วิ` : `${completed} / ${settings.amount} คำ`;

  if (typing.result) {
    const result = typing.result;
    return <section className="result-panel" aria-label="ผลการฝึก">
      <div className="eyebrow">เสร็จแล้ว</div>
      <h2 className="mt-3 text-xl font-medium">{set.name}</h2>
      <div className="result-grid">
        <div><span className="stat-label">ความเร็ว</span><strong>{result.wpm}<small> WPM</small></strong></div>
        <div><span className="stat-label">ความแม่นยำ</span><strong>{result.accuracy}<small>%</small></strong></div>
        <div><span className="stat-label">เวลา</span><strong>{result.seconds}<small> วิ</small></strong></div>
      </div>
      <div className="result-detail"><span>ถูก {result.correct} · คงเหลือผิด {result.incorrect}</span><span>พิมพ์ผิด {result.mistakes} ครั้ง · raw {result.raw} WPM</span></div>
      <button className="button-primary mt-9" onClick={onRestart}><RotateCcw size={16} /> ฝึกอีกครั้ง</button>
    </section>;
  }

  return <section className={`practice-panel ${typing.status === 'running' ? 'is-running' : ''}`}>
    <div className="practice-topline">
      <span className="flex items-center gap-2">{settings.mode === 'original' ? <BookOpen size={15} /> : settings.mode === 'time' ? <Clock3 size={15} /> : <Hash size={15} />}{label}</span>
      <span className="flex items-center gap-5"><span>{typing.live.wpm} <span className="text-muted">WPM</span></span><span>{typing.live.accuracy}<span className="text-muted">%</span></span></span>
    </div>
    <div className="progress-track"><div style={{ width: `${Math.min(100, progress * 100)}%` }} /></div>
    <div className="typing-area" onClick={() => input.current?.focus()}>
      <TypingText expected={typing.expected} entered={typing.entered} cursor={typing.cursor} focused={focused} activated={activated} />
      <textarea
        ref={input} className="typing-input" aria-label="พื้นที่ฝึกพิมพ์" value={draft}
        autoCapitalize="off" autoCorrect="off" spellCheck={false}
        onFocus={() => { setFocused(true); setActivated(true); input.current?.setSelectionRange(draft.length, draft.length); }}
        onBlur={() => setFocused(false)}
        onChange={(event) => {
          if (composing.current || (event.nativeEvent as InputEvent).isComposing) setDraft(event.target.value);
          else accept(event.target.value);
        }}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={(event) => { composing.current = false; accept(event.currentTarget.value); }}
        onPaste={(event) => event.preventDefault()}
        onDrop={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Escape') { event.preventDefault(); onRestart(); }
          if (event.key === 'Backspace' && draft.length <= typing.lockedUntil) event.preventDefault();
          if (event.key === 'Enter') { event.preventDefault(); accept(draft + (settings.mode === 'original' ? '\n' : ' ')); }
          if (event.key === 'Tab' && settings.mode === 'original' && typing.target[draft.length] === '\t') { event.preventDefault(); accept(draft + '\t'); }
          if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a')) event.preventDefault();
        }}
        onSelect={() => { if (!composing.current) input.current?.setSelectionRange(draft.length, draft.length); }}
      />
      {!activated && <button className="focus-prompt" aria-label="คลิกเพื่อเริ่มพิมพ์" onClick={() => input.current?.focus()}><Keyboard size={18} />คลิกเพื่อเริ่มพิมพ์<kbd>enter</kbd><ArrowRight size={15} /></button>}
      {composing.current && draft !== typing.typed && <div className="composition-preview">{draft.slice(typing.typed.length)}</div>}
    </div>
    <div className="practice-bottomline"><span>{activated && !focused ? 'Enter หรือคลิกเพื่อพิมพ์ต่อ' : 'เริ่มจับเวลาเมื่อพิมพ์ตัวแรก'}</span><button className="icon-button" aria-label="เริ่มใหม่" title="เริ่มใหม่ (Esc)" onClick={onRestart}><RotateCcw size={18} /></button><span><kbd>esc</kbd> เริ่มใหม่</span></div>
  </section>;
}
