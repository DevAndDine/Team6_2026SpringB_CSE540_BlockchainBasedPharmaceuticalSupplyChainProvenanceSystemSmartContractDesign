require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { ethers } = require("ethers");

const app = express();

app.use(cors());
app.use(express.json());

const {
  PORT,
  RPC_URL,
  PRIVATE_KEY,
  CONTRACT_ADDRESS,
  PINATA_JWT,
} = process.env;

const CONTRACT_ABI = [
  "function assignRole(address user, uint8 role) public",
  "function createBatch(uint256 id, string memory metadata) public",
  "function transferBatch(uint256 id, address newOwner) public",
  "function logProcessStep(uint256 id, string memory step, string memory data) public",
  "function getBatch(uint256 id) public view returns (uint256 idOut, address owner, string memory metadata, uint8 status, uint256 createdAt, bool exists)",
  "function getBatchHistory(uint256 id) public view returns (tuple(string step,string data,uint256 timestamp,address actor)[] memory)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

const STATUS = ["Created", "InTransit", "Delivered", "Verified"];

async function uploadJsonToIPFS(metadata) {
  const response = await axios.post(
    "https://api.pinata.cloud/pinning/pinJSONToIPFS",
    metadata,
    {
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        "Content-Type": "application/json",
      },
    }
  );

  return `ipfs://${response.data.IpfsHash}`;
}

app.get("/", (req, res) => {
  res.json({
    message: "Pharma Supply Chain Backend API is running",
  });
});

app.post("/api/upload-metadata", async (req, res) => {
  try {
    const ipfsUri = await uploadJsonToIPFS(req.body);

    res.json({
      success: true,
      ipfsUri,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message,
    });
  }
});

app.post("/api/assign-role", async (req, res) => {
  try {
    const { user, role } = req.body;

    const tx = await contract.assignRole(user, role);
    const receipt = await tx.wait();

    res.json({
      success: true,
      txHash: receipt.hash,
      gasUsed: receipt.gasUsed.toString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.reason || error.shortMessage || error.message,
    });
  }
});

app.post("/api/create-batch", async (req, res) => {
  try {
    const { id, metadata } = req.body;

    const ipfsUri = await uploadJsonToIPFS(metadata);

    const tx = await contract.createBatch(id, ipfsUri);
    const receipt = await tx.wait();

    res.json({
      success: true,
      batchId: id,
      ipfsUri,
      txHash: receipt.hash,
      gasUsed: receipt.gasUsed.toString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.reason || error.shortMessage || error.message,
    });
  }
});

app.post("/api/transfer-batch", async (req, res) => {
  try {
    const { id, newOwner } = req.body;

    const tx = await contract.transferBatch(id, newOwner);
    const receipt = await tx.wait();

    res.json({
      success: true,
      txHash: receipt.hash,
      gasUsed: receipt.gasUsed.toString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.reason || error.shortMessage || error.message,
    });
  }
});

app.post("/api/log-process-step", async (req, res) => {
  try {
    const { id, step, data } = req.body;

    const tx = await contract.logProcessStep(id, step, data);
    const receipt = await tx.wait();

    res.json({
      success: true,
      txHash: receipt.hash,
      gasUsed: receipt.gasUsed.toString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.reason || error.shortMessage || error.message,
    });
  }
});

app.get("/api/batch/:id", async (req, res) => {
  try {
    const batch = await contract.getBatch(req.params.id);

    res.json({
      success: true,
      batch: {
        id: batch.idOut.toString(),
        owner: batch.owner,
        metadata: batch.metadata,
        status: STATUS[Number(batch.status)],
        createdAt: new Date(Number(batch.createdAt) * 1000).toLocaleString(),
        exists: batch.exists,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.reason || error.shortMessage || error.message,
    });
  }
});

app.get("/api/batch/:id/history", async (req, res) => {
  try {
    const history = await contract.getBatchHistory(req.params.id);

    res.json({
      success: true,
      history: history.map((item) => ({
        step: item.step,
        data: item.data,
        timestamp: item.timestamp.toString(),
        date: new Date(Number(item.timestamp) * 1000).toLocaleString(),
        actor: item.actor,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.reason || error.shortMessage || error.message,
    });
  }
});

app.listen(PORT || 5001, () => {
  console.log(`Backend running on http://localhost:${PORT || 5001}`);
});
