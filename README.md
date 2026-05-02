# Blockchain-Based Pharmaceutical Supply Chain Provenance System

Academic prototype for CSE 540: batch-level provenance on Ethereum (local Hardhat), with a React + MetaMask frontend and Solidity contracts using role-based access, events, custom errors, and tests.

## Architecture (from proposal)

| Piece | Role |
|--------|------|
| **Smart contract** | Stores batch ownership, status, immutable process history; RBAC; JSON strings for off-chain-style detail |
| **Frontend** | MetaMask + Ethers.js v6 to call the contract and show lifecycle/history |
| **Hardhat local network** | Local testnet (`localhost`, chain id **31337**) |

**Stakeholders:** Manufacturer (creates batches), Distributor, Pharmacy, Auditor (`verifyBatch` after **Delivered**), plus Admin (deployer, assigns roles).

## Prerequisites

- Node.js 18+ (20 LTS recommended)
- npm
- MetaMask browser extension

## One-time setup

```bash
git clone <repo-url>
cd Team6_2026SpringB_CSE540_BlockchainBasedPharmaceuticalSupplyChainProvenanceSystemSmartContractDesign
npm install
npx hardhat compile
npm run copy-abi
```

`copy-abi` copies `artifacts/.../PharmaSupplyChain.json` → `frontend/src/abi/PharmaSupplyChain.json`. Run it again whenever the contract ABI changes.

```bash
cd frontend && npm install && cd ..
```

## Run the local blockchain

**Terminal 1 — keep this running:**

```bash
npx hardhat node
```

Copy one or more **private keys** from the printed accounts list if you want to import them into MetaMask (each role can use a different account).

## Deploy the contract (localhost)

**Terminal 2:**

```bash
npm run deploy:local
```

Note the printed address. It is also saved to `deployments/localhost.json`.

## Point the React app at the contract

```bash
cp frontend/.env.example frontend/.env.local
```

Edit `frontend/.env.local` and set:

```bash
VITE_CONTRACT_ADDRESS=<paste_deployed_address>
VITE_OFFCHAIN_API_URL=http://127.0.0.1:8787
```

## Run the local off-chain JSON store (CID addressed)

**Terminal 2 (or any free terminal):**

```bash
npm run offchain
```

This starts a small Express server that stores JSON on disk in `offchain/storage/` and returns an **IPFS-style CID** (CIDv0-like base58 multihash of the JSON content).

## Configure MetaMask for Hardhat

1. Open MetaMask → **Networks** → **Add network** → **Add a network manually**.
2. **Network name:** `Hardhat Local`  
   **RPC URL:** `http://127.0.0.1:8545`  
   **Chain ID:** `31337`  
   **Currency symbol:** `ETH`
3. Import a private key from the `hardhat node` terminal (e.g. account #0 is deployer / admin / manufacturer).

Use additional imported accounts for distributor, pharmacy, and auditor after the admin assigns roles in the UI.

## Start the frontend

**Terminal 3:**

```bash
cd frontend
npm run dev
```

Open the URL shown (usually `http://localhost:5173`). Click **Connect MetaMask**, then **Switch to Hardhat Local (31337)** if prompted.

### Typical UI workflow

1. **Admin (deployer):** **Assign role** — grant Distributor / Pharmacy / Auditor to addresses you control (other imported accounts).
2. **Manufacturer:** **Create batch** — numeric batch ID + metadata (string or JSON).
3. **Current owner:** **Transfer** custody to the next stakeholder (receiver must already have a non-`None` role).
4. **Owner:** **Log process step** — step name + JSON `data` (shipment, temperature, etc.).
5. **Pharmacy (as owner):** **Update status** to **Delivered** after receipt.
6. **Auditor:** **Mark verified** — sets status to **Verified** (only after **Delivered**).
7. **Read:** load batch ID to see owner, status, metadata, and full provenance list.

## Scripts reference (repo root)

| Command | Purpose |
|---------|---------|
| `npm run compile` | Compile Solidity |
| `npm run copy-abi` | Refresh `frontend/src/abi` after compile |
| `npm run test` | Hardhat tests |
| `npx hardhat node` | Local chain |
| `npm run deploy:local` | Deploy to `localhost` and write `deployments/localhost.json` |
| `npm run demo` | Scripted full flow (deploys a **new** contract instance on `localhost`) |

## Automated demo (optional)

With Terminal 1 (`hardhat node`) running:

```bash
npm run demo
```

This deploys a fresh contract and walks manufacturer → distributor → pharmacy → auditor. It does **not** update `frontend/.env.local`; use the address printed in that run only if you point the UI at that deployment.

## Smart contract overview

- **File:** `contracts/PharmaSupplyChain.sol`
- **RBAC:** `assignRole` (admin only); operations gated by `Role` (Manufacturer, Distributor, Pharmacy, Auditor).
- **Custom errors** for validation and clearer reverts.
- **Events:** batch creation, transfers, process logs, status updates, auditor verification.
- **Verified status:** only via `verifyBatch` by an Auditor after **Delivered**; owners cannot set `Verified` through `updateStatus`.
- **Off-chain JSON references:** `logProcessStep` stores only a CID string on-chain; the JSON lives in the local off-chain store.

## Testing

```bash
npm run test
```

Covers happy paths (create, transfer, log, deliver, verify) and edge cases (duplicate batch, empty metadata, unauthorized actions, auditor timing).

## Project structure

```
contracts/PharmaSupplyChain.sol   # Main contract
scripts/deploy.js                 # Deploy + save deployments/localhost.json
scripts/copy-abi.js               # ABI → frontend
scripts/demo.js                   # Full-flow CLI demo
test/PharmaSupplyChain.test.js    # Hardhat tests
frontend/                         # Vite + React + ethers + MetaMask
```

## Contributors

- Kannan Meiappan  
- Lingya Chen  
- Priyananda Vangala  
- Yunlin Xie  

## Disclaimer

Educational prototype only — not for production or regulatory compliance.
