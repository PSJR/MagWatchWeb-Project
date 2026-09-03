/**
 * On-chain reads and writes.
 *
 * Reads go straight to the RPC so the trade panel never shows stale curve
 * state; the backend is a cache and an index, not an authority. Writes are
 * simulated first, so a revert surfaces as a readable message before the wallet
 * ever opens.
 */
import { erc20Abi, maxUint256, parseEventLogs } from 'viem';
import { SPARK_CURVE_ABI, SPARK_FACTORY_ABI, SPARK_TOKEN_ABI } from './abi';
import { CONTRACTS, humanizeChainError, publicClient } from './chain';

const factoryContract = () => {
  if (!CONTRACTS.factory) {
    throw new Error('A launchpad ainda não foi publicada nesta rede.');
  }
  return { address: CONTRACTS.factory, abi: SPARK_FACTORY_ABI };
};

/** Full curve state in a single multicall. */
export async function readCurve(curveAddress) {
  const base = { address: curveAddress, abi: SPARK_CURVE_ABI };
  const fields = [
    'token', 'quoteToken', 'creator', 'baseSold', 'quoteRaised', 'virtualBase0', 'virtualQuote0',
    'graduationRaise', 'graduated', 'pool', 'positionTokenId', 'walletQuoteCap',
    'creatorFeeBps', 'protocolFeeBps', 'mayhem', 'creatorFeesAccrued', 'protocolFeesAccrued',
  ];

  const results = await publicClient.multicall({
    contracts: fields.map((functionName) => ({ ...base, functionName })),
    allowFailure: false,
  });

  const state = Object.fromEntries(fields.map((f, i) => [f, results[i]]));
  return {
    address: curveAddress,
    token: state.token,
    quoteToken: state.quoteToken,
    creator: state.creator,
    baseSold: state.baseSold,
    quoteRaised: state.quoteRaised,
    virtualBase0: state.virtualBase0,
    virtualQuote0: state.virtualQuote0,
    graduationRaise: state.graduationRaise,
    graduated: state.graduated,
    pool: state.pool,
    positionTokenId: state.positionTokenId,
    walletQuoteCap: state.walletQuoteCap,
    creatorFeeBps: BigInt(state.creatorFeeBps),
    protocolFeeBps: BigInt(state.protocolFeeBps),
    mayhem: state.mayhem,
    creatorFeesAccrued: state.creatorFeesAccrued,
    protocolFeesAccrued: state.protocolFeesAccrued,
  };
}

export async function readTokenMeta(tokenAddress) {
  const base = { address: tokenAddress, abi: SPARK_TOKEN_ABI };
  const [name, symbol, metadataURI, creator] = await publicClient.multicall({
    contracts: [
      { ...base, functionName: 'name' },
      { ...base, functionName: 'symbol' },
      { ...base, functionName: 'metadataURI' },
      { ...base, functionName: 'creator' },
    ],
    allowFailure: false,
  });
  return { name, symbol, metadataURI, creator };
}

export async function readBalance(tokenAddress, owner) {
  if (!owner) return 0n;
  return publicClient.readContract({
    address: tokenAddress, abi: erc20Abi, functionName: 'balanceOf', args: [owner],
  });
}

/** The contract's own quote — authoritative, used to cross-check the preview. */
export async function previewBuyOnChain(curveAddress, quoteIn) {
  const [baseOut, creatorFee, protocolFee, refund] = await publicClient.readContract({
    address: curveAddress, abi: SPARK_CURVE_ABI, functionName: 'previewBuy', args: [quoteIn],
  });
  return { baseOut, creatorFee, protocolFee, refund };
}

export async function previewSellOnChain(curveAddress, baseIn) {
  const [quoteOut, creatorFee, protocolFee] = await publicClient.readContract({
    address: curveAddress, abi: SPARK_CURVE_ABI, functionName: 'previewSell', args: [baseIn],
  });
  return { quoteOut, creatorFee, protocolFee };
}

async function send(walletClient, request) {
  const hash = await walletClient.writeContract(request);
  // ~100ms blocks: this resolves faster than the success animation finishes.
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  if (receipt.status !== 'success') throw new Error('A transação foi revertida na chain.');
  return receipt;
}

function wrap(err) {
  const e = new Error(humanizeChainError(err));
  e.cause = err;
  return e;
}

