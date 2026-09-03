/**
 * Live curve state read straight from the chain.
 *
 * The backend indexes events for discovery and history, but anything a trade
 * depends on is read from the contract: a cache that is one block stale would
 * quote a price the chain will not honour.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { readBalance, readCurve } from '../lib/contracts';
import { publicClient } from '../lib/chain';
import { SPARK_CURVE_ABI } from '../lib/abi';

/** Poll cadence. Blocks are ~100ms; polling that fast would be pointless
 *  traffic, and the event watcher below covers anything that actually moves. */
const POLL_MS = 4000;

export function useCurveState(curveAddress, tokenAddress, account) {
  const [state, setState] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(0n);
  const [error, setError] = useState(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    if (!curveAddress) return;
    try {
      const [curve, balance] = await Promise.all([
        readCurve(curveAddress),
        tokenAddress && account ? readBalance(tokenAddress, account) : Promise.resolve(0n),
      ]);
      if (!alive.current) return;

      let quoteSpent;
      if (account && curve.walletQuoteCap > 0n) {
        quoteSpent = await publicClient.readContract({
          address: curveAddress, abi: SPARK_CURVE_ABI, functionName: 'quoteSpent', args: [account],
        });
      }
      if (!alive.current) return;
      setState({ ...curve, quoteSpent });
      setTokenBalance(balance);
      setError(null);
    } catch (err) {
      if (alive.current) setError(err.message);
    }
  }, [curveAddress, tokenAddress, account]);

  useEffect(() => {
    alive.current = true;
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => { alive.current = false; clearInterval(id); };
  }, [refresh]);

  // Anyone's trade moves the curve, so watch the events rather than waiting
  // for the next poll.
  useEffect(() => {
    if (!curveAddress) return undefined;
    const unwatch = publicClient.watchContractEvent({
      address: curveAddress,
      abi: SPARK_CURVE_ABI,
      onLogs: () => refresh(),
      onError: () => {},
    });
    return () => unwatch?.();
  }, [curveAddress, refresh]);

  return { state, tokenBalance, error, refresh };
}
