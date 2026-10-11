import { graphemes } from './typing';

export interface Entry {
  text: string;
  characters: string[];
  offsets: number[];
  points: string[];
  pointOffsets: number[];
  changedFrom: number;
  changedPointFrom: number;
}

export const emptyEntry = (): Entry => ({ text: '', characters: [], offsets: [0], points: [], pointOffsets: [0], changedFrom: 0, changedPointFrom: 0 });

function repair(segments: string[], offsets: number[], text: string, prefix: number, split: (text: string) => string[]) {
  let low = 0;
  let high = offsets.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (offsets[middle] < prefix) low = middle + 1;
    else high = middle;
  }
  // Keep two preceding groups: completing a split surrogate can also join a ZWJ group.
  const from = Math.max(0, low - 2);
  const tail = split(text.slice(offsets[from]));
  const next = segments.slice(0, from).concat(tail);
  const nextOffsets = offsets.slice(0, from + 1);
  let offset = offsets[from];
  for (const segment of tail) { offset += segment.length; nextOffsets.push(offset); }
  let changedFrom = from;
  while (changedFrom < segments.length && changedFrom < next.length && segments[changedFrom] === next[changedFrom]) changedFrom++;
  return { segments: next, offsets: nextOffsets, changedFrom };
}

/** Re-segment the changed tail with preceding Unicode boundary context. */
export function updateEntry(previous: Entry, value: string): Entry {
  const text = value.normalize('NFC');
  if (text === previous.text) return previous;
  let prefix = 0;
  const length = Math.min(previous.text.length, text.length);
  while (prefix < length && previous.text.charCodeAt(prefix) === text.charCodeAt(prefix)) prefix++;
  const characters = repair(previous.characters, previous.offsets, text, prefix, graphemes);
  const points = repair(previous.points, previous.pointOffsets, text, prefix, Array.from);
  return { text, characters: characters.segments, offsets: characters.offsets, points: points.segments, pointOffsets: points.offsets, changedFrom: characters.changedFrom, changedPointFrom: points.changedFrom };
}
