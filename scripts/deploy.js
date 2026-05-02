const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const Contract = await hre.ethers.getContractFactory("PharmaSupplyChain");
  const contract = await Contract.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("PharmaSupplyChain deployed to:", address);

  const deploymentDir = path.join(__dirname, "..", "deployments");
  const deploymentPath = path.join(deploymentDir, "localhost.json");
  fs.mkdirSync(deploymentDir, { recursive: true });
  fs.writeFileSync(
    deploymentPath,
    JSON.stringify({ network: "localhost", chainId: 31337, address }, null, 2),
    "utf8"
  );
  console.log("Saved deployment to:", deploymentPath);
  console.log("For the React app, set frontend/.env.local — see README.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
