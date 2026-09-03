/**
 * Robinhood Chain — the only network spark.fun speaks to.
 *
 * Wallet access is plain EIP-1193 against the injected provider. That is a
 * deliberate choice over RainbowKit/wagmi for now: this app builds on
 * react-scripts 5, where the wagmi dependency tree fights the React 19 peer
 * graph and the webpack 4-era polyfill shims. The surface below is the same
 * shape a connector would expose, so swapping one in later is a local change.
 */

export const CHAIN = {
  id: 4663,
  hexId: '0x1237', // 4663
  name: 'Robinhood Chain',
  shortName: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://rpc.robinhoodchain.com'],
  blockExplorerUrls: ['https://explorer.robinhoodchain.com'],
  blockTimeMs: 100,
  stack: 'Arbitrum Orbit',
};

export const UNISWAP_V3 = {
  name: 'Uniswap V3',
  poolUrl: (pool) => `${CHAIN.blockExplorerUrls[0]}/address/${pool}`,
  tradeUrl: (token) => `https://app.uniswap.org/swap?chain=${CHAIN.id}&outputCurrency=${token}`,
};

export const explorer = {
  tx: (hash) => `${CHAIN.blockExplorerUrls[0]}/tx/${hash}`,
  address: (addr) => `${CHAIN.blockExplorerUrls[0]}/address/${addr}`,
};

export function getProvider() {
  if (typeof window === 'undefined') return null;
  return window.ethereum || null;
}

export function hasWallet() {
  return Boolean(getProvider());
}

/** Ask the wallet for accounts. Throws a human-readable message on refusal. */
export async function requestAccounts() {
  const p = getProvider();
  if (!p) throw new Error('Nenhuma carteira encontrada neste navegador.');
  try {
    const accounts = await p.request({ method: 'eth_requestAccounts' });
    return accounts || [];
  } catch (err) {
    if (err && err.code === 4001) throw new Error('Você recusou a conexão.');
    throw new Error(err?.message || 'Não consegui falar com a carteira.');
  }
}

export async function currentAccounts() {
  const p = getProvider();
  if (!p) return [];
  try {
    return (await p.request({ method: 'eth_accounts' })) || [];
  } catch {
    return [];
  }
}

export async function currentChainId() {
  const p = getProvider();
  if (!p) return null;
  try {
    const hex = await p.request({ method: 'eth_chainId' });
    return parseInt(hex, 16);
  } catch {
    return null;
  }
}

/**
 * Switch to Robinhood Chain, adding it first if the wallet has never seen it.
 * 4902 is the "unrecognised chain" code every injected wallet returns.
 */
export async function switchToChain() {
  const p = getProvider();
  if (!p) throw new Error('Nenhuma carteira encontrada neste navegador.');
  try {
    await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN.hexId }] });
    return true;
  } catch (err) {
    if (err && (err.code === 4902 || err.code === -32603)) {
      await p.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: CHAIN.hexId,
          chainName: CHAIN.name,
          nativeCurrency: CHAIN.nativeCurrency,
          rpcUrls: CHAIN.rpcUrls,
          blockExplorerUrls: CHAIN.blockExplorerUrls,
        }],
      });
      return true;
    }
    if (err && err.code === 4001) throw new Error('Você recusou a troca de rede.');
    throw new Error(err?.message || 'Não consegui trocar de rede.');
  }
}

export async function getBalance(address) {
  const p = getProvider();
  if (!p || !address) return 0;
  try {
    const hex = await p.request({ method: 'eth_getBalance', params: [address, 'latest'] });
    return parseInt(hex, 16) / 1e18;
  } catch {
    return 0;
  }
}
