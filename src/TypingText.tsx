import { memo, useLayoutEffect, useRef } from 'react';

interface Props { expected: string[]; entered: string[]; cursor: number; focused: boolean; activated: boolean }

/** The text and caret update on input, independently of the live timer and scores. */
export default memo(function TypingText({ expected, entered, cursor, focused, activated }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const caret = useRef<HTMLSpanElement>(null);
  const lastScroll = useRef(-1);

  useLayoutEffect(() => {
    const region = viewport.current;
    if (!region) return;
    const positionCaret = () => {
      const character = anchor.current;
      const marker = caret.current;
      if (!character || !marker) return;
      const lineHeight = parseFloat(getComputedStyle(character.parentElement!).lineHeight);
      const fontSize = parseFloat(getComputedStyle(character).fontSize);
      marker.style.height = `${fontSize * 1.15}px`;
      marker.style.transform = `translate3d(${character.offsetLeft - 1}px, ${character.offsetTop + 1}px, 0)`;
      const top = Math.min(Math.max(0, character.offsetTop - lineHeight), Math.max(0, region.scrollHeight - region.clientHeight));
      if (top !== lastScroll.current) {
        lastScroll.current = top;
        region.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      }
    };
    positionCaret();
    const observer = new ResizeObserver(positionCaret);
    observer.observe(region);
    return () => observer.disconnect();
  }, [cursor, expected, focused]);

  return <div ref={viewport} className={`text-viewport ${activated ? '' : 'unfocused'}`} aria-hidden="true">
    <div className="typing-text">
      {expected.map((character, index) => {
        const state = index < cursor ? (entered[index] === character ? 'correct' : 'incorrect') : '';
        return <span key={index} ref={index === cursor ? anchor : undefined} className={`character ${state} ${character === '\n' ? 'newline' : ''} ${index === cursor && focused ? 'caret' : ''}`}>{character}</span>;
      })}
    </div>
    <span ref={caret} className={`smooth-caret ${focused ? 'visible' : ''}`} />
  </div>;
});
