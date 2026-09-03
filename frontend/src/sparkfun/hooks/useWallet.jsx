/**
 * Wallet + session. One provider owns identity for the whole app.
 * Connection is EIP-1193 against the injected provider, then a signed nonce
 * exchanged for a session token (see lib/chain.js for why not RainbowKit yet).
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  CHAIN, currentAccounts, currentChainId, getBalance, getProvider,
  hasWallet, requestAccounts, switchToChain,
} from '../lib/chain';
import { api, getSession, setSession } from '../lib/api';

const WalletContext = createContext(null);
export const useWallet = () => useContext(WalletContext);

export function WalletProvider({ children }) {
  const [user, setUser] = useState(() => getSession()?.user || null);
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const refreshBalance = useCallback(async (addr) => {
    if (!addr) return;
    setBalance(await getBalance(addr));
  }, []);

  // Re-hydrate: an existing session survives reload; the wallet may not.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (getSession()?.token) {
        try {
          const me = await api.me();
          if (!cancelled) setUser(me);
        } catch {
          setSession(null);
          if (!cancelled) setUser(null);
        }
      }
      if (hasWallet()) {
        const [acct] = await currentAccounts();
        const id = await currentChainId();
        if (cancelled) return;
        setAddress(acct || null);
        setChainId(id);
        if (acct) refreshBalance(acct);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshBalance]);

  // Wallets change account and network behind the app's back; listen for both.
  useEffect(() => {
    const p = getProvider();
    if (!p?.on) return undefined;
    const onAccounts = (accts) => {
      const next = accts?.[0] || null;
      setAddress(next);
      if (next) refreshBalance(next);
      else { setSession(null); setUser(null); }
    };
    const onChain = (hex) => setChainId(parseInt(hex, 16));
    p.on('accountsChanged', onAccounts);
    p.on('chainChanged', onChain);
    return () => {
      p.removeListener?.('accountsChanged', onAccounts);
      p.removeListener?.('chainChanged', onChain);
    };
  }, [refreshBalance]);

  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const [acct] = await requestAccounts();
      if (!acct) throw new Error('Nenhuma conta liberada.');
      setAddress(acct);

      let id = await currentChainId();
      if (id !== CHAIN.id) {
        await switchToChain();
        id = await currentChainId();
      }
      setChainId(id);

      const { message, nonce } = await api.nonce(acct);
      const signature = await getProvider().request({
        method: 'personal_sign',
        params: [message, acct],
      });
      const session = await api.verify({ address: acct, signature, nonce });
      setSession({ token: session.token, user: session.user });
      setUser(session.user);
      refreshBalance(acct);
      return session.user;
    } catch (err) {
      setError(err.message || 'Não consegui conectar.');
      throw err;
    } finally {
      setConnecting(false);
    }
  }, [refreshBalance]);

  const connectEmail = useCallback(async (email, nickname) => {
    setError(null);
    setConnecting(true);
    try {
      const session = await api.guest({ email, nickname });
      setSession({ token: session.token, user: session.user });
      setUser(session.user);
      return session.user;
    } catch (err) {
      setError(err.message || 'Não consegui entrar com esse e-mail.');
      throw err;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setSession(null);
    setUser(null);
    setBalance(0);
  }, []);

  const value = useMemo(() => ({
    user, setUser, address, chainId, balance, connecting, error,
    connected: Boolean(user),
    wrongNetwork: Boolean(address) && chainId !== null && chainId !== CHAIN.id,
    hasWallet: hasWallet(),
    connect, connectEmail, disconnect, switchToChain, refreshBalance,
  }), [user, address, chainId, balance, connecting, error, connect, connectEmail, disconnect, refreshBalance]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
