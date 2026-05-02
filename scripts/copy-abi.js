const fs = require("fs");
const path = require("path");

const src = path.join(
  __dirname,
  "..",
  "artifacts",
  "contracts",
  "PharmaSupplyChain.sol",
  "PharmaSupplyChain.json"
);
const destDir = path.join(__dirname, "..", "frontend", "src", "abi");
const dest = path.join(destDir, "PharmaSupplyChain.json");

if (!fs.existsSync(src)) {
  console.error("Run `npx hardhat compile` first. Missing:", src);
  process.exit(1);
}
fs.mkdirSync(destDir, { recursive: true });
const artifact = JSON.parse(fs.readFileSync(src, "utf8"));
fs.writeFileSync(dest, JSON.stringify({ abi: artifact.abi }, null, 2), "utf8");
console.log("Copied ABI to", dest);
