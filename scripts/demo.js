/**
 * End-to-end demo on localhost: manufacturer → distributor → pharmacy → auditor.
 * Run after `npx hardhat node` in another terminal:
 *   npm run demo
 *
 * Uses Hardhat accounts #0–#4 (import private keys into MetaMask for UI testing).
 */
const hre = require("hardhat");

async function main() {
  const [manufacturer, distributor, pharmacy, auditor] = await hre.ethers.getSigners();

  const Factory = await hre.ethers.getContractFactory("PharmaSupplyChain");
  const contract = await Factory.connect(manufacturer).deploy();
  await contract.waitForDeployment();

  const addr = await contract.getAddress();
  console.log("Deployed PharmaSupplyChain at:", addr);

  const Role = { Distributor: 2, Pharmacy: 3, Auditor: 4 };
  const BatchStatus = { Delivered: 2 };

  await contract.connect(manufacturer).assignRole(distributor.address, Role.Distributor);
  await contract.connect(manufacturer).assignRole(pharmacy.address, Role.Pharmacy);
  await contract.connect(manufacturer).assignRole(auditor.address, Role.Auditor);
  console.log("Roles assigned to distributor, pharmacy, auditor.");

  const batchId = 101n;
  await contract.connect(manufacturer).createBatch(batchId, '{"drug":"DemoDrug","lot":"D-101"}');
  console.log("Batch created:", batchId.toString());

  await contract.connect(manufacturer).logProcessStep(batchId, "Manufactured", "QmLocalCidManufactured1111111111111111111111111111");

  await contract.connect(manufacturer).transferBatch(batchId, distributor.address);
  console.log("Transferred to distributor.");

  await contract.connect(distributor).logProcessStep(batchId, "Shipped", "QmLocalCidShipped22222222222222222222222222222222");

  await contract.connect(distributor).transferBatch(batchId, pharmacy.address);
  console.log("Transferred to pharmacy.");

  await contract.connect(pharmacy).logProcessStep(batchId, "Received", "QmLocalCidReceived3333333333333333333333333333333");
  await contract.connect(pharmacy).updateStatus(batchId, BatchStatus.Delivered);
  console.log("Pharmacy marked Delivered.");

  await contract.connect(auditor).verifyBatch(batchId);
  console.log("Auditor verified batch.");

  const batch = await contract.getBatch(batchId);
  console.log("Final status:", batch.status.toString(), "(3 = Verified)");

  const history = await contract.getBatchHistory(batchId);
  console.log("History entries:", history.length);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
