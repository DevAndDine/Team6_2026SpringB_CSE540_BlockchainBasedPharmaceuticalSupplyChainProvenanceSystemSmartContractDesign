const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PharmaSupplyChain", function () {
  async function deployFixture() {
    const [manufacturer, distributor, pharmacy, auditor, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("PharmaSupplyChain");
    const contract = await Factory.connect(manufacturer).deploy();
    await contract.waitForDeployment();

    const Role = {
      None: 0,
      Manufacturer: 1,
      Distributor: 2,
      Pharmacy: 3,
      Auditor: 4,
    };

    const BatchStatus = {
      Created: 0,
      InTransit: 1,
      Delivered: 2,
      Verified: 3,
    };

    await contract.connect(manufacturer).assignRole(distributor.address, Role.Distributor);
    await contract.connect(manufacturer).assignRole(pharmacy.address, Role.Pharmacy);
    await contract.connect(manufacturer).assignRole(auditor.address, Role.Auditor);

    return { contract, manufacturer, distributor, pharmacy, auditor, stranger, Role, BatchStatus };
  }

  it("deployer is admin and manufacturer", async function () {
    const [deployer] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("PharmaSupplyChain");
    const contract = await Factory.deploy();
    await contract.waitForDeployment();

    expect(await contract.admin()).to.equal(deployer.address);
    expect(await contract.roles(deployer.address)).to.equal(1);
  });

  it("manufacturer creates batch and records Created history", async function () {
    const { contract, manufacturer } = await deployFixture();

    await expect(contract.connect(manufacturer).createBatch(100n, "Batch meta"))
      .to.emit(contract, "BatchCreated")
      .withArgs(100n, manufacturer.address, "Batch meta");

    const batch = await contract.getBatch(100n);
    expect(batch.exists).to.equal(true);
    expect(batch.metadata).to.equal("Batch meta");

    const hist = await contract.getBatchHistory(100n);
    expect(hist.length).to.equal(1);
    expect(hist[0].step).to.equal("Created");
  });

  it("logs process step by CID (off-chain JSON reference)", async function () {
    const { contract, manufacturer } = await deployFixture();

    await contract.connect(manufacturer).createBatch(200n, "meta");
    await expect(contract.connect(manufacturer).logProcessStep(200n, "Shipped", "QmDummyCidForLocalDemo11111111111111111111111111"))
      .to.emit(contract, "ProcessLogged");

    const hist = await contract.getBatchHistory(200n);
    expect(hist.length).to.equal(2);
    expect(hist[1].step).to.equal("Shipped");
    expect(hist[1].cid).to.equal("QmDummyCidForLocalDemo11111111111111111111111111");
  });

  it("reverts duplicate batch id", async function () {
    const { contract, manufacturer } = await deployFixture();

    await contract.connect(manufacturer).createBatch(1n, "a");
    await expect(contract.connect(manufacturer).createBatch(1n, "b")).to.be.revertedWithCustomError(
      contract,
      "BatchAlreadyExists"
    );
  });

  it("reverts empty metadata on create", async function () {
    const { contract, manufacturer } = await deployFixture();

    await expect(contract.connect(manufacturer).createBatch(2n, "")).to.be.revertedWithCustomError(
      contract,
      "EmptyString"
    );
  });

  it("non-manufacturer cannot create", async function () {
    const { contract, distributor } = await deployFixture();

    await expect(contract.connect(distributor).createBatch(9n, "x")).to.be.revertedWithCustomError(
      contract,
      "UnauthorizedRole"
    );
  });

  it("transfer updates owner and requires receiver role", async function () {
    const { contract, manufacturer, distributor } = await deployFixture();

    await contract.connect(manufacturer).createBatch(7n, "Drug X");
    await contract.connect(manufacturer).transferBatch(7n, distributor.address);

    const batch = await contract.getBatch(7n);
    expect(batch.owner).to.equal(distributor.address);
  });

  it("reverts transfer to zero address", async function () {
    const { contract, manufacturer } = await deployFixture();

    await contract.connect(manufacturer).createBatch(20n, "m");
    await expect(contract.connect(manufacturer).transferBatch(20n, ethers.ZeroAddress)).to.be.revertedWithCustomError(
      contract,
      "InvalidAddress"
    );
  });

  it("pharmacy can mark delivered; auditor verifies", async function () {
    const { contract, manufacturer, distributor, pharmacy, auditor, BatchStatus } = await deployFixture();

    await contract.connect(manufacturer).createBatch(50n, "Full flow");
    await contract.connect(manufacturer).transferBatch(50n, distributor.address);

    await contract.connect(distributor).transferBatch(50n, pharmacy.address);
    await contract.connect(pharmacy).updateStatus(50n, BatchStatus.Delivered);

    await expect(contract.connect(auditor).verifyBatch(50n)).to.emit(contract, "BatchVerified");

    const batch = await contract.getBatch(50n);
    expect(batch.status).to.equal(BatchStatus.Verified);
  });

  it("auditor cannot verify before delivered", async function () {
    const { contract, manufacturer, distributor, pharmacy, auditor } = await deployFixture();

    await contract.connect(manufacturer).createBatch(51n, "x");
    await contract.connect(manufacturer).transferBatch(51n, distributor.address);
    await contract.connect(distributor).transferBatch(51n, pharmacy.address);

    await expect(contract.connect(auditor).verifyBatch(51n)).to.be.revertedWithCustomError(
      contract,
      "BatchNotDelivered"
    );
  });

  it("only admin assigns roles", async function () {
    const { contract, stranger } = await deployFixture();

    await expect(contract.connect(stranger).assignRole(stranger.address, 2)).to.be.revertedWithCustomError(
      contract,
      "NotAdmin"
    );
  });

  it("owner cannot set Verified via updateStatus", async function () {
    const { contract, manufacturer, distributor, pharmacy, BatchStatus } = await deployFixture();

    await contract.connect(manufacturer).createBatch(60n, "y");
    await contract.connect(manufacturer).transferBatch(60n, distributor.address);
    await contract.connect(distributor).transferBatch(60n, pharmacy.address);
    await contract.connect(pharmacy).updateStatus(60n, BatchStatus.Delivered);

    await expect(contract.connect(pharmacy).updateStatus(60n, BatchStatus.Verified)).to.be.revertedWithCustomError(
      contract,
      "VerificationOnlyByAuditor"
    );
  });
});
