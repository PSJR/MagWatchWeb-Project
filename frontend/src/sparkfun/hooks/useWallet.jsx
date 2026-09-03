/**
 * Wallet, session and chain state.
 *
 * Two connectors, one interface: WalletConnect v2 (the default — QR on desktop,
 * deep link on mobile) and the injected provider when one exists. Both are
 * plain EIP-1193, so everything downstream is connector-agnostic.
 *
 * On-chain actions are signed by the wallet. The backend session (a signed
 * nonce) exists only for off-chain data — comments, favourites, profile — and
 * never has custody of anything.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { formatEther } from 'viem';
import { CHAIN, CHAIN_ID, publicClient, walletClientFrom, humanizeChainError } from '../lib/chain';
import { api, getSession, setSession } from '../lib/api';

const WalletContext = createContext(null);
export const useWallet = () => useContext(WalletContext);

const PROJECT_ID = (process.env.REACT_APP_WALLETCONNECT_PROJECT_ID || '').trim();
export const walletConnectConfigured = Boolean(PROJECT_ID);

const LAST_CONNECTOR = 'sparkfun.connector';

let wcProviderPromise = null;

/** Lazily loads WalletConnect so it stays out of the initial bundle. */
async function getWalletConnectProvider() {
  if (!PROJECT_ID) {
    throw new Error(
      'WalletConnect não está configurado. Defina REACT_APP_WALLETCONNECT_PROJECT_ID.',
    );
  }
  if (!wcProviderPromise) {
    wcProviderPromise = (async () => {
      const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
      return EthereumProvider.init({
        projectId: PROJECT_ID,
        chains: [CHAIN_ID],
        optionalChains: [CHAIN_ID],
        showQrModal: true,
        metadata: {
          name: 'spark.fun',
          description: 'Token launchpad da Robinhood Chain',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://spark.fun',
          icons: [`${typeof window !== 'undefined' ? window.location.origin : ''}/logo192.png`],
        },
        rpcMap: { [CHAIN_ID]: CHAIN.rpcUrls.default.http[0] },
        qrModalOptions: {
          themeVariables: {
            '--wcm-accent-color': '#FF7A2F',
            '--wcm-background-color': '#FFF4E6',
            '--wcm-font-family': "'Plus Jakarta Sans', system-ui, sans-serif",
          },
        },
      });
    })();
  }
  return wcProviderPromise;
}

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
  const walletClientRef = useRef(null);

  const refreshBalance = useCallback(async (addr) => {
    if (!addr) return;
    try {
      setBalance(await publicClient.getBalance({ address: addr }));
    } catch {
      /* an RPC hiccup must not blank the UI */
    }
  }, []);

  // Re-hydrate the backend session; the wallet reconnects separately.
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

  // Reconnect silently to whichever connector was used last.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const last = localStorage.getItem(LAST_CONNECTOR);
      if (!last) return;
      try {
        if (last === 'walletconnect' && PROJECT_ID) {
          const wc = await getWalletConnectProvider();
          if (wc.accounts?.length && !cancelled) await adopt(wc, 'walletconnect', wc.accounts[0]);
        } else if (last === 'injected') {
          const inj = injectedProvider();
          if (!inj) return;
          const accounts = await inj.request({ method: 'eth_accounts' });
          if (accounts?.[0] && !cancelled) await adopt(inj, 'injected', accounts[0]);
        }
      } catch {
        localStorage.removeItem(LAST_CONNECTOR);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adopt = useCallback(async (prov, kind, account) => {
    setProvider(prov);
    setConnector(kind);
    setAddress(account);
    walletClientRef.current = walletClientFrom(prov, account);
    try {
      const id = await prov.request({ method: 'eth_chainId' });
      setChainId(parseInt(id, 16));
    } catch {
      setChainId(null);
    }
    refreshBalance(account);
  }, [refreshBalance]);

  // Wallets change account and network behind the app's back.
  useEffect(() => {
    if (!provider?.on) return undefined;
    const onAccounts = (accts) => {
      const next = accts?.[0] || null;
      setAddress(next);
      if (next) {
        walletClientRef.current = walletClientFrom(provider, next);
        refreshBalance(next);
      } else {
        disconnect();
      }
    };
    const onChain = (hex) => setChainId(typeof hex === 'string' ? parseInt(hex, 16) : Number(hex));
    const onDisconnect = () => disconnect();

    provider.on('accountsChanged', onAccounts);
    provider.on('chainChanged', onChain);
    provider.on('disconnect', onDisconnect);
    return () => {
      provider.removeListener?.('accountsChanged', onAccounts);
      provider.removeListener?.('chainChanged', onChain);
      provider.removeListener?.('disconnect', onDisconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, refreshBalance]);

  /** Exchanges a wallet signature for the off-chain session. */
  const authenticate = useCallback(async (prov, account) => {
    const { message, nonce } = await api.nonce(account);
    const signature = await prov.request({ method: 'personal_sign', params: [message, account] });
    const session = await api.verify({ address: account, signature, nonce });
    setSession({ token: session.token, user: session.user });
    setUser(session.user);
    return session.user;
  }, []);

  const connect = useCallback(async (kind = 'walletconnect') => {
    setError(null);
    setConnecting(true);
    try {
      let prov;
      let account;

      if (kind === 'injected') {
        prov = injectedProvider();
        if (!prov) throw new Error('Nenhuma carteira encontrada neste navegador.');
        const accounts = await prov.request({ method: 'eth_requestAccounts' });
        account = accounts?.[0];
      } else {
        prov = await getWalletConnectProvider();
        if (!prov.accounts?.length) await prov.connect();
        account = prov.accounts?.[0];
      }
      if (!account) throw new Error('Nenhuma conta liberada.');

      await adopt(prov, kind, account);
      localStorage.setItem(LAST_CONNECTOR, kind);
      await authenticate(prov, account);
      return account;
    } catch (err) {
      const message = humanizeChainError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setConnecting(false);
    }
  }, [adopt, authenticate]);

  const connectEmail = useCallback(async (email, nickname) => {
    setError(null);
    setConnecting(true);
    try {
      const session = await api.guest({ email, nickname });
      setSession({ token: session.token, user: session.user });
      setUser(session.user);
      return session.user;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try { await provider?.disconnect?.(); } catch { /* already gone */ }
    localStorage.removeItem(LAST_CONNECTOR);
    setSession(null);
    setUser(null);
    setProvider(null);
    setConnector(null);
    setAddress(null);
    setBalance(0n);
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
    wrongNetwork: Boolean(address) && chainId !== null && chainId !== CHAIN_ID,
    hasInjected: Boolean(injectedProvider()),
    walletConnectConfigured,
    walletClient: walletClientRef.current,
    getWalletClient: () => walletClientRef.current,
    connect, connectEmail, disconnect, switchToChain, refreshBalance, authenticate,
  }), [user, address, chainId, connector, connecting, error, balance,
       connect, connectEmail, disconnect, switchToChain, refreshBalance, authenticate]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