export async function buy({ walletClient, account, curveAddress, quoteToken, amount, minBaseOut }) {
  try {
    const isNative = !quoteToken || quoteToken === '0x0000000000000000000000000000000000000000';
    if (!isNative) await ensureAllowance({ walletClient, account, token: quoteToken, spender: curveAddress, amount });

    const { request } = await publicClient.simulateContract({
      address: curveAddress,
      abi: SPARK_CURVE_ABI,
      functionName: 'buy',
      args: [isNative ? 0n : amount, minBaseOut, account],
      account,
      value: isNative ? amount : 0n,
    });
    const receipt = await send(walletClient, request);
    const [event] = parseEventLogs({ abi: SPARK_CURVE_ABI, eventName: 'Bought', logs: receipt.logs });
    return { receipt, hash: receipt.transactionHash, event: event?.args };
  } catch (err) {
    throw wrap(err);
  }
}

export async function sell({ walletClient, account, curveAddress, tokenAddress, amount, minQuoteOut }) {
  try {
    await ensureAllowance({ walletClient, account, token: tokenAddress, spender: curveAddress, amount });

    const { request } = await publicClient.simulateContract({
      address: curveAddress,
      abi: SPARK_CURVE_ABI,
      functionName: 'sell',
      args: [amount, minQuoteOut, account],
      account,
    });
    const receipt = await send(walletClient, request);
    const [event] = parseEventLogs({ abi: SPARK_CURVE_ABI, eventName: 'Sold', logs: receipt.logs });
    return { receipt, hash: receipt.transactionHash, event: event?.args };
  } catch (err) {
    throw wrap(err);
  }
}

export async function launchToken({ walletClient, account, name, symbol, metadataURI, quoteToken, mayhem, devBuy }) {
  try {
    const isNative = !quoteToken;
    const params = {
      name,
      symbol,
      metadataURI: metadataURI || '',
      quoteToken: quoteToken || '0x0000000000000000000000000000000000000000',
      mayhem: Boolean(mayhem),
      devBuy: devBuy || 0n,
      devBuyMinOut: 0n,
    };

    if (!isNative && params.devBuy > 0n) {
      await ensureAllowance({
        walletClient, account, token: quoteToken, spender: CONTRACTS.factory, amount: params.devBuy,
      });
    }

    const { request } = await publicClient.simulateContract({
      ...factoryContract(),
      functionName: 'launch',
      args: [params],
      account,
      value: isNative ? params.devBuy : 0n,
    });
    const receipt = await send(walletClient, request);
    const [event] = parseEventLogs({ abi: SPARK_FACTORY_ABI, eventName: 'TokenLaunched', logs: receipt.logs });
    if (!event) throw new Error('O token foi criado mas não consegui ler o evento.');
    return { hash: receipt.transactionHash, token: event.args.token, curve: event.args.curve };
  } catch (err) {
    throw wrap(err);
  }
}

export async function claimCreatorFees({ walletClient, account, curveAddress }) {
  try {
    const { request } = await publicClient.simulateContract({
      address: curveAddress, abi: SPARK_CURVE_ABI, functionName: 'claimCreatorFees', account,
    });
    const receipt = await send(walletClient, request);
    return receipt.transactionHash;
  } catch (err) {
    throw wrap(err);
  }
}

export async function readClaimableFees(curveAddress) {
  return publicClient.readContract({
    address: curveAddress, abi: SPARK_CURVE_ABI, functionName: 'claimableCreatorFees',
  });
}

/** Approves only when the current allowance is short, and approves exactly. */
async function ensureAllowance({ walletClient, account, token, spender, amount }) {
  const current = await publicClient.readContract({
    address: token, abi: erc20Abi, functionName: 'allowance', args: [account, spender],
  });
  if (current >= amount) return;

  const { request } = await publicClient.simulateContract({
    address: token,
    abi: erc20Abi,
    functionName: 'approve',
    // Some tokens require the allowance to be reset to zero first; approving
    // the exact amount avoids both that and a standing unlimited allowance.
    args: [spender, amount === maxUint256 ? maxUint256 : amount],
    account,
  });
  await send(walletClient, request);
}

export async function curveOfToken(tokenAddress) {
  return publicClient.readContract({
    ...factoryContract(), functionName: 'curveOfToken', args: [tokenAddress],
  });
}
