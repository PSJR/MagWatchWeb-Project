import React from 'react';
import { Flame } from './mascots';
import { cx } from './ui';
import { money } from '../lib/format';

/**
 * The signature component: how hot the fire is, 0 to 100%.
 * Milestones are drawn as kindling; past 95% the whole bar starts to tremble.
 */
export default function CurveProgress({
  progress = 0, toGraduate = 0, pair = 'ETH', size = 'md', showLabels = true, className = '',
}) {
  const pct = Math.max(0, Math.min(1, progress));
  const almost = pct >= 0.95;
  const done = pct >= 1;
  const height = size === 'sm' ? 'h-[9px]' : 'h-[14px]';

  return (
    <div className={cx('w-full', className)}>
      {showLabels && (
        <div className="flex items-baseline justify-between mb-2 gap-3">
          <span className={cx('disp text-[15px]', done ? 'text-gold-800' : 'text-ink')}>
            {done ? 'Graduou 🔥' : almost ? 'Quase lá… 🔥' : `${Math.round(pct * 100)}% da fogueira`}
          </span>
          {!done && (
            <span className="num text-caption text-ink3 whitespace-nowrap">
              faltam {money(toGraduate, pair)} para graduar
            </span>
          )}
        </div>
      )}

      <div
        className={cx('relative w-full rounded-pill bg-sunken shadow-inner-warm', height,
          almost && !done && 'animate-shake')}
        role="progressbar"
        aria-valuenow={Math.round(pct * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${Math.round(pct * 100)} por cento até a graduação`}
      >
        <div
          className={cx('h-full rounded-pill relative transition-[width] duration-slower ease-out-soft',
            done ? 'bg-[linear-gradient(90deg,var(--gold-500),var(--gold-600))]' : 'bg-grad-ember')}
          style={{ width: `${Math.max(pct * 100, pct > 0 ? 3 : 0)}%` }}
        >
          {pct > 0 && (
            <Flame
              size={size === 'sm' ? 15 : 22}
              className="absolute -right-2 -top-3 origin-bottom animate-flicker"
            />
          )}
        </div>

        {/* Kindling marks at 25 / 50 / 75 */}
        {[0.25, 0.5, 0.75].map((m) => (
          <span
            key={m}
            aria-hidden="true"
            className="absolute top-1/2 -translate-y-1/2 w-px h-[60%] bg-cocoa-600/25"
            style={{ left: `${m * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}
