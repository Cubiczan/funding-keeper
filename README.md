# Funding Keeper — dreamDEX perps bot

Scans funding on all 21 dreamDEX perps, picks the market with the richest funding, and keeps a small position on the side that receives it. It quotes as a maker at the touch first. If that quote doesn't fill within `MAKER_WAIT_SEC`, it cancels and takes with an IOC. It exits when funding flips against it (or after the demo hold).

Built for the Somnia **dreamDEX Perps Builder Bounty** with [`@somnia-chain/markets-sdk`](https://www.npmjs.com/package/@somnia-chain/markets-sdk) 0.32.1. It runs on the **Hideki testnet** (chain 50383), where app.testnet.dreamdex.io lives. Order sizes are the market minimum.

## Setup
```bash
git clone https://github.com/icohangar-ops/funding-keeper && cd funding-keeper
npm install
cp .env.example .env        # PRIVATE_KEY of a throwaway Hideki testnet wallet
```
The wallet needs:
- a little STT for gas, from the Somnia faucet.
- USDso in its dreamDEX MarginBank: deposit in the app, or call `trader.depositMargin`.

```bash
npm run dry                 # DRY_RUN=true: logs intended orders, sends nothing
DRY_RUN=false HOLD_SEC=10 npm start   # live
```
Each live order is appended to `txs.jsonl` (kind, tag, symbol, size, tx hash).

### Config (env)
`MIN_ABS_RATE_8H` (0.00005), `MAKER_WAIT_SEC` (8), `HOLD_SEC` (20), `KEEP` (true keeps the position unless funding flips)

## How it works
- `src/lib.ts` connects `SomniaMarkets` to Hideki (RPC `https://api.hideki2.infra.testnet.somnia.network`, indexer `https://hideki-dev.smk.somnia.host/v1/graphql`).
- `src/perp.ts` holds thin helpers: place (limit or IOC), cancel, close, position and margin reads, all tick- and lot-aligned.
- `src/bot.ts` holds the strategy.

## Real testnet run (Hideki, 2026-10-21 UTC)
BTC funding was +0.119% per 8 h (≈130% APR), which is paid to shorts. The maker quote didn't fill in 8 s, so the bot cancelled it, shorted the 0.00013 BTC minimum by IOC, and exited after the hold.

Account `0xdFAFacBA862d1a9d6fb94eCE7842E95e7091DCbD`

| action | tag | market | size | tx hash |
|---|---|---|---|---|
| place limit short | funding-maker-quote | BTC/USDso:USDso | 0.00013 | `0x3d09619a809d02d904e870dd93764ef9fa9d03541fdf6d80096ef60077d81921` |
| cancel | funding-maker-timeout | BTC/USDso:USDso |  | `0x39b7f48ad9f90fa287cffb677096d140652f6902995f7bbb98162bb0910d1b61` |
| place market short | funding-taker | BTC/USDso:USDso | 0.00013 | `0xd2224aeb885534a2abaffc49291336ef3350944165a42c55f9e5fb3677ea4db5` |
| place market long | funding-demo-exit | BTC/USDso:USDso | 0.00013 | `0x7bd9c063ca85f34c1fa1117c2e7cb3956bd9d937dc6f47820a99545c6f93867d` |

Verify any of these with `eth_getTransactionReceipt` against `https://api.hideki2.infra.testnet.somnia.network`.

## Disclaimer
This is testnet software, not financial advice. Never put a mainnet key in `.env`.
