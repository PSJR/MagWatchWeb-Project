/**
 * Celebration — confetti and the spark that flies to the chain badge.
 *
 * One shared canvas with an object pool: never DOM nodes, never an allocation
 * per frame. The particle ceiling is 24 everywhere except graduation, which is
 * allowed 160 for under three seconds (design/06-motion.md § 8).
 */
import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';

const CelebrationContext = createContext(null);
export const useCelebration = () => useContext(CelebrationContext) || { burst: () => {}, comet: () => {} };

const COLORS = {
  buy: ['#FF7A2F', '#FFC24D', '#34C98A', '#FF7FA3'],
  sell: ['#FF6B5A', '#FFB3A7', '#8A6A55'],
  gold: ['#FFC24D', '#FFE09A', '#FF7A2F', '#FF5FA2'],
  guava: ['#FF6B5A', '#FF7FA3', '#FFC24D'],
};

export function CelebrationProvider({ children }) {
  const canvasRef = useRef(null);
  const pool = useRef([]);
  const comets = useRef([]);
  const running = useRef(false);
  const reduced = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduced.current = mq.matches;
    const onChange = (e) => { reduced.current = e.matches; };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resize = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = window.innerWidth * dpr;
    c.height = window.innerHeight * dpr;
    c.style.width = `${window.innerWidth}px`;
    c.style.height = `${window.innerHeight}px`;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);

  const tick = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    let alive = 0;
    for (const p of pool.current) {
      if (!p.on) continue;
      alive++;
      p.vy += 0.4;              // gravity, per the motion spec
      p.x += p.vx; p.y += p.vy; p.rot += p.spin; p.life++;
      const t = p.life / p.ttl;
      if (t >= 1) { p.on = false; continue; }
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
      }
      ctx.restore();
    }

    for (const m of comets.current) {
      if (!m.on) continue;
      alive++;
      m.t += 0.045;
      if (m.t >= 1) { m.on = false; continue; }
      // Quadratic Bezier arc with a lifted control point.
      const e = 1 - Math.pow(1 - m.t, 3);
      const x = (1 - e) ** 2 * m.x0 + 2 * (1 - e) * e * m.cx + e * e * m.x1;
      const y = (1 - e) ** 2 * m.y0 + 2 * (1 - e) * e * m.cy + e * e * m.y1;
      m.trail.unshift({ x, y });
      if (m.trail.length > 6) m.trail.pop();
      m.trail.forEach((pt, i) => {
        ctx.save();
        ctx.globalAlpha = (1 - i / 6) * 0.9 * (1 - m.t * 0.4);
        ctx.fillStyle = i === 0 ? '#FFC24D' : '#FF7A2F';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, (6 - i * 0.7) / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    if (alive > 0) {
      requestAnimationFrame(tick);
    } else {
      running.current = false;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
  }, []);

  const start = useCallback(() => {
    if (running.current) return;
    running.current = true;
    requestAnimationFrame(tick);
  }, [tick]);

  const burst = useCallback((el, { tone = 'buy', count = 18 } = {}) => {
    if (reduced.current || !el) return;
    const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : el;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const colors = COLORS[tone] || COLORS.buy;
    const max = tone === 'graduation' ? 160 : 24;
    const n = Math.min(count, max);

    for (let i = 0; i < n; i++) {
      let p = pool.current.find((q) => !q.on);
      if (!p) {
        if (pool.current.length >= 200) break;
        p = {}; pool.current.push(p);
      }
      // 120-degree fan, upward
      const angle = (-150 + Math.random() * 120) * (Math.PI / 180);
      const speed = 5 + Math.random() * 6;
      Object.assign(p, {
        on: true, x: cx, y: cy,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 0.5,
        size: 7 + Math.random() * 5, color: colors[i % colors.length],
        round: i % 3 === 0, life: 0, ttl: 44 + Math.random() * 16,
      });
    }
    start();
  }, [start]);

  /** The signature move: a spark flies from the button to the chain badge. */
  const comet = useCallback((fromEl, toSelector = '[data-chain-badge]') => {
    if (reduced.current || !fromEl) return;
    const to = document.querySelector(toSelector);
    if (!to) return;
    const a = fromEl.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
    const x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;

    let m = comets.current.find((q) => !q.on);
    if (!m) { m = {}; comets.current.push(m); }
    Object.assign(m, {
      on: true, t: 0, x0, y0, x1, y1,
      cx: (x0 + x1) / 2, cy: Math.min(y0, y1) - 120, trail: [],
    });
    start();
  }, [start]);

  return (
    <CelebrationContext.Provider value={{ burst, comet }}>
      {children}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 700 }}
      />
    </CelebrationContext.Provider>
  );
}
