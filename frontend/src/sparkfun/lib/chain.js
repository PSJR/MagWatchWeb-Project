/**
 * Robinhood Chain configuration and viem clients.
 *
 * Every address and endpoint here was verified against the chain itself:
 *   eth_chainId on the mainnet RPC returns 0x1237 (4663)
 *   positionManager.factory() returns the Uniswap V3 factory below
 *   positionManager.WETH9()   returns the WETH below
 */
import { createPublicClient, createWalletClient, custom, defineChain, http } from 'viem';

const env = (key, fallback = '') => (process.env[key] || fallback).trim();

export const CHAIN_ID = Number(env('REACT_APP_CHAIN_ID', '4663'));
const IS_TESTNET = CHAIN_ID === 46630;

export const CHAIN = defineChain({
  id: CHAIN_ID,
  name: IS_TESTNET ? 'Robinhood Chain Testnet' : 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: [env(
        'REACT_APP_RPC_URL',
        IS_TESTNET
          ? 'https://rpc.testnet.chain.robinhood.com'
          : 'https://rpc.mainnet.chain.robinhood.com',
      )],
    },
  },
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url: env('REACT_APP_EXPLORER_URL', 'https://robinhoodchain.blockscout.com'),
    },
  },
});

/** Arbitrum Orbit, ~100ms blocks — the number the whole UI is paced around. */
export const BLOCK_TIME_MS = 100;
export const CHAIN_STACK = 'Arbitrum Orbit';

export const CONTRACTS = {
  factory: env('REACT_APP_SPARK_FACTORY'),
  uniswapV3Factory: '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA',
  positionManager: '0x73991a25c818bf1f1128deaab1492d45638de0d3',
  weth: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
  usdc: env('REACT_APP_USDC_ADDRESS') || null,
};

export const POOL_FEE = 10_000; // 1%, matching SparkCurve.POOL_FEE

/** True once a factory address is configured; the UI degrades honestly without it. */
export const isDeployed = () => Boolean(CONTRACTS.factory);

export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(CHAIN.rpcUrls.default.http[0], { batch: true }),
});

export function walletClientFrom(provider, account) {
  return createWalletClient({ account, chain: CHAIN, transport: custom(provider) });
}

export const explorer = {
  tx: (hash) => `${CHAIN.blockExplorers.default.url}/tx/${hash}`,
  address: (addr) => `${CHAIN.blockExplorers.default.url}/address/${addr}`,
  token: (addr) => `${CHAIN.blockExplorers.default.url}/token/${addr}`,
};

export const uniswapTradeUrl = (token) =>
  `https://app.uniswap.org/swap?chain=${CHAIN_ID}&outputCurrency=${token}`;

/** Turns a contract revert into something a person can act on. */
export function humanizeChainError(err) {
  const raw = err?.shortMessage || err?.details || err?.message || '';
  const name = err?.cause?.data?.errorName || err?.data?.errorName || '';

  if (/User rejected|denied transaction|4001/i.test(raw)) return 'Você cancelou na carteira.';
  if (name === 'SlippageExceeded' || /SlippageExceeded/.test(raw)) {
    return 'O preço mexeu mais que o combinado. Tentar com margem maior?';
  }
  if (name === 'WalletCapExceeded' || /WalletCapExceeded/.test(raw)) {
    return 'Isso passa do limite por carteira deste token. Tokens em Fogo Selvagem não têm limite.';
  }
  if (name === 'AlreadyGraduated' || /AlreadyGraduated/.test(raw)) {
    return 'Este token já graduou — negocie na pool do Uniswap V3.';
  }
  if (name === 'ZeroAmount' || /ZeroAmount/.test(raw)) return 'Esse valor é pequeno demais.';
  if (/insufficient funds/i.test(raw)) return 'Faltou um tiquinho de ETH pro gas. Quer adicionar?';
  if (/nonce|replacement/i.test(raw)) return 'Tem outra transação sua na fila. Espere ela confirmar.';
  return raw || 'Não deu certo dessa vez. Tente de novo.';
}
