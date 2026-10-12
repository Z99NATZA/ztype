import { describe, expect, it } from 'vitest';
import { advanceWord, bankWords, buildTarget, completedLock, completedWords, graphemes, makeResult, protectInput, scoreResult, wordBoundaries, wordCount } from '../src/typing';
import type { TextSet } from '../shared/types';

const set = (content: string, kind: 'passage' | 'words' = 'passage'): TextSet => ({
  id: 'test', name: 'test', kind, content, createdAt: '', updatedAt: '',
});

describe('practice targets', () => {
  it('keeps punctuation and cycles passages to the exact requested word count', () => {
    const target = buildTarget(set('one, two. three!'), { setId: 'test', mode: 'words', amount: 5 });
    expect(target).toBe('one, two. three! one, two.');
    expect(wordCount(target)).toBe(5);
  });
  it('counts Thai words without requiring spaces', () => {
    const target = buildTarget(set('วันนี้อากาศดี'), { setId: 'test', mode: 'words', amount: 7 });
    expect(wordCount(target)).toBe(7);
  });
  it('does not remove passage punctuation in time mode', () => {
    expect(buildTarget(set('Hello!\n\nHow are you?'), { setId: 'test', mode: 'time', amount: 30 })).toBe('Hello! How are you?');
  });
  it('samples only the saved word bank and respects the requested item count', () => {
    const target = buildTarget(set('hello, world\nสวัสดี', 'words'), { setId: 'test', mode: 'words', amount: 10 }, () => 0.99);
    expect(bankWords(target)).toHaveLength(10);
    expect(new Set(bankWords(target))).toEqual(new Set(['สวัสดี']));
  });
  it('handles empty banks and symbol-only passages', () => {
    expect(buildTarget(set(' , ', 'words'), { setId: 'test', mode: 'words', amount: 5 })).toBe('');
    expect(buildTarget(set('...'), { setId: 'test', mode: 'words', amount: 2 })).toBe('... ...');
  });
  it('does not let incorrect spaces skip word progress', () => {
    expect(completedWords(set('alpha beta gamma', 'words'), 'alpha beta gamma', '     ')).toBe(0);
    expect(completedWords(set('alpha beta gamma', 'words'), 'alpha beta gamma', 'alpha ')).toBe(1);
  });
  it('keeps the original passage exactly once, with spacing and line breaks', () => {
    expect(buildTarget(set('one  two\r\n\r\nthree\tfour.'), { setId: 'test', mode: 'original', amount: 100 })).toBe('one  two\n\nthree\tfour.');
  });
});

describe('Spacebar word navigation', () => {
  it.each([
    ['alpha beta', 'al', 'words'],
    ['alpha beta', 'ax', 'passage'],
    ['one, two', 'on', 'passage'],
    ['ที่ ดี', '', 'words'],
    ['ที่ ดี', 'ท', 'words'],
    ['👩‍💻 next', '', 'words'],
    ['👩‍💻 next', '', 'passage'],
    ['é next', '', 'words'],
    ['วันนี้อากาศดี', 'วัน', 'passage'],
  ] as const)('aligns skipped characters in %s after %s', (target, typed, kind) => {
    const boundaries = wordBoundaries(set(target, kind), target);
    const next = advanceWord(boundaries, target, typed);
    const end = boundaries.find((boundary) => boundary.end > typed.length)!.end;
    expect(next.text.startsWith(typed)).toBe(true);
    expect(next.text.length).toBe(end);
    expect(next.text.normalize('NFC')).toBe(next.text);
    expect(graphemes(next.text)).toHaveLength(graphemes(target.slice(0, end)).length);
    expect(next.skipped).toBeGreaterThan(0);
    expect(next.text).not.toBe(target.slice(0, end));
  });
  it('preserves ordinary spaces, including repeated original whitespace', () => {
    const target = 'one  two';
    const boundaries = wordBoundaries(set(target), target);
    expect(advanceWord(boundaries, target, 'one')).toEqual({ text: 'one ', skipped: 0 });
    expect(advanceWord(boundaries, target, 'one ')).toEqual({ text: 'one  ', skipped: 0 });
  });
  it('can skip the last word and stops at the target end', () => {
    const target = 'one two';
    const boundaries = wordBoundaries(set(target), target);
    const next = advanceWord(boundaries, target, 'one t');
    expect(next.text.length).toBe(target.length);
    expect(next.skipped).toBe(2);
    expect(advanceWord(boundaries, target, next.text)).toEqual({ text: next.text, skipped: 0 });
  });
  it('penalizes skipped characters without inflating raw speed', () => {
    expect(scoreResult(6, 3, 60, 6, 0, 3)).toMatchObject({ correct: 6, incorrect: 3, wpm: 1, raw: 1, accuracy: 67, totalKeystrokes: 6, mistakes: 3 });
  });
});

