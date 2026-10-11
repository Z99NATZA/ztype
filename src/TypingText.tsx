import { memo, useCallback, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';

interface Props { expected: string[]; entered: string[]; cursor: number; lockedCursor: number; focused: boolean }
interface Chunk { characters: string[]; start: number; end: number; text: string }
interface ChunkProps extends Omit<Props, 'expected'> { chunk: Chunk; anchor: RefObject<HTMLSpanElement | null> }
const phase = (chunk: Chunk, cursor: number) => cursor < chunk.start ? 'future' : cursor < chunk.end ? 'active' : 'past';

const TextChunk = memo(function TextChunk({ chunk, entered, cursor, focused, anchor }: ChunkProps) {
  const state = phase(chunk, cursor);
  if (state === 'future') return <span className="text-chunk">{chunk.text}</span>;
  if (state === 'past') {
    const runs: { correct: boolean; text: string }[] = [];
    chunk.characters.forEach((character, offset) => {
      const correct = entered[chunk.start + offset] === character;
      const last = runs[runs.length - 1];
      if (last && last.correct === correct) last.text += character;
      else runs.push({ correct, text: character });
    });
    return <span className="text-chunk">{runs.map((run, index) => <span key={index} className={`character ${run.correct ? 'correct' : 'incorrect'}`}>{run.text}</span>)}</span>;
  }
  return <span className="text-chunk">{chunk.characters.map((character, offset) => {
    const index = chunk.start + offset;
    const state = index < cursor ? entered[index] === character ? 'correct' : 'incorrect' : '';
    return <span key={index} ref={index === cursor ? anchor : undefined} className={`character ${state} ${character === '\n' ? 'newline' : ''} ${index === cursor && focused ? 'caret' : ''}`}>{character}</span>;
  })}</span>;
}, (previous, next) => {
  if (previous.chunk !== next.chunk) return false;
  const previousPhase = phase(previous.chunk, previous.cursor);
  if (previousPhase !== phase(next.chunk, next.cursor)) return false;
  if (previousPhase === 'future') return true;
  if (previousPhase === 'active') return previous.entered === next.entered && previous.cursor === next.cursor && previous.focused === next.focused;
  if (previous.lockedCursor >= next.chunk.end && next.lockedCursor >= next.chunk.end) return true;
  for (let index = next.chunk.start; index < next.chunk.end; index++) if (previous.entered[index] !== next.entered[index]) return false;
  return true;
});

/** Only the active chunk has individual glyph nodes; committed text stays cached. */
export default memo(function TypingText({ expected, entered, cursor, lockedCursor, focused }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const caret = useRef<HTMLSpanElement>(null);
  const frame = useRef<number | null>(null);
  const step = useRef<(time: number) => void>(() => {});
  const motion = useRef({ ready: false, dirty: true, snap: true, reduced: false, lastTime: 0, x: 0, y: 0, scroll: 0, targetX: 0, targetY: 0, targetScroll: 0, fontSize: 25, lineHeight: 49 });
  const chunks = useMemo(() => {
    const result: Chunk[] = [];
    for (let start = 0; start < expected.length; start += 96) {
      const characters = expected.slice(start, start + 96);
      result.push({ characters, start, end: start + characters.length, text: characters.join('') });
    }
    return result;
  }, [expected]);

  const schedule = useCallback((snap = false) => {
    motion.current.dirty = true;
    motion.current.snap ||= snap;
    if (frame.current === null) frame.current = requestAnimationFrame((time) => step.current(time));
  }, []);

  step.current = (time) => {
    frame.current = null;
    const region = viewport.current;
    const character = anchor.current;
    const marker = caret.current;
    if (!region || !character || !marker) return;
    const state = motion.current;
    if (state.dirty) {
      const bounds = character.getBoundingClientRect();
      const area = region.getBoundingClientRect();
      if (state.snap || !state.ready) {
        const style = getComputedStyle(text.current!);
        state.fontSize = parseFloat(style.fontSize);
        state.lineHeight = parseFloat(style.lineHeight);
      }
      const x = bounds.left - area.left - 1;
      const y = bounds.top - area.top + region.scrollTop + 1;
      const scroll = Math.min(Math.max(0, y - state.lineHeight), Math.max(0, region.scrollHeight - region.clientHeight));
      state.scroll = region.scrollTop;
      if (Math.abs(y - state.targetY) > state.lineHeight / 2) state.x = x;
      state.targetX = x; state.targetY = y; state.targetScroll = scroll;
      if (state.snap || !state.ready || state.reduced) { state.x = x; state.y = y; state.scroll = scroll; }
      state.ready = true; state.dirty = false; state.snap = false;
      marker.style.height = `${state.fontSize * 1.15}px`;
    }
    const delta = state.lastTime ? Math.min(64, time - state.lastTime) : 1000 / 60;
    const ease = state.reduced ? 1 : 1 - Math.exp(-30 * delta / 1000);
    state.x += (state.targetX - state.x) * ease;
    state.y += (state.targetY - state.y) * ease;
    state.scroll += (state.targetScroll - state.scroll) * ease;
    const moving = Math.abs(state.targetX - state.x) > .15 || Math.abs(state.targetY - state.y) > .15 || Math.abs(state.targetScroll - state.scroll) > .15;
    if (!moving) { state.x = state.targetX; state.y = state.targetY; state.scroll = state.targetScroll; }
    marker.style.transform = `translate3d(${state.x}px, ${state.y}px, 0)`;
    region.scrollTop = state.scroll;
    state.lastTime = moving ? time : 0;
    if (moving) frame.current = requestAnimationFrame((nextTime) => step.current(nextTime));
  };

  useLayoutEffect(() => { schedule(); }, [cursor, expected, focused, schedule]);
  useLayoutEffect(() => {
    const region = viewport.current!;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    motion.current.reduced = media.matches;
    const preferenceChanged = () => { motion.current.reduced = media.matches; schedule(true); };
    media.addEventListener('change', preferenceChanged);
    let width = region.clientWidth;
    const observer = new ResizeObserver(() => {
      const resized = width !== region.clientWidth;
      width = region.clientWidth;
      schedule(resized);
    });
    observer.observe(region);
    observer.observe(text.current!);
    return () => { observer.disconnect(); media.removeEventListener('change', preferenceChanged); if (frame.current !== null) cancelAnimationFrame(frame.current); frame.current = null; };
  }, [schedule]);

  return <div ref={viewport} className="text-viewport" aria-hidden="true">
    <div ref={text} className="typing-text">{chunks.map((chunk) => <TextChunk key={chunk.start} chunk={chunk} entered={entered} cursor={cursor} lockedCursor={lockedCursor} focused={focused} anchor={anchor} />)}</div>
    <span ref={caret} className={`smooth-caret ${focused ? 'visible' : ''}`} />
  </div>;
});
