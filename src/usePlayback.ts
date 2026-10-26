import { useCallback, useEffect, useRef, useState } from 'react';

/** One elapsed-time clock drives the SVG, readings and stage transitions together. */
export function usePlayback(duration = Infinity, autoStart = false) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(autoStart);
  const [started, setStarted] = useState(autoStart);
  const elapsedRef = useRef(0);
  const runningRef = useRef(autoStart);
  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => {
    if (!running) return;
    let id: number, previous = performance.now(), lastPaint = previous;
    const tick = (now: number) => {
      if (!runningRef.current) return;
      // Hidden tabs pause instead of skipping entire stages after returning.
      const delta = Math.min((now - previous) / 1000, .15); previous = now;
      elapsedRef.current = Math.min(duration, elapsedRef.current + delta);
      if (now - lastPaint >= 45 || elapsedRef.current >= duration) {
        setElapsed(elapsedRef.current); lastPaint = now;
      }
      if (elapsedRef.current >= duration) { setRunning(false); runningRef.current = false; }
      else id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [running, duration]);
  const play = useCallback(() => {
    if (elapsedRef.current >= duration) { elapsedRef.current = 0; setElapsed(0); }
    setStarted(true); runningRef.current = true; setRunning(true);
  }, [duration]);
  const pause = useCallback(() => { runningRef.current = false; setRunning(false); setElapsed(elapsedRef.current); }, []);
  const replay = useCallback(() => {
    elapsedRef.current = 0; setElapsed(0); setStarted(true); runningRef.current = true; setRunning(true);
  }, []);
  return { elapsed, running, started, play, pause, replay };
}
