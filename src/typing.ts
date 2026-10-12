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

export interface WordBoundary { start: number; end: number }

/** A word is committed after its separator, or at the next Thai word boundary. */
export function wordBoundaries(set: TextSet, target: string): WordBoundary[] {
  const starts = set.kind === 'words'
    ? Array.from(target.matchAll(/\S+/gu), (match) => match.index)
    : Array.from(wordSegmenter.segment(target)).filter((part) =>
      part.isWordLike || (!/\s/u.test(part.segment) && /\p{Extended_Pictographic}|\p{S}/u.test(part.segment)),
    ).map((part) => part.index);
  return starts.map((start, index) => ({ start, end: starts[index + 1] ?? target.length }));
}

/** Keep skipped graphemes aligned with the target without crediting them as typed. */
export function advanceWord(boundaries: WordBoundary[], target: string, typed: string): { text: string; skipped: number } {
  if (/\s/u.test(target[typed.length] ?? '')) return { text: typed + ' ', skipped: 0 };
  const end = boundaries.find((boundary) => boundary.end > typed.length)?.end ?? target.length;
  if (end <= typed.length) return { text: typed, skipped: 0 };
  const separator = target[end - 1] === ' ' ? ' ' : '';
  const missing = Array.from(graphemeSegmenter.segment(target.slice(0, end - separator.length)))
    .filter((part) => part.index + part.segment.length > typed.length);
  // Combining Grapheme Joiners preserve both grapheme count and UTF-16 offsets,
  // including Thai marks and surrogate pairs, without changing under NFC.
  const padding = missing.map((part) => part.index < typed.length
    ? '\u034F'.repeat(part.index + part.segment.length - typed.length)
    : '\uFFFD' + '\u034F'.repeat(part.segment.length - 1)).join('');
  return { text: typed + padding + separator, skipped: missing.length };
}

export function completedLock(boundaries: WordBoundary[], target: string, typed: string, previousLock: number): number {
  let lock = previousLock;
  let low = 0;
  let high = boundaries.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (boundaries[middle].end <= previousLock) low = middle + 1;
    else high = middle;
  }
  for (let index = low; index < boundaries.length; index++) {
    const boundary = boundaries[index];
    if (boundary.end > typed.length) break;
    if (boundary.end > previousLock && typed.slice(boundary.start, boundary.end) === target.slice(boundary.start, boundary.end)) lock = boundary.end;
  }
  return lock;
}

export function wordCompletionEnds(set: TextSet, target: string): number[] {
  if (set.kind === 'words') return [...Array.from(target.matchAll(/ /g), (match) => match.index + 1), target.length];
  return Array.from(wordSegmenter.segment(target)).filter((part) =>
    part.isWordLike || (!/\s/u.test(part.segment) && /\p{Extended_Pictographic}|\p{S}/u.test(part.segment)),
  ).map((part) => part.index + part.segment.length);
}

export function countCompleted(ends: number[], length: number): number {
  let low = 0;
  let high = ends.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (ends[middle] <= length) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** Clamp backward deletion; reject replacements of an already committed prefix. */
export function protectInput(previous: string, next: string, lock: number): string {
  if (next.startsWith(previous.slice(0, lock))) return next;
  if (previous.startsWith(next)) return previous.slice(0, lock);
  return previous;
}

/** Keep passage punctuation and order; repeat only when the requested size exceeds the passage. */
export function buildTarget(set: TextSet, settings: Settings, random = Math.random): string {
  if (set.kind === 'passage' && settings.mode === 'original') return set.content.normalize('NFC').replace(/\r\n?/g, '\n');
  if (set.kind === 'words') {
    const words = bankWords(set.content.normalize('NFC'));
    if (!words.length) return '';
    const count = settings.mode === 'words' ? settings.amount : 120;
    return Array.from({ length: count }, () => words[Math.min(words.length - 1, Math.floor(random() * words.length))]).join(' ');
  }
  const passage = set.content.normalize('NFC').trim().replace(/\s+/gu, ' ');
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
  return scoreResult(correct, entered.length - correct, seconds, totalKeystrokes, mistakes);
}

export function scoreResult(correct: number, incorrect: number, seconds: number, totalKeystrokes: number, mistakes: number, skipped = 0): TestResult {
  const elapsed = Math.max(seconds, 0.1);
  return {
    wpm: Math.round(correct / 5 / (elapsed / 60)),
    raw: Math.round(totalKeystrokes / 5 / (elapsed / 60)),
    accuracy: totalKeystrokes + skipped ? Math.round((totalKeystrokes - mistakes) / (totalKeystrokes + skipped) * 100) : 100,
    seconds: Math.round(seconds * 10) / 10,
    correct, incorrect, totalKeystrokes, mistakes: mistakes + skipped,
  };
}
