/**
 * Core primitives. Everything pressable carries the Squish Lip — a 3px solid
 * bottom edge that disappears on press, so the UI reads as a physical toy
 * rather than coloured rectangles (design/03-design-tokens.md § 3.1).
 */
import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { Ember } from '../mascots';

export const cx = (...parts) => parts.filter(Boolean).join(' ');

// --------------------------------------------------------------------------
// Button
// --------------------------------------------------------------------------

const VARIANTS = {
  primary: 'bg-grad-ember text-[var(--text-on-primary)] shadow-[0_3px_0_var(--accent-deep)] hover:shadow-[0_4px_0_var(--accent-deep),var(--glow-ember)]',
  buy: 'bg-grad-buy text-white shadow-[0_3px_0_var(--buy-lip)] hover:shadow-[0_4px_0_var(--buy-lip),var(--glow-mint)]',
  sell: 'bg-grad-sell text-white shadow-[0_3px_0_var(--sell-lip)] hover:shadow-[0_4px_0_var(--sell-lip)]',
  secondary: 'bg-surface text-ink shadow-[0_3px_0_var(--border-strong)] hover:shadow-[0_4px_0_var(--border-strong)]',
  ghost: 'bg-transparent text-ink hover:bg-accent-soft shadow-none',
  mayhem: 'bg-grad-mayhem bg-[length:300%_100%] animate-mayhem text-white shadow-[0_3px_0_var(--wild-600)] hover:shadow-[0_4px_0_var(--wild-600),var(--glow-mayhem)]',
  gold: 'text-cocoa-900 shadow-[0_3px_0_var(--gold-600)] hover:shadow-[0_4px_0_var(--gold-600),var(--glow-gold)] bg-[linear-gradient(180deg,var(--gold-300),var(--gold-500))]',
};

const SIZES = {
  sm: 'h-8 px-3 text-[13px] rounded-md',
  md: 'h-10 px-4 text-[13px] rounded-lg',
  lg: 'h-12 px-5 text-[14px] rounded-lg',
  xl: 'h-14 px-6 text-[15px] rounded-lg',
};

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'lg', loading = false, success = false, full = false,
    className = '', children, disabled, ...rest },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cx(
        'relative inline-flex items-center justify-center gap-2 font-sans font-bold',
        'transition-[transform,box-shadow] duration-fast ease-out-soft',
        'hover:-translate-y-px active:translate-y-[3px] active:!shadow-none',
        'disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none',
        SIZES[size], VARIANTS[success ? 'buy' : variant], full && 'w-full', className,
      )}
      {...rest}
    >
      {loading ? <Sparks /> : children}
    </button>
  );
});

/** Loading indicator: three sparks that resolve into a flame. Never a spinner. */
function Sparks() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-pill bg-current animate-bob"
          style={{ animationDelay: `${i * 120}ms`, animationDuration: '900ms' }}
        />
      ))}
    </span>
  );
}

// --------------------------------------------------------------------------
// Surfaces
// --------------------------------------------------------------------------

export function Card({ as: As = 'div', interactive = false, className = '', children, ...rest }) {
  return (
    <As
      className={cx(
        'bg-surface border border-subtle rounded-xl shadow-sm',
        interactive &&
          'transition-[transform,box-shadow,border-color] duration-base ease-out-soft ' +
          'hover:-translate-y-[3px] hover:shadow-md hover:border-strong active:translate-y-0',
        className,
      )}
      {...rest}
    >
      {children}
    </As>
  );
}

export function Tag({ tone = 'neutral', className = '', children }) {
  const tones = {
    neutral: 'bg-sunken text-ink3',
    mayhem: 'bg-wild-100 text-wild-800',
    graduated: 'bg-gold-100 text-gold-800',
    dead: 'bg-ash-100 text-ash-600',
    new: 'bg-ember-100 text-ember-800',
    up: 'bg-mint-100 text-mint-800',
    down: 'bg-coral-100 text-coral-800',
    chain: 'bg-orbit-100 text-orbit-700',
  };
  return (
    <span className={cx(
      'inline-flex items-center gap-1 rounded-pill px-2.5 py-1',
      'text-[10px] font-bold uppercase tracking-[.07em] whitespace-nowrap',
      tones[tone] || tones.neutral, className,
    )}>
      {children}
    </span>
  );
}

// --------------------------------------------------------------------------
// Field
// --------------------------------------------------------------------------