describe('committed words', () => {
  it('locks correct words with punctuation after their separator', () => {
    const target = 'one, two three';
    const boundaries = wordBoundaries(set(target), target);
    expect(completedLock(boundaries, target, 'one,', 0)).toBe(0);
    expect(completedLock(boundaries, target, 'one, ', 0)).toBe(5);
    expect(protectInput('one, tw', 'one, ', 5)).toBe('one, ');
    expect(protectInput('one, ', 'one,', 5)).toBe('one, ');
  });
  it('allows correction of incorrect words before committing them', () => {
    const target = 'one two three';
    const boundaries = wordBoundaries(set(target), target);
    expect(completedLock(boundaries, target, 'oxe ', 0)).toBe(0);
    expect(protectInput('oxe ', 'ox', 0)).toBe('ox');
    expect(completedLock(boundaries, target, 'one ', 0)).toBe(4);
  });
  it('clamps whole-word deletion and rejects replacement of a locked prefix', () => {
    expect(protectInput('one tw', '', 4)).toBe('one ');
    expect(protectInput('one tw', 'oxe tw', 4)).toBe('one tw');
  });
  it('locks Thai words without a space and preserves combining marks', () => {
    const target = 'วันนี้อากาศดี';
    const boundaries = wordBoundaries(set(target), target);
    const lock = completedLock(boundaries, target, 'วันนี้', 0);
    expect(lock).toBe('วันนี้'.length);
    expect(protectInput('วันนี้', 'วันนี', lock)).toBe('วันนี้');
  });
  it('treats word-bank entries as whole words and locks paragraph breaks', () => {
    const bank = 'ความสุข ดี';
    expect(completedLock(wordBoundaries(set(bank, 'words'), bank), bank, 'ความสุข ', 0)).toBe('ความสุข '.length);
    const passage = 'one\n\ntwo';
    expect(completedLock(wordBoundaries(set(passage), passage), passage, 'one\n\n', 0)).toBe(5);
  });
});

describe('unicode and scoring', () => {
  it('keeps combining Thai marks and emoji inside their grapheme', () => {
    expect(graphemes('ที่')).toEqual(['ที่']);
    expect(graphemes('👩‍💻')).toEqual(['👩‍💻']);
    expect(graphemes('e\u0301')).toEqual(['é']);
  });
  it('keeps corrected mistakes in accuracy while scoring the final text', () => {
    const result = makeResult('hello world', 'hello world', 60, 13, 2);
    expect(result).toMatchObject({ wpm: 2, raw: 3, accuracy: 85, correct: 11, incorrect: 0, mistakes: 2 });
  });
  it('does not reward incorrect final characters or create infinite speed', () => {
    expect(makeResult('hello', 'hxllo', 60, 5, 1)).toMatchObject({ correct: 4, incorrect: 1, accuracy: 80 });
    expect(Number.isFinite(makeResult('a', 'a', 0, 1, 0).wpm)).toBe(true);
  });
});
