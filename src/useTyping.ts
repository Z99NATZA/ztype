import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Settings, TextSet, TestResult } from '../shared/types';
import { advanceWord, buildTarget, completedLock, countCompleted, graphemes, protectInput, scoreResult, wordBoundaries, wordCompletionEnds } from './typing';
import { emptyEntry, updateEntry } from './entry';

export function useTyping(set: TextSet, settings: Settings) {
  const [target, setTarget] = useState(() => buildTarget(set, settings));
  const targetRef = useRef(target);
  const [entry, setEntry] = useState(emptyEntry);
  const entryRef = useRef(entry);
  const typed = entry.text;
  const typedRef = useRef('');
  const lockedUntil = useRef(0);
  const boundaries = useMemo(() => wordBoundaries(set, target), [set.kind, target]);
  const expected = useMemo(() => graphemes(target), [target]);
  const wordEnds = useMemo(() => settings.mode === 'words' ? wordCompletionEnds(set, target) : [], [set.kind, target, settings.mode]);
  const correctRef = useRef(0);
  const [status, setStatus] = useState<'ready' | 'running' | 'done'>('ready');
  const doneRef = useRef(false);
  const started = useRef<number | null>(null);
  const counters = useRef({ total: 0, mistakes: 0, skipped: 0 });
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<TestResult | null>(null);

  const finish = useCallback((seconds: number) => {
    if (doneRef.current) return;
    doneRef.current = true;
    setElapsed(seconds);
    setStatus('done');
    setResult(scoreResult(correctRef.current, entryRef.current.characters.length - correctRef.current, seconds, counters.current.total, counters.current.mistakes, counters.current.skipped));
  }, []);

  useEffect(() => {
    if (status !== 'running') return;
    const tick = () => {
      const seconds = (performance.now() - started.current!) / 1000;
      if (settings.mode === 'time' && seconds >= settings.amount) finish(settings.amount);
      else setElapsed(seconds);
    };
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [status, settings.mode, settings.amount, finish]);

  const commit = (value: string, skipped?: number) => {
    if (doneRef.current) return typedRef.current;
    if (started.current !== null && settings.mode === 'time' && (performance.now() - started.current) / 1000 >= settings.amount) {
      finish(settings.amount);
      return typedRef.current;
    }
    const normalized = protectInput(typedRef.current, value.normalize('NFC'), lockedUntil.current);
    if (normalized === typedRef.current) return normalized;
    if (started.current === null && normalized.length) {
      started.current = performance.now();
      setStatus('running');
    }
    const previous = entryRef.current;
    const next = updateEntry(previous, normalized);
    if (skipped !== undefined) {
      counters.current.total++;
      const unmatchedSpace = Number(!normalized.endsWith(' '));
      counters.current.skipped += skipped - unmatchedSpace;
      counters.current.mistakes += unmatchedSpace;
    } else {
      for (let index = next.changedPointFrom; index < next.points.length; index++) {
        counters.current.total++;
        if (next.points[index] !== targetRef.current.slice(next.pointOffsets[index], next.pointOffsets[index + 1])) counters.current.mistakes++;
      }
    }
    for (let index = next.changedFrom; index < previous.characters.length; index++) correctRef.current -= Number(previous.characters[index] === expected[index]);
    for (let index = next.changedFrom; index < next.characters.length; index++) correctRef.current += Number(next.characters[index] === expected[index]);
    entryRef.current = next;
    typedRef.current = normalized;
    lockedUntil.current = completedLock(boundaries, targetRef.current, normalized, lockedUntil.current);
    setEntry(next);
    if (normalized.length >= targetRef.current.length) {
      if (settings.mode !== 'time') finish((performance.now() - started.current!) / 1000);
      else {
        const extended = `${targetRef.current} ${buildTarget(set, settings)}`;
        targetRef.current = extended;
        setTarget(extended);
      }
    }
    return normalized;
  };

  const nextWord = () => {
    const next = advanceWord(boundaries, targetRef.current, typedRef.current);
    return commit(next.text, next.skipped || undefined);
  };

  const entered = entry.characters;
  const correct = correctRef.current;
  const last = entered.length - 1;
  const partial = last >= 0 && expected[last] !== entered[last] && expected[last]?.startsWith(entered[last]);
  const cursor = entered.length - Number(partial);
  const live = scoreResult(correct, entered.length - correct, elapsed, counters.current.total, counters.current.mistakes, counters.current.skipped);
  return { target, typed, expected, entered, cursor, status, elapsed, result, live, completed: countCompleted(wordEnds, typed.length), lockedUntil: lockedUntil.current, lockedCursor: countCompleted(entry.offsets, lockedUntil.current) - 1, commit, nextWord };
}