export function Field({
  label, hint, error, prefix, suffix, maxLength, value = '', className = '',
  as = 'input', ...rest
}) {
  const As = as;
  const count = String(value).length;
  const near = maxLength && count >= maxLength * 0.8;

  return (
    <label className={cx('block', className)}>
      {label && (
        <span className="flex items-baseline justify-between mb-1.5">
          <span className="text-label font-semibold text-ink">{label}</span>
          {maxLength && (
            <span className={cx('num text-caption', near ? 'text-ember-700' : 'text-ink3')}>
              {count}/{maxLength}
            </span>
          )}
        </span>
      )}
      <span
        className={cx(
          'flex items-center gap-2 bg-sunken rounded-md shadow-inner-warm',
          'border transition-colors duration-base ease-out-soft',
          'focus-within:border-accent focus-within:shadow-[var(--shadow-inner-warm),var(--glow-ember)]',
          error ? 'border-coral-500 animate-shake' : 'border-subtle',
          as === 'textarea' ? 'px-3 py-2.5' : 'h-12 px-3',
        )}
      >
        {prefix && <span className="text-ink3 font-num text-sm shrink-0">{prefix}</span>}
        <As
          value={value}
          maxLength={maxLength}
          aria-invalid={error ? 'true' : undefined}
          className={cx(
            'flex-1 min-w-0 bg-transparent outline-none text-ink placeholder:text-ink3/70',
            as === 'textarea' && 'resize-none leading-relaxed',
          )}
          {...rest}
        />
        {suffix}
      </span>
      {/* Height is reserved so an error never shifts the layout. */}
      <span className={cx('block min-h-[18px] mt-1 text-caption',
        error ? 'text-coral-800' : 'text-ink3')}>
        {error || hint || ''}
      </span>
    </label>
  );
}

export function Toggle({ checked, onChange, label, disabled, tone = 'ember' }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative w-[52px] h-[30px] rounded-pill transition-colors duration-fast shrink-0',
        'disabled:opacity-45',
        checked ? (tone === 'mayhem' ? 'bg-grad-mayhem bg-[length:300%_100%] animate-mayhem' : 'bg-grad-ember') : 'bg-sand-300',
      )}
    >
      <span
        className={cx(
          'absolute top-0.5 w-[26px] h-[26px] rounded-pill bg-white shadow-sm',
          'transition-transform duration-fast ease-pop',
          checked ? 'translate-x-[24px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

// --------------------------------------------------------------------------
// Feedback states
// --------------------------------------------------------------------------

export function Skeleton({ className = '', rounded = 'rounded-md' }) {
  return (
    <span
      className={cx(
        'block bg-sunken relative overflow-hidden animate-sheen', rounded, className,
        'bg-[linear-gradient(100deg,transparent_20%,var(--accent-soft)_45%,transparent_70%)]',
        'bg-[length:220%_100%]',
      )}
      aria-hidden="true"
    />
  );
}

export function EmptyState({ mood = 'idle', title, body, action, className = '' }) {
  return (
    <div className={cx('flex flex-col items-center text-center py-12 px-6', className)}>
      <Ember size={84} mood={mood} className="animate-bob mb-3" />
      <h3 className="text-heading-md text-ink">{title}</h3>
      {body && <p className="text-ink3 text-sm mt-1.5 max-w-[34ch]">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children, onRetry }) {
  return (
    <div className="flex items-center gap-3 bg-ember-100 border border-ember-200 rounded-lg px-4 py-3">
      <Ember size={36} mood="worried" />
      <p className="flex-1 text-sm text-ink2">{children}</p>
      {onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

// --------------------------------------------------------------------------
// Numbers
// --------------------------------------------------------------------------

/**
 * A number that rolls to its new value and flashes in the direction it moved.
 * Size never changes — only colour — because a growing number reflows.
 */
export function LiveNumber({ value, format, className = '', flash = true }) {
  const [dir, setDir] = useState(null);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) return;
    if (flash && Number.isFinite(value) && Number.isFinite(prev.current)) {
      setDir(value > prev.current ? 'up' : 'down');
      const t = setTimeout(() => setDir(null), value > prev.current ? 300 : 420);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value, flash]);

  return (
    <span
      className={cx('num transition-colors', className)}
      style={dir ? { backgroundColor: dir === 'up' ? 'var(--mint-100)' : 'var(--coral-100)', borderRadius: 6 } : undefined}
    >
      {format ? format(value) : value}
    </span>
  );
}

/** Counts up on mount — used by the big profile stat cards. */
export function CountUp({ value, format, duration = 600, className = '' }) {
  const [shown, setShown] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return undefined;
    }
    const from = 0;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out-soft
      setShown(from + (value - from) * eased);
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);

  return <span className={cx('num', className)}>{format ? format(shown) : Math.round(shown)}</span>;
}
