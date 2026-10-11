import { describe, expect, it } from 'vitest';
import { emptyEntry, updateEntry } from '../src/entry';
import { graphemes } from '../src/typing';

function verifySequence(values: string[]) {
  let entry = emptyEntry();
  for (const value of values) {
    const previous = entry;
    entry = updateEntry(entry, value);
    expect(entry.text).toBe(value.normalize('NFC'));
    expect(entry.characters).toEqual(graphemes(value));
    expect(entry.points).toEqual(Array.from(value.normalize('NFC')));
    expect(entry.offsets).toEqual([0, ...entry.characters.map((_character, index) => entry.characters.slice(0, index + 1).join('').length)]);
    expect(entry.pointOffsets).toEqual([0, ...entry.points.map((_point, index) => entry.points.slice(0, index + 1).join('').length)]);
    expect(entry.characters.slice(0, entry.changedFrom)).toEqual(previous.characters.slice(0, entry.changedFrom));
  }
}

describe('incremental input segmentation', () => {
  it('handles Thai combining marks, corrections and backward deletion', () => {
    verifySequence(['ท', 'ที', 'ที่', 'ที่ ', 'ที่ ด', 'ที่ ดี', 'ที่ ด', 'ที่ ', 'ที่ มี', 'ที่ มี ใจ', '', 'วันนี้อากาศดี']);
  });
  it('handles normalization, surrogate pairs and emoji joining existing glyphs', () => {
    const target = 'cafe\u0301 👩‍💻 🇹🇭🇺🇸🇫🇷 ก่้';
    verifySequence([...Array.from({ length: target.length }, (_, index) => target.slice(0, index + 1)), ...Array.from({ length: target.length }, (_, index) => target.slice(0, target.length - index - 1))]);
  });
  it('repairs edits at the beginning, middle and end of text', () => {
    verifySequence(['hello world', 'hxllo world', 'hello world', 'hello โลก', 'hello โลก!', '👩‍💻 hello โลก!', 'hello โลก!']);
  });
  it('matches complete segmentation through deterministic mixed edits', () => {
    const pieces = ['a', ' ', 'ท', 'ี', '่', 'e', '\u0301', '👩', '\u200d', '💻', '🇹', '🇭', '\n'];
    let seed = 12345;
    let text = '';
    const values: string[] = [];
    for (let index = 0; index < 150; index++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      if (seed % 5 === 0) text = text.slice(0, Math.max(0, text.length - seed % 4 - 1));
      else text += pieces[seed % pieces.length];
      values.push(text);
    }
    verifySequence(values);
  });
});
