import React, { useMemo } from 'react';
import { Area, AreaChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { curveParams, curveSamples, CURVE_SUPPLY } from '../lib/curve';
import { money, price as fmtPrice } from '../lib/format';
import { cx } from './ui';

/**
 * The bonding curve, drawn as a shape rather than a trading chart: a thick
 * round-capped line, a soft fill, and the live position riding on top.
 * Chart text takes its colour from theme tokens so it reads in both themes.
 */
export default function CurveChart({ token, height = 240, className = '' }) {
  const params = useMemo(
    () => curveParams({ pair: token.pair, mayhem: token.mayhem }),
    [token.pair, token.mayhem],
  );

  const data = useMemo(() => {
    const samples = curveSamples(params, token.base_sold, 72);
    return samples.map((s) => ({
      progress: Math.round(s.progress * 100),
      cap: s.cap,
      price: s.price,
      reached: s.reached ? s.cap : null,
    }));
  }, [params, token.base_sold]);

  const livePct = Math.round((token.progress || 0) * 100);
  const live = data.find((d) => d.progress >= livePct) || data[0];
  const accent = token.mayhem ? 'var(--wild-500)' : 'var(--accent)';

  return (
    <div className={cx('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.34} />
              <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="progress"
            tickFormatter={(v) => `${v}%`}
            ticks={[0, 25, 50, 75, 100]}
            tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'JetBrains Mono' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            dataKey="cap"
            tickFormatter={(v) => money(v, token.pair)}
            width={54}
            tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'JetBrains Mono' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ stroke: 'var(--text-secondary)', strokeDasharray: '4 4' }}
            contentStyle={{
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 14,
              boxShadow: 'var(--shadow-md)',
              fontFamily: 'JetBrains Mono',
              fontSize: 12,
              color: 'var(--text-primary)',
            }}
            labelFormatter={(v) => `${v}% of the campfire`}
            formatter={(v, name) => [name === 'cap' ? money(v, token.pair) : fmtPrice(v, { prefix: '' }), name === 'cap' ? 'market cap' : 'price']}
          />

          <Area
            type="monotone" dataKey="cap" stroke={accent} strokeWidth={3}
            strokeLinecap="round" fill="url(#curveFill)" isAnimationActive={false}
          />
          <ReferenceLine
            x={100} stroke="var(--gold-600)" strokeDasharray="3 4"
            label={{ value: '🏁', position: 'top', fontSize: 14 }}
          />
          {live && (
            <ReferenceDot
              x={live.progress} y={live.cap} r={6}
              fill={accent} stroke="var(--bg-raised)" strokeWidth={3} isFront
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
      <p className="sr-only">
        Bonding curve for {token.ticker}: starts at {money(data[0]?.cap || 0, token.pair)} market cap
        and reaches {money(data[data.length - 1]?.cap || 0, token.pair)} at graduation. Currently at {livePct}%.
      </p>
    </div>
  );
}
