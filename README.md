# Blockchain-Based Pharmaceutical Supply Chain Provenance System


## Project Description
This project implements a simplified blockchain-based pharmaceutical supply chain provenance system.  
It tracks drug batches as they move through key stakeholders in the supply chain:
- Manufacturer: Creates product batches
- Distributor: Transfers and logs shipment details
- Pharmacy: Receives and finalizes product
- Auditor: Verifies product history

The goal is to improve transparency, traceability, and trust by recording product lifecycle events on a blockchain.  
Each batch has a unique identifier, current owner, status, and immutable provenance history.


## Project Context
This project is developed as part of an academic team assignment for a blockchain engineering course.  
The objective is to design and implement a simplified pharmaceutical supply chain provenance system using blockchain concepts.

The implementation focuses on demonstrating core ideas such as immutability, traceability, and decentralized trust in a controlled, educational setting.


## System Architecture
- **CLI**  
  We use CLI to interact with the program.
- **Ethers.js**  
  Acts as a bridge between the frontend and blockchain.
- **Smart Contract (Solidity)**  
  Implements business logic, data storage, and access control.
- **Blockchain (Hardhat Network)**  
  Stores immutable transaction data.
- **Off-chain Storage (JSON)**  
  Stores detailed process data, serialized and passed to the smart contract.


## Features
- Create pharmaceutical product batches
- Transfer ownership between stakeholders
- Log process steps such as manufacturing, shipping, and receiving
- Retrieve provenance history for verification
- Enforce role-based access control


## Example Workflow
1. Admin assigns roles (Manufacturer, Distributor, Pharmacy, Auditor)
2. Manufacturer creates a new batch
3. Manufacturer logs "Manufactured" step
4. Ownership is transferred to Distributor
5. Distributor logs "Shipped" step
6. Ownership is transferred to Pharmacy
7. Pharmacy logs "Received" step
8. Auditor can retrieve batch history


## Technology Stack  
  ### Blockchain  
    - Solidity  
    - Ethereum (Hardhat local network)  
    - Hardhat  
    - ethers.js  
  ### Backend  
    - Node.js  
    - Express.js  
    - dotenv  
    - Axios 
  ### Storage  
    - IPFS-style metadata (local simulation)  
    - JSON  
  
  
## Prerequisites  
Install the following:  
- Node.js (v16+)  
- npm  
- Git  
- Hardhat  
- curl or Postman 

    
## Installation  
Install dependencies:  
```bash  
npm install  
```
or   
```bash
npm init -y  
npm install --save-dev hardhat  
npm install --save-dev @nomicfoundation/hardhat-toolbox  
npm install ethers  
```

   
## Usage
### 1. Start Local Blockchain (Terminal 1)  
Run a local Ethereum network using Hardhat:
```bash
npx hardhat node
```
  
### 2. Deploy the contract (Terminal 2)  
```bash
npx hardhat run scripts/deploy_backend.js --network localhost  
```
  
### 3. Start backend server (Terminal 3)   
```bash
node server.js
```
   
### 4. Interact with the Contract   
All interactions with the smart contract are performed through the backend API. The backend signs transactions using role-specific private keys and communicates with the blockchain using ethers.js.
#### 4.1 Health Check
```bash
- curl http://localhost:5001/api/health
```
  
#### 4.2 Assign Roles 
##### Assign Manufaturer (Role = 1)  
The manufacturer is assigned when we just start the program.
##### Assign Distributor (Role = 2)  
```bash
curl -X POST http://localhost:5001/api/assign-role \
-H "Content-Type: application/json" \
-d '{"user":"0x70997970C51812dc3A010C7d01b50e0d17dc79C8","role":2}'
```  
##### Assign Pharmacy (Role = 3)  
```bash
curl -X POST http://localhost:5001/api/assign-role \
-H "Content-Type: application/json" \
-d '{"user":"0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC","role":3}'
```  
  
#### 4.3 Create Batch
```bash
curl -X POST http://localhost:5001/api/create-batch \
-H "Content-Type: application/json" \
-d '{
    "id":1,
    "metadata":{
      "drugName":"Drug A",
      "lotNumber":"LOT-001",
      "origin":"St. Louis"
    }
  }'
```
    
#### 4.4 Transfer Batch   
##### Manufacturer → Distributor  
```bash
curl -X POST http://localhost:5001/api/transfer-batch \  
-H "Content-Type: application/json" \  
-d '{"id":1,"newOwner":"0x70997970C51812dc3A010C7d01b50e0d17dc79C8"}'  
```
##### Distributor → Pharmacy  
```bash
curl -X POST http://localhost:5001/api/transfer-batch-as-distributor \  
-H "Content-Type: application/json" \  
-d '{"id":1,"newOwner":"0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"}'  
```
##### Log Delivery  
```bash
curl -X POST http://localhost:5001/api/log-process-step-as-pharmacy \  
-H "Content-Type: application/json" \  
-d '{"id":1,"step":"Delivered","data":"{\"location\":\"Retail Pharmacy\"}"}'  
```

#### 4.5 View Batch History
 ```bash
 curl http://localhost:5001/api/batch/<batchid>/history
 ```
  
  
## 🔐 Security Guarantees  
- Only current owner can act  
- Only authorized roles can receive batches  
- Immutable on-chain history  
- Unauthorized actions are rejected  


## Contributors
This project was developed as a team effort by:
- Kannan Meiappan
- Lingya Chen
- Priyananda Vangala
- Yunlin Xie

Each member contributed collaboratively to different aspects of the project including smart contract development, frontend implementation, testing, and documentation.


## Disclaimer
This project is a simplified academic prototype developed for educational purposes.

It is designed to demonstrate core blockchain concepts such as:
- immutability
- provenance tracking
- decentralized trust

This system does NOT:
- integrate with real-world pharmaceutical supply chain systems
- comply with regulatory standards such as FDA DSCSA
- handle production-scale data or security requirements

The implementation is not intended for real-world deployment and should not be used in production environments.
