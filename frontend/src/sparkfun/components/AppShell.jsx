import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import ChainBadge, { GasPill } from './ChainBadge';
import { Button, Field, cx } from './ui';
import { Ember, Pip, SparkLogo } from './mascots';
import { useWallet } from '../hooks/useWallet';
import { truncAddress } from '../lib/format';
import { CHAIN, CHAIN_ID } from '../lib/chain';

const NAV = [
  { to: '/', label: 'Início', icon: '⌂', end: true },
  { to: '/explore', label: 'Explorar', icon: '🔍' },
  { to: '/create', label: 'Acender', icon: '🔥', primary: true },
  { to: '/me', label: 'Perfil', icon: '👤' },
  { to: '/creator', label: 'Criador', icon: '🪵' },
];

export default function AppShell({ children }) {
  const [walletOpen, setWalletOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header onConnect={() => setWalletOpen(true)} />
      <NetworkBanner />

      <div className="flex-1 w-full max-w-app mx-auto flex gap-8 px-4 md:px-8 lg:px-10">
        <SideRail />
        <main className="flex-1 min-w-0 pb-28 lg:pb-16 animate-rise-in" key={pathname}>
          {children}
        </main>
      </div>

      <BottomNav />
      {walletOpen && <WalletModal onClose={() => setWalletOpen(false)} />}
    </div>
  );
}

function Header({ onConnect }) {
  const { user, address, disconnect, connector } = useWallet();
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
          {user ? (
            <button
              onClick={disconnect}
              title={`Sair · conectado via ${connector === 'injected' ? 'carteira do navegador' : 'WalletConnect'}`}
              className="flex items-center gap-2 rounded-pill bg-surface shadow-hairline pl-1 pr-3 py-1
                         hover:shadow-sm transition-shadow duration-fast"
            >
              <Pip seed={address || user.handle} size={28} />
              <span className="num text-caption text-ink3 hidden sm:block">
                {address ? truncAddress(address) : `@${user.handle}`}
              </span>
            </button>
          ) : (
            <Button size="md" onClick={onConnect}>Entrar na casa</Button>
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
          Você está em outra casa. Trocar para a {CHAIN.name}?
        </p>
        <Button
          size="sm"
          loading={busy}
          onClick={async () => { setBusy(true); try { await switchToChain(); } finally { setBusy(false); } }}
        >
          Trocar de rede
        </Button>
      </div>
    </div>
  );
}

function SideRail() {
  return (
    <nav className="hidden lg:block w-[212px] shrink-0 pt-8" aria-label="Navegação principal">
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
      aria-label="Navegação principal"
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

function WalletModal({ onClose }) {
  const {
    connect, connectEmail, connecting, error,
    hasInjected, walletConnectConfigured,
  } = useWallet();
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(null);

  const run = (kind) => async () => {
    setPending(kind);
    try {
      await connect(kind);
      onClose();
    } catch {
      /* the message is rendered from the hook's error state */
    } finally {
      setPending(null);
    }
  };

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[500] grid place-items-end sm:place-items-center p-0 sm:p-6
                 bg-[rgba(46,32,25,.42)] backdrop-blur-md animate-rise-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Entrar na casa"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-[420px] bg-raised rounded-t-3xl sm:rounded-2xl p-6 shadow-xl animate-pop-in"
      >
        <div className="flex items-center gap-3 mb-1">
          <Ember size={44} mood="happy" className="animate-bob" />
          <div>
            <h2 className="disp text-heading-lg">Entrar na casa</h2>
            <p className="text-caption text-ink3">{CHAIN.name} · {CHAIN_ID}</p>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <Button
            full size="xl"
            loading={pending === 'walletconnect'}
            disabled={!walletConnectConfigured || connecting}
            onClick={run('walletconnect')}
          >
            Conectar com WalletConnect
          </Button>
          <p className="text-caption text-ink3 text-center">
            Funciona com qualquer carteira: QR no desktop, link direto no celular.
          </p>

          {!walletConnectConfigured && (
            <p className="text-caption text-ember-800 bg-ember-100 rounded-md px-3 py-2">
              WalletConnect não está configurado nesta build. Defina
              <code className="num mx-1">REACT_APP_WALLETCONNECT_PROJECT_ID</code>
              (grátis em dashboard.reown.com).
            </p>
          )}

          {hasInjected && (
            <Button
              full size="lg" variant="secondary"
              loading={pending === 'injected'}
              disabled={connecting}
              onClick={run('injected')}
            >
              Usar a carteira do navegador
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3 my-5">
          <span className="flex-1 h-px bg-subtle" />
          <span className="text-caption text-ink3">ou</span>
          <span className="flex-1 h-px bg-subtle" />
        </div>

        <Field
          type="email"
          placeholder="voce@email.com"
          label="Entrar com e-mail"
          hint="A gente cria a carteira para você."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button
          full variant="secondary" size="lg" disabled={!email.includes('@')} loading={connecting}
          onClick={() => connectEmail(email).then(onClose).catch(() => {})}
        >
          Enviar
        </Button>

        {error && <p className="text-caption text-coral-800 mt-3 text-center">{error}</p>}

        <p className="text-caption text-ink3 mt-5 leading-relaxed">
          Você mantém a custódia: a assinatura serve só para provar quem você é e
          não autoriza nenhuma transação. Tokens criados aqui não têm garantia nem
          promessa de valor. A maioria vai a zero. A gente deixa isso divertido —
          mas o risco é de verdade.
        </p>
      </div>
    </div>
  );
}
