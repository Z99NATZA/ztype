import { useEffect, useRef, useState } from 'react';
import { ArrowRight, RotateCcw, Clock3, Hash, Keyboard } from 'lucide-react';
import type { Settings, TextSet } from '../shared/types';
import { useTyping } from './useTyping';
import { completedWords } from './typing';

interface Props { set: TextSet; settings: Settings; onRestart: () => void }

export default function Practice({ set, settings, onRestart }: Props) {
  const typing = useTyping(set, settings);
  const input = useRef<HTMLTextAreaElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const caret = useRef<HTMLSpanElement>(null);
  const composing = useRef(false);
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (typing.status === 'done') return;
    const region = viewport.current;
    const element = caret.current;
    if (region && element) {
      const top = element.offsetTop - region.offsetTop;
      region.scrollTop = Math.max(0, top - 65);
    }
  }, [typing.cursor, typing.status]);

  const accept = (value: string) => { setDraft(value); typing.commit(value); };
  const time = settings.mode === 'time' ? Math.max(0, Math.ceil(settings.amount - typing.elapsed)) : Math.floor(typing.elapsed);
  const progress = settings.mode === 'time' ? typing.elapsed / settings.amount : typing.cursor / typing.expected.length;
  const completed = Math.min(settings.amount, completedWords(set, typing.target, typing.typed));

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
      <span className="flex items-center gap-2">{settings.mode === 'time' ? <Clock3 size={15} /> : <Hash size={15} />}{settings.mode === 'time' ? `${time} วิ` : `${completed} / ${settings.amount} คำ`}</span>
      <span className="flex items-center gap-5"><span>{typing.live.wpm} <span className="text-muted">WPM</span></span><span>{typing.live.accuracy}<span className="text-muted">%</span></span></span>
    </div>
    <div className="progress-track"><div style={{ width: `${Math.min(100, progress * 100)}%` }} /></div>
    <div className="typing-area" onClick={() => input.current?.focus()}>
      <div ref={viewport} className={`text-viewport ${focused ? '' : 'unfocused'}`} aria-hidden="true">
        <div className="typing-text">
          {typing.expected.map((character, index) => {
            const state = index < typing.cursor ? (typing.entered[index] === character ? 'correct' : 'incorrect') : '';
            return <span key={index} ref={index === typing.cursor ? caret : undefined} className={`character ${state} ${index === typing.cursor && focused ? 'caret' : ''}`}>{character}</span>;
          })}
        </div>
      </div>
      <textarea
        ref={input} className="typing-input" aria-label="พื้นที่ฝึกพิมพ์" value={draft}
        autoCapitalize="off" autoCorrect="off" spellCheck={false}
        onFocus={() => { setFocused(true); input.current?.setSelectionRange(draft.length, draft.length); }}
        onBlur={() => setFocused(false)}
        onChange={(event) => {
          setDraft(event.target.value);
          if (!composing.current && !(event.nativeEvent as InputEvent).isComposing) typing.commit(event.target.value);
        }}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={(event) => { composing.current = false; accept(event.currentTarget.value); }}
        onPaste={(event) => event.preventDefault()}
        onDrop={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Escape') { event.preventDefault(); onRestart(); }
          if (event.key === 'Enter') { event.preventDefault(); accept(draft + ' '); }
          if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a')) event.preventDefault();
        }}
        onSelect={() => { if (!composing.current) input.current?.setSelectionRange(draft.length, draft.length); }}
      />
      {!focused && <button className="focus-prompt" onClick={() => input.current?.focus()}><Keyboard size={18} />{typing.status === 'ready' ? 'คลิกเพื่อเริ่มพิมพ์' : 'คลิกเพื่อพิมพ์ต่อ'}<ArrowRight size={15} /></button>}
      {composing.current && draft !== typing.typed && <div className="composition-preview">{draft.slice(typing.typed.length)}</div>}
    </div>
    <div className="practice-bottomline"><span>เริ่มจับเวลาเมื่อพิมพ์ตัวแรก</span><button className="icon-button" aria-label="เริ่มใหม่" title="เริ่มใหม่ (Esc)" onClick={onRestart}><RotateCcw size={18} /></button><span><kbd>esc</kbd> เริ่มใหม่</span></div>
  </section>;
}
