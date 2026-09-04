/**
 * Wallet, session and chain state.
 *
 * Two ways in, both non-custodial:
 *
 *   injected  — a browser wallet (MetaMask, Rabby). The default: the user
 *               already has keys and the extension keeps them.
 *   embedded  — a wallet created in the browser for people signing in with an
 *               email. The seed phrase is encrypted with their password and
 *               never leaves the device; see lib/embeddedWallet.js.
 *
 * Either way spark.fun holds no key and cannot move anyone's funds. The
 * backend session exists only for off-chain data — profile, favourites, chat —
 * and is proved by a signature, never by a password on our side.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { formatEther } from 'viem';
import {
  CHAIN, CHAIN_ID, humanizeChainError, localWalletClient, publicClient, walletClientFrom,
} from '../lib/chain';
import { api, getSession, setSession } from '../lib/api';
import * as embedded from '../lib/embeddedWallet';

const WalletContext = createContext(null);
export const useWallet = () => useContext(WalletContext);

const LAST_CONNECTOR = 'sparkfun.connector';

const injectedProvider = () => (typeof window !== 'undefined' ? window.ethereum : null) || null;

export function WalletProvider({ children }) {
  const [user, setUser] = useState(() => getSession()?.user || null);
  const [provider, setProvider] = useState(null);
  const [connector, setConnector] = useState(null);
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState(0n);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  // The connect dialog lives here rather than in AppShell because any screen
  // may need to ask for it — a locked wallet blocks trading and creating just
  // as much as no wallet at all, and only a password can clear it.
  const [dialogOpen, setDialogOpen] = useState(false);
  const walletClientRef = useRef(null);

  const refreshBalance = useCallback(async (addr) => {
    if (!addr) return;
    try {
      setBalance(await publicClient.getBalance({ address: addr }));
    } catch {
      /* an RPC hiccup must not blank the UI */
    }
  }, []);

  // Re-hydrate the backend session; the wallet attaches separately.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getSession()?.token) return;
      try {
        const me = await api.me();
        if (!cancelled) setUser(me);
      } catch {
        setSession(null);
        if (!cancelled) setUser(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const adoptInjected = useCallback(async (prov, account) => {
    setProvider(prov);
    setConnector('injected');
    setAddress(account);
    walletClientRef.current = walletClientFrom(prov, account);
    try {
      setChainId(parseInt(await prov.request({ method: 'eth_chainId' }), 16));
    } catch {
      setChainId(null);
    }
    refreshBalance(account);
  }, [refreshBalance]);

  const adoptEmbedded = useCallback((account) => {
    setProvider(null);
    setConnector('embedded');
    setAddress(account.address);
    // The embedded wallet only ever talks to this chain, so it is never on the
    // wrong network the way an extension can be.
    setChainId(CHAIN_ID);
    setNeedsUnlock(false);
    walletClientRef.current = localWalletClient(account);
    refreshBalance(account.address);
  }, [refreshBalance]);

  // Reconnect whichever connector was used last. An embedded wallet cannot
  // auto-reconnect — it needs the password — so it only flags that it is there.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const last = localStorage.getItem(LAST_CONNECTOR);
      if (last === 'embedded' && embedded.hasWallet()) {
        if (!cancelled) setNeedsUnlock(true);
        return;
      }
      if (last !== 'injected') return;
      const inj = injectedProvider();
      if (!inj) return;
      try {
        const accounts = await inj.request({ method: 'eth_accounts' });
        if (accounts?.[0] && !cancelled) await adoptInjected(inj, accounts[0]);
      } catch {
        localStorage.removeItem(LAST_CONNECTOR);
      }
    })();
    return () => { cancelled = true; };
  }, [adoptInjected]);

  // An extension changes account and network behind the app's back.
  useEffect(() => {
    if (!provider?.on) return undefined;
    const onAccounts = (accts) => {
      const next = accts?.[0] || null;
      if (!next) { disconnect(); return; }
      setAddress(next);
      walletClientRef.current = walletClientFrom(provider, next);
      refreshBalance(next);
    };
    const onChain = (hex) => setChainId(typeof hex === 'string' ? parseInt(hex, 16) : Number(hex));
    provider.on('accountsChanged', onAccounts);
    provider.on('chainChanged', onChain);
    provider.on('disconnect', () => disconnect());
    return () => {
      provider.removeListener?.('accountsChanged', onAccounts);
      provider.removeListener?.('chainChanged', onChain);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, refreshBalance]);

  /**
   * Exchanges a wallet signature for the off-chain session. Both connectors
   * sign the same message; only the signing call differs.
   */
  const authenticate = useCallback(async (kind, account, prov) => {
    const { message, nonce } = await api.nonce(account);
    const signature = kind === 'embedded'
      ? await embedded.getAccount().signMessage({ message })
      : await prov.request({ method: 'personal_sign', params: [message, account] });
    const session = await api.verify({ address: account, signature, nonce });
    setSession({ token: session.token, user: session.user });
    setUser(session.user);
    return session.user;
  }, []);

  /** Connect a browser wallet. */
  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const prov = injectedProvider();
      if (!prov) {
        throw new Error(
          'No wallet found in this browser. Install MetaMask or Rabby, or sign in with an email and let spark.fun create one.',
        );
      }
      const accounts = await prov.request({ method: 'eth_requestAccounts' });
      const account = accounts?.[0];
      if (!account) throw new Error('No account was authorised.');

      await adoptInjected(prov, account);
      localStorage.setItem(LAST_CONNECTOR, 'injected');
      await authenticate('injected', account, prov);
      return account;
    } catch (err) {
      const message = humanizeChainError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setConnecting(false);
    }
  }, [adoptInjected, authenticate]);

  /**
   * Signs in with an email and creates a wallet in this browser.
   * Returns the seed phrase exactly once, for the caller to show.
   */
  const createEmbedded = useCallback(async ({ email, nickname, password }) => {
    setError(null);
    setConnecting(true);
    try {
      // The email profile comes first so the wallet attaches to it rather than
      // becoming a second, separate account.
      const session = await api.guest({ email, nickname });
      setSession({ token: session.token, user: session.user });
      setUser(session.user);

      const { address: created, phrase } = await embedded.create(password);
      adoptEmbedded(embedded.getAccount());
      localStorage.setItem(LAST_CONNECTOR, 'embedded');

      // Prove ownership of the new key, so the server attaches an address the
      // user demonstrably controls rather than one they merely claimed.
      const { message, nonce } = await api.nonce(created);
      const signature = await embedded.getAccount().signMessage({ message });
      let linked;
      try {
        linked = await api.linkWallet({ address: created, signature, nonce });
      } catch (err) {
        // This email already has a wallet, made on another browser. Keeping
        // the one just created would strand it: unattached to the profile and
        // holding nothing. It is seconds old and its phrase has not been shown
        // yet, so throwing it away costs the user nothing — and restoring from
        // their phrase is what actually gets them in here.
        if (err.status === 409) {
          await embedded.remove(password).catch(() => {});
          embedded.lock();
          localStorage.removeItem(LAST_CONNECTOR);
          setConnector(null);
          setAddress(null);
          setNeedsUnlock(false);
          walletClientRef.current = null;
          throw new Error(
            'This email already has a wallet, created in another browser. '
            + 'Restore it here with its seed phrase.',
          );
        }
        throw err;
      }
      setUser(linked);

      return { address: created, phrase };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setConnecting(false);
    }
  }, [adoptEmbedded]);

  const unlockEmbedded = useCallback(async (password) => {
    setError(null);
    setConnecting(true);
    try {
      const account = await embedded.unlock(password);
      adoptEmbedded(account);
      localStorage.setItem(LAST_CONNECTOR, 'embedded');
      if (!getSession()?.token) await authenticate('embedded', account.address, null);
      return account.address;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setConnecting(false);
    }
  }, [adoptEmbedded, authenticate]);

  const importEmbedded = useCallback(async ({ phrase, password, replace = false }) => {
    setError(null);
    setConnecting(true);
    try {
      await embedded.importPhrase(phrase, password, { replace });
      const account = embedded.getAccount();
      adoptEmbedded(account);
      localStorage.setItem(LAST_CONNECTOR, 'embedded');
      await authenticate('embedded', account.address, null);
      return account.address;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setConnecting(false);
    }
  }, [adoptEmbedded, authenticate]);

  const disconnect = useCallback(async () => {
    try { await provider?.disconnect?.(); } catch { /* already gone */ }
    embedded.lock();
    localStorage.removeItem(LAST_CONNECTOR);
    setSession(null);
    setUser(null);
    setProvider(null);
    setConnector(null);
    setAddress(null);
    setBalance(0n);
    setNeedsUnlock(embedded.hasWallet());
    walletClientRef.current = null;
  }, [provider]);

  const switchToChain = useCallback(async () => {
    if (!provider) return;
    const hex = `0x${CHAIN_ID.toString(16)}`;
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
    } catch (err) {
      if (err?.code === 4902 || err?.code === -32603) {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: hex,
            chainName: CHAIN.name,
            nativeCurrency: CHAIN.nativeCurrency,
            rpcUrls: CHAIN.rpcUrls.default.http,
            blockExplorerUrls: [CHAIN.blockExplorers.default.url],
          }],
        });
      } else {
        throw new Error(humanizeChainError(err));
      }
    }
  }, [provider]);

  const value = useMemo(() => ({
    user, setUser, address, chainId, connector, connecting, error,
    balance, balanceEth: Number(formatEther(balance)),
    connected: Boolean(address),
    signedIn: Boolean(user),
    // The embedded wallet is pinned to this chain, so only an extension can be
    // pointed at the wrong one.
    wrongNetwork: connector === 'injected' && Boolean(address) && chainId !== null && chainId !== CHAIN_ID,
    hasInjected: Boolean(injectedProvider()),
    dialogOpen,
    openWalletDialog: () => setDialogOpen(true),
    closeWalletDialog: () => setDialogOpen(false),
    hasEmbeddedWallet: embedded.hasWallet(),
    embeddedAddress: embedded.walletAddress(),
    needsUnlock,
    connect, createEmbedded, unlockEmbedded, importEmbedded,
    exportPhrase: embedded.exportPhrase,
    removeEmbedded: embedded.remove,
    validatePassword: embedded.validatePassword,
    disconnect, switchToChain, refreshBalance,
    walletClient: walletClientRef.current,
    getWalletClient: () => walletClientRef.current,
  }), [user, address, chainId, connector, connecting, error, balance, needsUnlock, dialogOpen,
       connect, createEmbedded, unlockEmbedded, importEmbedded, disconnect, switchToChain, refreshBalance]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
