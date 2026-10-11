import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Settings, TextSet, TestResult } from '../shared/types';
import { buildTarget, completedLock, graphemes, makeResult, protectInput, scoreResult, wordBoundaries } from './typing';

export function useTyping(set: TextSet, settings: Settings) {
  const [target, setTarget] = useState(() => buildTarget(set, settings));
  const targetRef = useRef(target);
  const [typed, setTyped] = useState('');
  const typedRef = useRef('');
  const lockedUntil = useRef(0);
  const boundaries = useMemo(() => wordBoundaries(set, target), [set.kind, target]);
  const expectedPoints = useMemo(() => Array.from(target.normalize('NFC')), [target]);
  const [status, setStatus] = useState<'ready' | 'running' | 'done'>('ready');
  const doneRef = useRef(false);
  const started = useRef<number | null>(null);
  const counters = useRef({ total: 0, mistakes: 0 });
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<TestResult | null>(null);

  const finish = useCallback((seconds: number) => {
    if (doneRef.current) return;
    doneRef.current = true;
    setElapsed(seconds);
    setStatus('done');
    setResult(makeResult(targetRef.current, typedRef.current, seconds, counters.current.total, counters.current.mistakes));
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

  const commit = (value: string) => {
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
    const previous = Array.from(typedRef.current);
    const next = Array.from(normalized);
    let prefix = 0;
    while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) prefix++;
    const expected = expectedPoints;
    for (let index = prefix; index < next.length; index++) {
      counters.current.total++;
      if (next[index] !== expected[index]) counters.current.mistakes++;
    }
    typedRef.current = normalized;
    lockedUntil.current = completedLock(boundaries, targetRef.current, normalized, lockedUntil.current);
    setTyped(normalized);
    if (next.length >= expected.length) {
      if (settings.mode !== 'time') finish((performance.now() - started.current!) / 1000);
      else {
        const extended = `${targetRef.current} ${buildTarget(set, settings)}`;
        targetRef.current = extended;
        setTarget(extended);
      }
    }
    return normalized;
  };

  const expected = useMemo(() => graphemes(target), [target]);
  const entered = useMemo(() => graphemes(typed), [typed]);
  const correct = useMemo(() => entered.reduce((count, character, index) => count + Number(character === expected[index]), 0), [expected, entered]);
  const last = entered.length - 1;
  const partial = last >= 0 && expected[last] !== entered[last] && expected[last]?.startsWith(entered[last]);
  const cursor = entered.length - Number(partial);
  const live = scoreResult(correct, entered.length - correct, elapsed, counters.current.total, counters.current.mistakes);
  return { target, typed, expected, entered, cursor, status, elapsed, result, live, lockedUntil: lockedUntil.current, commit };
}
