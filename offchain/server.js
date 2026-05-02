const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const bs58 = require("bs58");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 8787);
const STORAGE_DIR = path.join(__dirname, "storage");

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest();
}

// CIDv0-like string:
// - Multihash: <hashFunction=0x12 sha2-256><length=0x20><sha256(content)>
// - Base58btc encoding typically yields a string starting with "Qm"
function cidV0FromBytes(contentBytes) {
  const digest = sha256(contentBytes);
  const multihash = Buffer.concat([Buffer.from([0x12, 0x20]), digest]);
  return bs58.encode(multihash);
}

function recordPath(cid) {
  return path.join(STORAGE_DIR, `${cid}.json`);
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Store JSON as content-addressed blob
// Body: { json: <object or string>, contentType?: string }
// Returns: { cid }
app.post("/records", (req, res) => {
  try {
    const payload = req.body?.json;
    if (payload === undefined) {
      return res.status(400).json({ error: "Missing body.json" });
    }

    // Canonical-ish encoding: if object, stringify with stable key order (simple deep sort)
    const normalized =
      typeof payload === "string" ? payload : JSON.stringify(sortKeys(payload));
    const bytes = Buffer.from(normalized, "utf8");
    const cid = cidV0FromBytes(bytes);

    fs.mkdirSync(STORAGE_DIR, { recursive: true });
    const p = recordPath(cid);
    if (!fs.existsSync(p)) {
      fs.writeFileSync(p, normalized, "utf8");
    }
    return res.json({ cid });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

// Fetch JSON by CID
app.get("/records/:cid", (req, res) => {
  try {
    const cid = req.params.cid;
    const p = recordPath(cid);
    if (!fs.existsSync(p)) return res.status(404).json({ error: "Not found" });
    const raw = fs.readFileSync(p, "utf8");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.send(raw);
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

// Very small helper: stable key ordering so same object always produces same CID
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = sortKeys(value[k]);
    return out;
  }
  return value;
}

app.listen(PORT, () => {
  console.log(`Off-chain store listening on http://127.0.0.1:${PORT}`);
  console.log(`POST  /records  -> { cid }`);
  console.log(`GET   /records/:cid -> JSON`);
});

