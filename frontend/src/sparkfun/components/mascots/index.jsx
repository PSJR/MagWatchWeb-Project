/**
 * Mascots — the emotional feedback system, not decoration.
 * Every mascot is aria-hidden: the state it expresses is always available as
 * text and number elsewhere on screen (design/07-mascots.md § 7).
 */
import React from 'react';
import { hashCode } from '../../lib/format';

// Outline only — deliberately carries no `fill`. An earlier version did, and
// because it is spread after the `fill` prop it silently blanked every mascot.
const stroke = { stroke: 'rgba(74,54,43,.45)', strokeWidth: 2.5 };
const outline = { ...stroke, fill: 'none' };

/** Ember — the host. A pot-bellied flame in a wool scarf. */
export function Ember({ size = 72, mood = 'idle', className = '' }) {
  const sleepy = mood === 'sleepy' || mood === 'soot';
  const soot = mood === 'soot';
  const worried = mood === 'worried';
  const happy = mood === 'happy' || mood === 'cheer';

  return (
    <svg
      width={size} height={size * (86 / 76)} viewBox="0 0 76 86" aria-hidden="true"
      className={className}
    >
      <path
        d="M38 6c5 16 22 21 22 40a22 22 0 1 1-44 0c0-9 5-14 9.5-21 2.4 6 6.5 6.5 6.5 13 4-8 6-20 6-32z"
        fill={soot ? 'var(--ash-400)' : 'var(--ember-400)'} {...stroke}
      />
      <path
        d="M38 34c3 7 9 10 9 17a9 9 0 1 1-18 0c0-7 6-10 9-17z"
        fill={soot ? 'var(--ash-100)' : 'var(--gold-500)'}
      />
      {sleepy ? (
        <>
          <path d="M25 52q5 4 10 0" {...outline} strokeWidth={2.4} />
          <path d="M41 52q5 4 10 0" {...outline} strokeWidth={2.4} />
        </>
      ) : (
        <>
          <ellipse cx="30" cy="52" rx="5" ry={worried ? 6.5 : 6} fill="var(--cocoa-900)" />
          <ellipse cx="46" cy="52" rx="5" ry={worried ? 6.5 : 6} fill="var(--cocoa-900)" />
          <circle cx="31.6" cy="49.6" r="1.8" fill="#fff" />
          <circle cx="47.6" cy="49.6" r="1.8" fill="#fff" />
        </>
      )}
      <ellipse cx="22" cy="61" rx="4.5" ry="3" fill="var(--guava-300)" opacity=".55" />
      <ellipse cx="54" cy="61" rx="4.5" ry="3" fill="var(--guava-300)" opacity=".55" />
      <path
        d={happy ? 'M31 61q7 8 14 0' : worried ? 'M32 65q6-5 12 0' : 'M32 62q6 5 12 0'}
        {...outline} strokeWidth={2.5} strokeLinecap="round"
      />
      <path
        d="M18 70q20 8 40 0l-2 7q-18 7-36 0z"
        fill="var(--guava-300)" stroke="rgba(74,54,43,.35)" strokeWidth={2}
      />
      {mood === 'sleepy' && (
        <text x="58" y="26" fontSize="13" fill="var(--cocoa-600)" fontFamily="Caveat, cursive">
          zZz
        </text>
      )}
    </svg>
  );
}

const PIP_BODIES = ['#9BE7C4', '#FFC0CF', '#FFAC6E', '#C7B0FF', '#8FE2DC', '#FFE09A', '#FFB3A7', '#B6A8FF'];
const PIP_HATS = ['none', 'beanie', 'scarf', 'glasses', 'bow', 'chef', 'bandana', 'flowers'];

/**
 * Pip — the trader's profile mascot, generated from the wallet address.
 * 4,096 combinations from body colour x accessory x eye shape x pattern.
 */
