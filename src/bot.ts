// funding-keeper: scans every dreamDEX perp's funding, picks the richest one, and keeps a
// small position on the side that RECEIVES funding. It first quotes as a maker at the touch;
// if not filled within MAKER_WAIT_SEC it cancels and takes with an IOC. Exits when funding
// flips against it (or after the demo hold).
import { ex, market, place, cancel, close, position, mid, minQty } from "./perp.ts";
const env = (k: string, d: number) => (process.env[k] ? Number(process.env[k]) : d);
const MIN_RATE = env("MIN_ABS_RATE_8H", 0.00005), WAIT = env("MAKER_WAIT_SEC", 8), HOLD = env("HOLD_SEC", 20);
const mk = await ex.loadMarkets();
const perps = Object.values(mk).filter((m: any) => m.type === "swap") as any[];
const rows: any[] = [];
for (const m of perps) { try { const f = await ex.fetchFundingRate(m.symbol); rows.push({ symbol: m.symbol, base: m.info.baseSymbol, rate8h: f.fundingRate, apr: f.fundingRate * 3 * 365 * 100, mark: f.markPrice, minUsd: Number(m.info.minQuantity) / 10 ** m.info.baseDecimals * f.markPrice }); } catch {} }
rows.sort((a, b) => Math.abs(b.rate8h) - Math.abs(a.rate8h) || a.minUsd - b.minUsd);
console.table(rows.slice(0, 8).map((r) => ({ ...r, apr: r.apr.toFixed(2) + "%", minUsd: r.minUsd.toFixed(2) })));
const pick = rows[0];
if (!pick || Math.abs(pick.rate8h) < MIN_RATE) { console.log("no funding worth keeping"); process.exit(0); }
const side = pick.rate8h > 0 ? "short" : "long"; // positive funding: longs pay shorts
console.log(`keep ${side} ${pick.symbol}: funding ${pick.rate8h} per 8h (${pick.apr.toFixed(2)}% APR) is paid to ${side}s`);
const sym = pick.base; await market(sym); const q = await minQty(sym);
const { bid, ask, mid: md } = await mid(sym);
const makerPx = side === "short" ? (ask ?? md) : (bid ?? md);
const r = await place(sym, side, q, makerPx, "limit", "funding-maker-quote");
await new Promise((res) => setTimeout(res, WAIT * 1000));
const pos: any = await position(sym);
if (BigInt(pos.size) === 0n) {
  if (r.orderId !== undefined) await cancel(sym, r.orderId, "funding-maker-timeout");
  const t = await mid(sym); await place(sym, side, q, side === "short" ? (t.bid ?? md) * 0.99 : (t.ask ?? md) * 1.01, "market", "funding-taker");
}
console.log("position", (await position(sym) as any).size);
await new Promise((res) => setTimeout(res, HOLD * 1000));
const f = await ex.fetchFundingRate(pick.symbol);
const flipped = side === "short" ? f.fundingRate <= 0 : f.fundingRate >= 0;
if (flipped || process.env.KEEP !== "true") await close(sym, flipped ? "funding-flipped-exit" : "funding-demo-exit");
process.exit(0);
