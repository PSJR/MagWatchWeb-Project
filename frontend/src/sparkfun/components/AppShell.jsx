import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import ChainBadge, { GasPill } from './ChainBadge';
import WalletDialog from './WalletDialog';
import { Button, cx } from './ui';
import { Ember, Pip, SparkLogo } from './mascots';
import { useWallet } from '../hooks/useWallet';
import { truncAddress } from '../lib/format';
import { CHAIN } from '../lib/chain';

const NAV = [
  { to: '/', label: 'Home', icon: '⌂', end: true },
  { to: '/explore', label: 'Explore', icon: '🔍' },
  { to: '/create', label: 'Light it', icon: '🔥', primary: true },
  { to: '/me', label: 'Profile', icon: '👤' },
  { to: '/creator', label: 'Creator', icon: '🪵' },
];

export default function AppShell({ children }) {
  const { dialogOpen, openWalletDialog, closeWalletDialog } = useWallet();
  const { pathname } = useLocation();

  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header onConnect={openWalletDialog} />
      <NetworkBanner />

      <div className="flex-1 w-full max-w-app mx-auto flex gap-8 px-4 md:px-8 lg:px-10">
        <SideRail />
        <main className="flex-1 min-w-0 pb-28 lg:pb-16 animate-rise-in" key={pathname}>
          {children}
        </main>
      </div>

      <BottomNav />
      {dialogOpen && <WalletDialog onClose={closeWalletDialog} />}
    </div>
  );
}

function Header({ onConnect }) {
  const { user, address, disconnect, connector, needsUnlock } = useWallet();
  const [small, setSmall] = useState(false);

  useEffect(() => {
    const onScroll = () => setSmall(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cx('sticky top-0 z-[200] glass transition-[height] duration-base ease-out-soft',
        small ? 'h-[52px]' : 'h-16')}
    >
      <div className="h-full max-w-app mx-auto px-4 md:px-8 lg:px-10 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <SparkLogo size={small ? 26 : 30} />
          <span className="disp text-[19px] tracking-tight hidden sm:block">spark.fun</span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <ChainBadge className="hidden md:inline-flex" />
          <GasPill className="hidden lg:inline-flex" />
          {/* A locked wallet still has a session, so the account chip alone would
              leave signing out as the only action. Unlocking comes first. */}
          {needsUnlock && (
            <Button size="md" onClick={onConnect}>Unlock wallet</Button>
          )}
          {user ? (
            <button
              onClick={disconnect}
              title={`Sign out · ${connector === 'injected' ? 'browser wallet' : 'wallet created here'}`}
              className="flex items-center gap-2 rounded-pill bg-surface shadow-hairline pl-1 pr-3 py-1
                         hover:shadow-sm transition-shadow duration-fast"
            >
              <Pip seed={address || user.handle} size={28} />
              <span className="num text-caption text-ink3 hidden sm:block">
                {address ? truncAddress(address) : `@${user.handle}`}
              </span>
            </button>
          ) : !needsUnlock && (
            <Button size="md" onClick={onConnect}>Connect wallet</Button>
          )}
        </div>
      </div>
    </header>
  );
}

/** Wrong network is amber and helpful, never a red alarm. */
function NetworkBanner() {
  const { wrongNetwork, switchToChain } = useWallet();
  const [busy, setBusy] = useState(false);
  if (!wrongNetwork) return null;

  return (
    <div className="sticky top-16 z-[190] bg-ember-100 border-b border-ember-200 animate-rise-in">
      <div className="max-w-app mx-auto px-4 md:px-8 py-2.5 flex items-center gap-3">
        <Ember size={28} mood="worried" />
        <p className="flex-1 text-[13px] text-ink2">
          You are on a different network. Switch to {CHAIN.name}?
        </p>
        <Button
          size="sm"
          loading={busy}
          onClick={async () => { setBusy(true); try { await switchToChain(); } finally { setBusy(false); } }}
        >
          Switch network
        </Button>
      </div>
    </div>
  );
}

function SideRail() {
  return (
    <nav className="hidden lg:block w-[212px] shrink-0 pt-8" aria-label="Main navigation">
      <ul className="sticky top-24 space-y-1">
        {NAV.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) => cx(
                'flex items-center gap-3 h-11 px-3 rounded-lg text-[14px] font-semibold',
                'transition-colors duration-fast',
                isActive ? 'bg-accent-soft text-ink' : 'text-ink3 hover:text-ink hover:bg-surface',
              )}
            >
              <span aria-hidden="true" className="text-[17px]">{item.icon}</span>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function BottomNav() {
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-[200] glass border-t border-subtle safe-b"
      aria-label="Main navigation"
    >
      <ul className="flex items-stretch justify-around h-[62px]">
        {NAV.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) => cx(
                'h-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold relative',
                isActive ? 'text-ink' : 'text-ink3',
              )}
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden="true"
                    className={cx('text-[19px] leading-none transition-transform duration-fast',
                      item.primary && 'w-11 h-11 -mt-5 rounded-pill bg-grad-ember grid place-items-center shadow-[0_3px_0_var(--accent-deep)]',
                      isActive && !item.primary && 'scale-110')}
                  >
                    {item.icon}
                  </span>
                  <span className={item.primary ? 'mt-0.5' : ''}>{item.label}</span>
                  {isActive && !item.primary && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-pill bg-accent" aria-hidden="true" />
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
