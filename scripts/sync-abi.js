#!/usr/bin/env node
/**
 * Regenerates frontend/src/sparkfun/lib/abi.js from the compiled contracts.
 * Run after any contract change: `cd contracts && npx hardhat compile && node ../scripts/sync-abi.js`
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const KEEP = {
  SparkFactory: ["launch", "TokenLaunched", "curveOfToken", "quotes", "curvesLength", "allCurves", "QuoteNotEnabled"],
  SparkCurve: [
    "buy", "sell", "previewBuy", "previewSell", "baseSold", "quoteRaised", "virtualBase0", "virtualQuote0",
    "graduationRaise", "progressBps", "quoteToGraduate", "graduated", "pool", "positionTokenId", "walletQuoteCap",
    "quoteSpent", "creatorFeeBps", "protocolFeeBps", "mayhem", "token", "quoteToken", "creator",
    "claimableCreatorFees", "claimCreatorFees", "claimProtocolFees", "collectPoolFees",
    "creatorFeesAccrued", "protocolFeesAccrued",
    "Bought", "Sold", "Graduated", "CreatorFeesClaimed",
    "SlippageExceeded", "WalletCapExceeded", "AlreadyGraduated", "ZeroAmount",
  ],
  SparkToken: ["name", "symbol", "decimals", "totalSupply", "balanceOf", "approve", "allowance", "transfer", "creator", "metadataURI"],
};
const EXPORT = { SparkFactory: "SPARK_FACTORY_ABI", SparkCurve: "SPARK_CURVE_ABI", SparkToken: "SPARK_TOKEN_ABI" };

let js = "/**\n * Contract ABIs, generated from contracts/artifacts by scripts/sync-abi.js.\n * Do not edit by hand — run `node scripts/sync-abi.js` after changing a contract.\n */\n\n";
for (const [name, keep] of Object.entries(KEEP)) {
  const file = path.join(ROOT, "contracts/artifacts/contracts", `${name}.sol`, `${name}.json`);
  const abi = JSON.parse(fs.readFileSync(file)).abi
    .filter((f) => ["event", "function", "error"].includes(f.type) && keep.includes(f.name));
  js += `export const ${EXPORT[name]} = ${JSON.stringify(abi, null, 2)};\n\n`;
}
fs.writeFileSync(path.join(ROOT, "frontend/src/sparkfun/lib/abi.js"), js);
console.log("wrote frontend/src/sparkfun/lib/abi.js");
