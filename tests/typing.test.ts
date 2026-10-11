import { describe, expect, it } from 'vitest';
import { bankWords, buildTarget, completedWords, graphemes, makeResult, wordCount } from '../src/typing';
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