export function Pip({ seed = '', size = 76, pnl = 0, mood, className = '' }) {
  const h = hashCode(seed || 'sparkfun');
  const body = PIP_BODIES[h % PIP_BODIES.length];
  const hat = PIP_HATS[Math.floor(h / 8) % PIP_HATS.length];
  const wide = Math.floor(h / 64) % 2 === 0;

  const state = mood || (pnl > 0.5 ? 'ecstatic' : pnl > 0 ? 'happy' : pnl < -0.5 ? 'cozy' : pnl < 0 ? 'sad' : 'neutral');
  const glow = state === 'ecstatic' ? 1 : state === 'happy' ? 0.85 : state === 'neutral' ? 0.6 : 0.3;
  const sad = state === 'sad' || state === 'cozy';

  return (
    <svg
      width={size} height={size * (86 / 76)} viewBox="0 0 76 86" aria-hidden="true"
      className={className}
    >
      <ellipse cx="38" cy="74" rx="16" ry="6" fill="var(--gold-500)" opacity={0.28 * glow} />
      <ellipse cx="20" cy="40" rx="12" ry="16" fill="var(--orbit-300)" opacity=".45" transform="rotate(-22 20 40)" />
      <ellipse cx="56" cy="40" rx="12" ry="16" fill="var(--orbit-300)" opacity=".45" transform="rotate(22 56 40)" />
      <circle cx="38" cy="44" r="21" fill={body} {...stroke} />
      <circle cx="38" cy="60" r="10" fill="var(--gold-500)" opacity={glow} />

      {state === 'cozy' && (
        <path d="M17 48q21 -8 42 0l1 18q-22 8-44 0z" fill="var(--guava-300)" opacity=".85"
              stroke="rgba(74,54,43,.35)" strokeWidth={2} />
      )}

      <ellipse cx="31" cy={sad ? 43 : 41} rx={wide ? 5 : 4.5} ry="5.5" fill="var(--cocoa-900)" />
      <ellipse cx="45" cy={sad ? 43 : 41} rx={wide ? 5 : 4.5} ry="5.5" fill="var(--cocoa-900)" />
      <circle cx="32.4" cy={sad ? 40.8 : 38.8} r="1.6" fill="#fff" />
      <circle cx="46.4" cy={sad ? 40.8 : 38.8} r="1.6" fill="#fff" />
      <path
        d={sad ? 'M33 53q5-4 10 0' : 'M33 50q5 4 10 0'}
        {...outline} strokeWidth={2.4} strokeLinecap="round"
      />

      {hat === 'beanie' && <path d="M25 27q13-11 26 0z" fill="var(--ember-500)" />}
      {hat === 'scarf' && <path d="M26 26q12-10 24 0" stroke="var(--ember-500)" strokeWidth={5} fill="none" strokeLinecap="round" />}
      {hat === 'glasses' && (
        <g stroke="var(--cocoa-800)" strokeWidth={2} fill="none">
          <circle cx="31" cy="41" r="8" /><circle cx="45" cy="41" r="8" /><path d="M39 41h-2" />
        </g>
      )}
      {hat === 'bow' && <path d="M30 24l8 5-8 5zM46 24l-8 5 8 5z" fill="var(--guava-500)" />}
      {hat === 'chef' && <ellipse cx="38" cy="22" rx="13" ry="8" fill="#FFF4E6" stroke="rgba(74,54,43,.35)" strokeWidth={2} />}
      {hat === 'bandana' && <path d="M25 28q13-6 26 0l-2 5q-11-4-22 0z" fill="var(--wild-500)" />}
      {hat === 'flowers' && (
        <g fill="var(--guava-500)">
          <circle cx="28" cy="24" r="3.5" /><circle cx="38" cy="21" r="3.5" /><circle cx="48" cy="24" r="3.5" />
        </g>
      )}
    </svg>
  );
}

const LEVEL_COLORS = {
  bronze: '#C88A5A', silver: '#B9C2CC', gold: 'var(--gold-500)',
  platinum: 'var(--orbit-300)', diamond: '#B6A8FF',
};

