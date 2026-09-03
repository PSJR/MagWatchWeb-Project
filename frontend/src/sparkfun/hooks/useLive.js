/**
 * Live feed over WebSocket.
 *
 * Blocks land every ~100ms. Rendering per block would make the chart stutter
 * and burn the frame budget, so events are buffered and flushed on an animation
 * frame at most every 250ms — fluidity comes from interpolation, not from
 * render frequency (design/09 § 7).
 */
import { useEffect, useRef, useState } from 'react';
import { liveSocketUrl } from '../lib/api';

const FLUSH_MS = 250;

export function useLive(channel = 'global', { onEvent } = {}) {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const buffer = useRef([]);
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    let ws;
    let closed = false;
    let retry = 0;
    let flushTimer;
    let reconnectTimer;

    const flush = () => {
      if (buffer.current.length) {
        const batch = buffer.current;
        buffer.current = [];
        batch.forEach((e) => handler.current?.(e));
        setEvents((prev) => [...batch.reverse(), ...prev].slice(0, 60));
      }
      flushTimer = setTimeout(() => requestAnimationFrame(flush), FLUSH_MS);
    };

    const open = () => {
      if (closed) return;
      try {
        ws = new WebSocket(liveSocketUrl(channel));
      } catch {
        return;
      }
      ws.onopen = () => { retry = 0; setConnected(true); };
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.type !== 'hello') buffer.current.push(data);
        } catch { /* a malformed frame is not worth breaking the feed over */ }
      };
      ws.onclose = () => {
        setConnected(false);
        if (closed) return;
        retry += 1;
        // Back off, but never past 15s — the feed is the product's pulse.
        reconnectTimer = setTimeout(open, Math.min(15000, 500 * 2 ** retry));
      };
      ws.onerror = () => ws.close();
    };

    open();
    flush();

    return () => {
      closed = true;
      clearTimeout(flushTimer);
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [channel]);

  return { connected, events };
}

/** Simple data hook with loading/error, used by every page. */
export function useAsync(fn, deps = [], { immediate = true } = {}) {
  const [state, setState] = useState({ data: null, loading: immediate, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useRef(async (signal) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current(signal);
      if (!signal?.aborted) setState({ data, loading: false, error: null });
      return data;
    } catch (err) {
      if (err.name === 'AbortError') return undefined;
      setState({ data: null, loading: false, error: err.message || 'Algo deu errado.' });
      return undefined;
    }
  }).current;

  useEffect(() => {
    if (!immediate) return undefined;
    const ac = new AbortController();
    run(ac.signal);
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: () => run(), setData: (data) => setState((s) => ({ ...s, data })) };
}
