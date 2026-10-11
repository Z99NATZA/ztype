import type { Settings, TextSet, TestResult } from '../shared/types';

const graphemeSegmenter = new Intl.Segmenter('th', { granularity: 'grapheme' });
const wordSegmenter = new Intl.Segmenter('th', { granularity: 'word' });
export const graphemes = (text: string): string[] =>
  Array.from(graphemeSegmenter.segment(text.normalize('NFC')), (part) => part.segment);

export const bankWords = (text: string): string[] => text.trim().split(/[\s,]+/u).filter(Boolean);
export function wordCount(text: string): number {
  return Array.from(wordSegmenter.segment(text)).filter((part) => part.isWordLike).length;
}

export function completedWords(set: TextSet, target: string, typed: string): number {
  if (set.kind === 'words') return (target.slice(0, typed.length).match(/ /g) ?? []).length + Number(typed.length >= target.length);
  return Array.from(wordSegmenter.segment(target)).filter((part) =>
    (part.isWordLike || (!/\s/u.test(part.segment) && /\p{Extended_Pictographic}|\p{S}/u.test(part.segment))) && part.index + part.segment.length <= typed.length,
  ).length;
}

/** Keep passage punctuation and order; repeat only when the requested size exceeds the passage. */
export function buildTarget(set: TextSet, settings: Settings, random = Math.random): string {
  if (set.kind === 'words') {
    const words = bankWords(set.content);
    if (!words.length) return '';
    const count = settings.mode === 'words' ? settings.amount : 120;
    return Array.from({ length: count }, () => words[Math.min(words.length - 1, Math.floor(random() * words.length))]).join(' ');
  }
  const passage = set.content.trim().replace(/\s+/gu, ' ');
  if (settings.mode === 'time') return passage;
  // Include symbols and emoji in the count so punctuation-only content is still usable.
  const segments = Array.from(wordSegmenter.segment(passage));
  const countable = (part: Intl.SegmentData) => part.isWordLike || (!/\s/u.test(part.segment) && /\p{Extended_Pictographic}|\p{S}/u.test(part.segment));
  const ends = segments.filter(countable).map((part) => part.index + part.segment.length);
  if (!ends.length) return Array.from({ length: settings.amount }, () => passage).join(' ');
  const repeats = Math.floor((settings.amount - 1) / ends.length);
  const remainder = (settings.amount - 1) % ends.length;
  // Include punctuation immediately after the last word, but no extra word.
  const nextWord = segments.find((part) => part.index >= ends[remainder] && countable(part));
  const tail = passage.slice(0, nextWord?.index ?? passage.length).trimEnd();
  return [...Array.from({ length: repeats }, () => passage), tail].join(' ');
}

export function makeResult(target: string, typed: string, seconds: number, totalKeystrokes: number, mistakes: number): TestResult {
  const expected = graphemes(target);
  const entered = graphemes(typed);
  const correct = entered.reduce((count, character, index) => count + Number(character === expected[index]), 0);
  const elapsed = Math.max(seconds, 0.1);
  return {
    wpm: Math.round(correct / 5 / (elapsed / 60)),
    raw: Math.round(totalKeystrokes / 5 / (elapsed / 60)),
    accuracy: totalKeystrokes ? Math.round((totalKeystrokes - mistakes) / totalKeystrokes * 100) : 100,
    seconds: Math.round(seconds * 10) / 10,
    correct, incorrect: entered.length - correct, totalKeystrokes, mistakes,
  };
}
