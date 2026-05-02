import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, ethers } from "ethers";
import artifact from "./abi/PharmaSupplyChain.json";
import "./App.css";

const HARDHAT_CHAIN_ID = "0x7a69"; // 31337
const HARDHAT_RPC = "http://127.0.0.1:8545";

const ROLE_LABELS = ["None", "Manufacturer", "Distributor", "Pharmacy", "Auditor"];
const STATUS_LABELS = ["Created", "InTransit", "Delivered", "Verified"];

function formatError(err) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err.reason) return err.reason;
  if (err.shortMessage) return err.shortMessage;
  return err.message || String(err);
}

export default function App() {
  const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS || "";
  const offchainApiUrl = import.meta.env.VITE_OFFCHAIN_API_URL || "http://127.0.0.1:8787";

  const [account, setAccount] = useState("");
  const [chainHex, setChainHex] = useState("");
  const [roleId, setRoleId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [assignAddr, setAssignAddr] = useState("");
  const [assignRole, setAssignRole] = useState(2);

  const [batchIdCreate, setBatchIdCreate] = useState("");
  const [metaCreate, setMetaCreate] = useState('{"drugName":"Example","lot":"L-001"}');

  const [batchIdTransfer, setBatchIdTransfer] = useState("");
  const [transferTo, setTransferTo] = useState("");

  const [batchIdLog, setBatchIdLog] = useState("");
  const [stepLog, setStepLog] = useState("Shipped");
  const [dataLog, setDataLog] = useState('{"carrier":"Demo Logistics","tempC":"4"}');

  const [batchIdStatus, setBatchIdStatus] = useState("");
  const [nextStatus, setNextStatus] = useState(2);

  const [batchIdVerify, setBatchIdVerify] = useState("");

  const [lookupId, setLookupId] = useState("");
  const [batchView, setBatchView] = useState(null);
  const [historyView, setHistoryView] = useState([]);
  const [historyOffchain, setHistoryOffchain] = useState({});

  const onCorrectChain = chainHex === HARDHAT_CHAIN_ID;

  const providerReady = typeof window !== "undefined" && window.ethereum;

  const refreshRole = useCallback(async () => {
    if (!providerReady || !account || !contractAddress || !onCorrectChain) {
      setRoleId(null);
      return;
    }
    try {
      const provider = new BrowserProvider(window.ethereum);
      const c = new Contract(contractAddress, artifact.abi, provider);
      const r = await c.getRole(account);
      setRoleId(Number(r));
    } catch {
      setRoleId(null);
    }
  }, [account, contractAddress, onCorrectChain, providerReady]);

  useEffect(() => {
    refreshRole();
  }, [refreshRole]);

  useEffect(() => {
    if (!providerReady) return;
    const eth = window.ethereum;
    eth.request({ method: "eth_chainId" }).then(setChainHex).catch(() => {});
    eth.on?.("chainChanged", (hex) => setChainHex(hex));
    eth.on?.("accountsChanged", (accs) => setAccount(accs[0] || ""));
    return () => {
      eth.removeListener?.("chainChanged", setChainHex);
      eth.removeListener?.("accountsChanged", setAccount);
    };
  }, [providerReady]);

  const connectWallet = async () => {
    setErrorMsg("");
    setStatusMsg("");
    if (!providerReady) {
      setErrorMsg("Install MetaMask to use this dApp.");
      return;
    }
    try {
      const eth = window.ethereum;
      const accs = await eth.request({ method: "eth_requestAccounts" });
      setAccount(accs[0] || "");
      const cid = await eth.request({ method: "eth_chainId" });
      setChainHex(cid);
    } catch (e) {
      setErrorMsg(formatError(e));
    }
  };

  const switchToHardhat = async () => {
    setErrorMsg("");
    const eth = window.ethereum;
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: HARDHAT_CHAIN_ID }],
      });
    } catch (e) {
      if (e.code === 4902 || e?.data?.originalError?.code === 4902) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: HARDHAT_CHAIN_ID,
              chainName: "Hardhat Local",
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: [HARDHAT_RPC],
            },
          ],
        });
      } else {
        setErrorMsg(formatError(e));
      }
    }
    const cid = await eth.request({ method: "eth_chainId" });
    setChainHex(cid);
  };

  const runTx = async (fn) => {
    setBusy(true);
    setErrorMsg("");
    setStatusMsg("");
    try {
      await fn();
      setStatusMsg("Transaction confirmed.");
      await refreshRole();
    } catch (e) {
      setErrorMsg(formatError(e));
    } finally {
      setBusy(false);
    }
  };

  const getSignerContract = async () => {
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new Contract(contractAddress, artifact.abi, signer);
  };

  const handleAssignRole = () =>
    runTx(async () => {
      const c = await getSignerContract();
      const tx = await c.assignRole(ethers.getAddress(assignAddr), assignRole);
      await tx.wait();
    });

  const handleCreateBatch = () =>
    runTx(async () => {
      const c = await getSignerContract();
      const id = BigInt(batchIdCreate.trim());
      const tx = await c.createBatch(id, metaCreate.trim());
      await tx.wait();
    });

  const handleTransfer = () =>
    runTx(async () => {
      const c = await getSignerContract();
      const id = BigInt(batchIdTransfer.trim());
      const tx = await c.transferBatch(id, ethers.getAddress(transferTo.trim()));
      await tx.wait();
    });

  const handleLog = () =>
    runTx(async () => {
      const c = await getSignerContract();
      const id = BigInt(batchIdLog.trim());
      // Store JSON off-chain first, then put CID on-chain
      let parsed;
      try {
        parsed = JSON.parse(dataLog);
      } catch {
        throw new Error("Data must be valid JSON (off-chain store hashes JSON content).");
      }
      const resp = await fetch(`${offchainApiUrl}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: parsed }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`Off-chain store error: ${t}`);
      }
      const { cid } = await resp.json();
      const tx = await c.logProcessStep(id, stepLog.trim(), cid);
      await tx.wait();
    });

  const handleUpdateStatus = () =>
    runTx(async () => {
      const c = await getSignerContract();
      const id = BigInt(batchIdStatus.trim());
      const tx = await c.updateStatus(id, nextStatus);
      await tx.wait();
    });

  const handleVerify = () =>
    runTx(async () => {
      const c = await getSignerContract();
      const id = BigInt(batchIdVerify.trim());
      const tx = await c.verifyBatch(id);
      await tx.wait();
    });

  const loadBatch = async () => {
    setErrorMsg("");
    setBatchView(null);
    setHistoryView([]);
    setHistoryOffchain({});
    if (!contractAddress || !lookupId.trim()) {
      setErrorMsg("Enter a batch ID and deploy address (.env).");
      return;
    }
    if (!providerReady || !onCorrectChain) {
      setErrorMsg("Connect wallet and switch to Hardhat (31337).");
      return;
    }
    setBusy(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const c = new Contract(contractAddress, artifact.abi, provider);
      const id = BigInt(lookupId.trim());
      const b = await c.getBatch(id);
      const h = await c.getBatchHistory(id);
      setBatchView({
        id: b.id.toString(),
        owner: b.owner,
        metadata: b.metadata,
        status: Number(b.status),
        exists: b.exists,
      });
      setHistoryView(
        h.map((row) => ({
          step: row.step,
          cid: row.cid,
          timestamp: Number(row.timestamp),
          actor: row.actor,
        }))
      );

      // Best-effort: fetch off-chain JSON for any CID entries
      const cidRows = h
        .map((row) => row.cid)
        .filter((cid) => typeof cid === "string" && cid.length > 0);
      const uniqueCids = Array.from(new Set(cidRows));
      const fetched = {};
      await Promise.all(
        uniqueCids.map(async (cid) => {
          try {
            const r = await fetch(`${offchainApiUrl}/records/${cid}`);
            if (!r.ok) return;
            const txt = await r.text();
            fetched[cid] = txt;
          } catch {
            // ignore
          }
        })
      );
      setHistoryOffchain(fetched);
    } catch (e) {
      setErrorMsg(formatError(e));
    } finally {
      setBusy(false);
    }
  };

  const roleLabel = useMemo(() => {
    if (roleId === null || roleId === undefined) return "—";
    return ROLE_LABELS[roleId] ?? String(roleId);
  }, [roleId]);

  return (
    <div className="app">
      <header className="banner">
        <h1>Pharmaceutical Supply Chain Provenance</h1>
        <p>CSE 540 — batch tracking with MetaMask on a local Hardhat network.</p>
      </header>

      {!providerReady && (
        <div className="alert alert-error">MetaMask was not detected. Install the extension to continue.</div>
      )}

      {!contractAddress && (
        <div className="alert alert-warn">
          Set <code>VITE_CONTRACT_ADDRESS</code> in <code>frontend/.env.local</code> after deploying (see README).
        </div>
      )}

      <div className="wallet-row">
        <button type="button" className="btn" onClick={connectWallet} disabled={!providerReady}>
          {account ? "Reconnect" : "Connect MetaMask"}
        </button>
        {account && (
          <>
            <span className="chip">
              Account: <span className="mono">{account}</span>
            </span>
            <span className="chip">On-chain role: {roleLabel}</span>
          </>
        )}
      </div>

      {account && (
        <div className="wallet-row">
          <span className="chip">Chain: {chainHex || "?"}</span>
          {!onCorrectChain && (
            <button type="button" className="btn btn-secondary" onClick={switchToHardhat}>
              Switch to Hardhat Local (31337)
            </button>
          )}
        </div>
      )}

      {errorMsg && <div className="alert alert-error">{errorMsg}</div>}
      {statusMsg && <div className="alert alert-warn">{statusMsg}</div>}

      <div className="grid cols-2">
        <section className="card">
          <h2>Admin — assign role</h2>
          <p style={{ fontSize: "0.9rem", color: "#475569", marginTop: 0 }}>
            Only the deployer account can assign roles.
          </p>
          <div className="field">
            <label htmlFor="assignAddr">Participant address</label>
            <input
              id="assignAddr"
              value={assignAddr}
              onChange={(e) => setAssignAddr(e.target.value)}
              placeholder="0x…"
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="assignRole">Role</label>
            <select id="assignRole" value={assignRole} onChange={(e) => setAssignRole(Number(e.target.value))}>
              <option value={1}>Manufacturer</option>
              <option value={2}>Distributor</option>
              <option value={3}>Pharmacy</option>
              <option value={4}>Auditor</option>
            </select>
          </div>
          <button type="button" className="btn" disabled={busy || !onCorrectChain || !contractAddress} onClick={handleAssignRole}>
            Assign role
          </button>
        </section>

        <section className="card">
          <h2>Manufacturer — create batch</h2>
          <div className="field">
            <label htmlFor="batchIdCreate">Batch ID (uint)</label>
            <input
              id="batchIdCreate"
              value={batchIdCreate}
              onChange={(e) => setBatchIdCreate(e.target.value)}
              placeholder="e.g. 1001"
            />
          </div>
          <div className="field">
            <label htmlFor="metaCreate">Metadata (string / JSON)</label>
            <textarea id="metaCreate" value={metaCreate} onChange={(e) => setMetaCreate(e.target.value)} />
          </div>
          <button type="button" className="btn" disabled={busy || !onCorrectChain || !contractAddress} onClick={handleCreateBatch}>
            Create batch
          </button>
        </section>

        <section className="card">
          <h2>Owner — transfer batch</h2>
          <div className="field">
            <label htmlFor="batchIdTransfer">Batch ID</label>
            <input id="batchIdTransfer" value={batchIdTransfer} onChange={(e) => setBatchIdTransfer(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="transferTo">Next holder (must have a role)</label>
            <input id="transferTo" value={transferTo} onChange={(e) => setTransferTo(e.target.value)} placeholder="0x…" />
          </div>
          <button type="button" className="btn" disabled={busy || !onCorrectChain || !contractAddress} onClick={handleTransfer}>
            Transfer ownership
          </button>
        </section>

        <section className="card">
          <h2>Owner — log process step</h2>
          <p style={{ fontSize: "0.9rem", color: "#475569", marginTop: 0 }}>
            This stores JSON in the local off-chain service and saves only a CID on-chain.
          </p>
          <div className="field">
            <label htmlFor="batchIdLog">Batch ID</label>
            <input id="batchIdLog" value={batchIdLog} onChange={(e) => setBatchIdLog(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="stepLog">Step label</label>
            <input id="stepLog" value={stepLog} onChange={(e) => setStepLog(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="dataLog">Data (JSON string)</label>
            <textarea id="dataLog" value={dataLog} onChange={(e) => setDataLog(e.target.value)} />
          </div>
          <button type="button" className="btn" disabled={busy || !onCorrectChain || !contractAddress} onClick={handleLog}>
            Log step
          </button>
        </section>

        <section className="card">
          <h2>Owner — update status</h2>
          <div className="field">
            <label htmlFor="batchIdStatus">Batch ID</label>
            <input id="batchIdStatus" value={batchIdStatus} onChange={(e) => setBatchIdStatus(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="nextStatus">New status (must increase)</label>
            <select id="nextStatus" value={nextStatus} onChange={(e) => setNextStatus(Number(e.target.value))}>
              <option value={1}>InTransit</option>
              <option value={2}>Delivered</option>
            </select>
          </div>
          <button type="button" className="btn" disabled={busy || !onCorrectChain || !contractAddress} onClick={handleUpdateStatus}>
            Update status
          </button>
        </section>

        <section className="card">
          <h2>Auditor — verify batch</h2>
          <p style={{ fontSize: "0.9rem", color: "#475569", marginTop: 0 }}>
            Requires status <strong>Delivered</strong> first (typically set by pharmacy).
          </p>
          <div className="field">
            <label htmlFor="batchIdVerify">Batch ID</label>
            <input id="batchIdVerify" value={batchIdVerify} onChange={(e) => setBatchIdVerify(e.target.value)} />
          </div>
          <button type="button" className="btn" disabled={busy || !onCorrectChain || !contractAddress} onClick={handleVerify}>
            Mark verified
          </button>
        </section>
      </div>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Read — batch & provenance</h2>
        <div className="field" style={{ maxWidth: 420 }}>
          <label htmlFor="lookupId">Batch ID</label>
          <input id="lookupId" value={lookupId} onChange={(e) => setLookupId(e.target.value)} />
        </div>
        <button type="button" className="btn btn-secondary" disabled={busy || !onCorrectChain || !contractAddress} onClick={loadBatch}>
          Load from chain
        </button>

        {batchView && (
          <div style={{ marginTop: "1rem" }}>
            <p>
              <strong>Owner:</strong> <span className="mono">{batchView.owner}</span>
            </p>
            <p>
              <strong>Status:</strong> {STATUS_LABELS[batchView.status] ?? batchView.status}
            </p>
            <p>
              <strong>Metadata:</strong> <span className="mono">{batchView.metadata}</span>
            </p>
          </div>
        )}

        {historyView.length > 0 && (
          <ul className="history-list">
            {historyView.map((row, i) => (
              <li key={`${row.timestamp}-${i}`}>
                <strong>{row.step}</strong> — {new Date(row.timestamp * 1000).toISOString()}
                <br />
                <span className="mono">actor: {row.actor}</span>
                <br />
                <span className="mono">cid: {row.cid || "—"}</span>
                {row.cid && historyOffchain[row.cid] && (
                  <>
                    <br />
                    <span className="mono">off-chain: {historyOffchain[row.cid]}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