/** Cinder — the creator's mascot. Evolves with level. */
export function Cinder({ level = 'bronze', size = 76, className = '' }) {
  const color = LEVEL_COLORS[level] || LEVEL_COLORS.bronze;
  const tier = ['bronze', 'silver', 'gold', 'platinum', 'diamond'].indexOf(level);
  const sparks = [0, 2, 2, 4, 8][Math.max(0, tier)];

  return (
    <svg width={size} height={size * (86 / 76)} viewBox="0 0 76 86" aria-hidden="true" className={className}>
      <path d="M20 76h36l-4-10H24z" fill="var(--cocoa-600)" />
      <path d="M38 18c9 0 16 9 16 22 0 14-7 26-16 26s-16-12-16-26c0-13 7-22 16-22z" fill={color} {...stroke} />
      <path d="M38 8c2 5 6 6 6 10h-12c0-4 4-5 6-10z" fill="var(--gold-500)" />
      <ellipse cx="31" cy="44" rx="4.5" ry="5.5" fill="var(--cocoa-900)" />
      <ellipse cx="45" cy="44" rx="4.5" ry="5.5" fill="var(--cocoa-900)" />
      <circle cx="32.4" cy="41.8" r="1.6" fill="#fff" />
      <circle cx="46.4" cy="41.8" r="1.6" fill="#fff" />
      <path d="M32 54q6 5 12 0" {...outline} strokeWidth={2.4} strokeLinecap="round" />
      {tier >= 2 && <path d="M22 60q16 8 32 0l-3 10q-13 6-26 0z" fill={color} opacity=".7" />}
      {tier >= 3 && <path d="M28 16q10-6 20 0l-3 4q-7-3-14 0z" fill="var(--gold-500)" />}
      {Array.from({ length: sparks }).map((_, i) => {
        const a = (i / Math.max(sparks, 1)) * Math.PI * 2;
        return (
          <circle key={i} cx={38 + Math.cos(a) * 30} cy={40 + Math.sin(a) * 26} r={2.4}
                  fill="var(--gold-500)" opacity=".9" />
        );
      })}
    </svg>
  );
}

/** Wick — Mayhem mode. Mischievous, never menacing. */
export function Wick({ size = 76, awake = false, className = '' }) {
  return (
    <svg width={size} height={size * (86 / 76)} viewBox="0 0 76 86" aria-hidden="true" className={className}>
      <path d="M24 34h28v34q0 8-6 8h-16q-6 0-6-8z" fill="var(--wild-300)" {...stroke} />
      <path d="M24 68q7 6 14 0t14 0v6q0 6-6 6H30q-6 0-6-6z" fill="var(--wild-500)" />
      <path d="M39 34c-1-6 3-8 2-14 4 4 8 6 7 12" stroke="rgba(74,54,43,.5)" strokeWidth={2.5} fill="none" />
      <path d="M42 14c2 3 5 4 5 8a5 5 0 1 1-10 0c0-4 3-5 5-8z" fill="var(--magma-500)" />
      {awake ? (
        <>
          <ellipse cx="33" cy="46" rx="4" ry="5.5" fill="var(--cocoa-900)" />
          <ellipse cx="45" cy="48" rx="3" ry="4" fill="var(--cocoa-900)" />
          <circle cx="34.2" cy="43.8" r="1.5" fill="#fff" />
          <circle cx="46" cy="46.4" r="1.2" fill="#fff" />
          <path d="M32 57q7 6 13 -1" {...outline} strokeWidth={2.4} strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M29 47q4 3 8 0" {...outline} strokeWidth={2.2} />
          <path d="M41 48q4 3 8 0" {...outline} strokeWidth={2.2} />
          <path d="M34 58q5 3 9 0" {...outline} strokeWidth={2.2} strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

/** The live flame that rides the tip of the curve progress bar. */
export function Flame({ size = 22, className = '' }) {
  return (
    <svg width={size} height={size * (26 / 22)} viewBox="0 0 22 26" aria-hidden="true" className={className}>
      <path d="M11 1c1.5 5 6 6.5 6 12a6 6 0 1 1-12 0c0-3 1.5-4.5 3-6.5.8 2 2 2 2 4 1.5-3 1-6.5 1-9.5z"
            fill="var(--ember-500)" />
      <path d="M11 11c.8 2.2 2.8 2.8 2.8 5a2.8 2.8 0 1 1-5.6 0c0-2.2 2-2.8 2.8-5z" fill="var(--gold-500)" />
    </svg>
  );
}

export function SparkLogo({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 3c2 7 9 9 9 17a9 9 0 1 1-18 0c0-4 2-6 4-9 1 3 3 3 3 6 2-4 2-9 2-14z" fill="var(--ember-500)" />
      <path d="M20 17c1 3 4 4 4 7a4 4 0 1 1-8 0c0-3 3-4 4-7z" fill="var(--gold-500)" />
    </svg>
  );
}
