// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
===================================================================
Blockchain-Based Pharmaceutical Supply Chain Provenance System 
Project for Course CSE 540 — Engineering Blockchain Applications
===================================================================
 * @title PharmaSupplyChain
 * @author All Team Members
 *
 * @notice
 * This smart contract implements a blockchain-based pharmaceutical supply chain
 * provenance system. It enables multiple stakeholders (Manufacturer, Distributor,
 * Pharmacy, Auditor) to track the lifecycle of drug batches in a decentralized,
 * transparent, and tamper-resistant manner.
 *
 * @dev
 * DESIGN PRINCIPLES:
 * - Blockchain stores critical state (ownership, status, provenance logs)
 * - Off-chain JSON is stored as serialized strings for detailed metadata
 * - Role-based access control ensures only authorized actions
 * - Separation of concerns:
 *      - State (Batch)
 *      - History (ProcessRecord)
 * - Event-driven architecture for frontend integration
 */
contract PharmaSupplyChain {

    /* =============================================================
                        ENUMS
    ============================================================= */

    /**
     * @dev Defines roles for participants in supply chain
     */
    enum Role {
        None,
        Manufacturer,
        Distributor,
        Pharmacy,
        Auditor
    }

    /**
     * @dev Defines lifecycle stages of a batch
     */
    enum BatchStatus {
        Created,
        InTransit,
        Delivered,
        Verified
    }

    /* =============================================================
                        STRUCTS
    ============================================================= */

    /**
     * @dev Represents a pharmaceutical product batch
     *
     * @param id Unique identifier of the batch
     * @param owner Current owner of the batch
     * @param metadata Basic description (e.g., drug name)
     * @param status Current lifecycle stage
     * @param exists Flag to check existence
     */
    struct Batch {
        uint256 id;
        address owner;
        string metadata;
        BatchStatus status;
        bool exists;
    }

    /**
     * @dev Represents a provenance record (history log)
     *
     * @param step Human-readable action label
     * @param data JSON string storing detailed off-chain info
     * @param timestamp Time of action
     * @param actor Address performing the action
     *
     * NOTE:
     * This struct captures immutable history and should NOT be modified.
     */
    struct ProcessRecord {
        string step;
        string data;
        uint256 timestamp;
        address actor;
    }

    /* =============================================================
                        STATE VARIABLES
    ============================================================= */

    /// @dev System administrator (deployer)
    address public admin;

    /// @dev Mapping from batch ID to Batch
    mapping(uint256 => Batch) private batches;

    /// @dev Mapping from batch ID to its full provenance history
    mapping(uint256 => ProcessRecord[]) private histories;

    /// @dev Mapping from address to role
    mapping(address => Role) public roles;

    /* =============================================================
                            EVENTS
    ============================================================= */

    /// @dev Emitted when role is assigned
    event RoleAssigned(address indexed user, Role role);

    /// @dev Emitted when a batch is created
    event BatchCreated(uint256 indexed batchId, address indexed owner);

    /// @dev Emitted when ownership changes
    event OwnershipTransferred(uint256 indexed batchId, address indexed from, address indexed to);

    /// @dev Emitted when process step is logged
    event ProcessLogged(uint256 indexed batchId, string step, address indexed actor);

    /// @dev Emitted when batch status changes
    event StatusUpdated(uint256 indexed batchId, BatchStatus status);

    /* =============================================================
                        MODIFIERS
    ============================================================= */

    /// @dev Restricts access to admin only
    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    /// @dev Restricts access to specific role
    modifier onlyRole(Role _role) {
        require(roles[msg.sender] == _role, "Unauthorized role");
        _;
    }

    /// @dev Ensures batch exists
    modifier batchExists(uint256 _batchId) {
        require(batches[_batchId].exists, "Batch does not exist");
        _;
    }

    /// @dev Ensures caller is batch owner
    modifier onlyOwner(uint256 _batchId) {
        require(batches[_batchId].owner == msg.sender, "Not batch owner");
        _;
    }

    /* =============================================================
                        CONSTRUCTOR
    ============================================================= */

    /**
     * @dev Initializes contract
     * - Assigns deployer as admin and manufacturer
     */
    constructor() {
        admin = msg.sender;
        roles[msg.sender] = Role.Manufacturer;
    }

    /* =============================================================
                        ROLE MANAGEMENT
    ============================================================= */

    /**
     * @notice Assign role to a user
     * @dev Only admin can assign roles
     */
    function assignRole(address _user, Role _role)
        public
        onlyAdmin
    {
        roles[_user] = _role;
        emit RoleAssigned(_user, _role);
    }

    /* =============================================================
                        CORE FUNCTIONS
    ============================================================= */

    /**
     * @notice Create a new batch
     * @dev Only Manufacturer can create batches
     */
    function createBatch(uint256 _batchId, string memory _metadata)
        public
        onlyRole(Role.Manufacturer)
    {
        require(!batches[_batchId].exists, "Batch exists");

        batches[_batchId] = Batch({
            id: _batchId,
            owner: msg.sender,
            metadata: _metadata,
            status: BatchStatus.Created,
            exists: true
        });

        emit BatchCreated(_batchId, msg.sender);
    }

    /**
     * @notice Transfer batch from Manufacturer to Distributor
     * @dev Enforces Manufacturer -> Distributor movement and Created -> InTransit transition
     */
    function transferToDistributor(uint256 _batchId, address _to)
        public
        batchExists(_batchId)
        onlyOwner(_batchId)
        onlyRole(Role.Manufacturer)
    {
        require(roles[_to] == Role.Distributor, "Recipient must be Distributor");
        require(batches[_batchId].status == BatchStatus.Created, "Batch must be Created");

        address previousOwner = batches[_batchId].owner;
        batches[_batchId].owner = _to;
        batches[_batchId].status = BatchStatus.InTransit;

        emit OwnershipTransferred(_batchId, previousOwner, _to);
        emit StatusUpdated(_batchId, BatchStatus.InTransit);
    }

    /**
     * @notice Transfer batch from Distributor to Pharmacy
     * @dev Enforces Distributor -> Pharmacy movement and InTransit -> Delivered transition
     */
    function transferToPharmacy(uint256 _batchId, address _to)
        public
        batchExists(_batchId)
        onlyOwner(_batchId)
        onlyRole(Role.Distributor)
    {
        require(roles[_to] == Role.Pharmacy, "Recipient must be Pharmacy");
        require(batches[_batchId].status == BatchStatus.InTransit, "Batch must be InTransit");

        address previousOwner = batches[_batchId].owner;
        batches[_batchId].owner = _to;
        batches[_batchId].status = BatchStatus.Delivered;

        emit OwnershipTransferred(_batchId, previousOwner, _to);
        emit StatusUpdated(_batchId, BatchStatus.Delivered);
    }

    /**
     * @notice Verify batch lifecycle status
     * @dev Only Auditor can move a batch from Delivered to Verified
     */
    function verifyBatch(uint256 _batchId)
        public
        batchExists(_batchId)
        onlyRole(Role.Auditor)
    {
        require(batches[_batchId].status == BatchStatus.Delivered, "Batch must be Delivered");

        batches[_batchId].status = BatchStatus.Verified;
        emit StatusUpdated(_batchId, BatchStatus.Verified);
    }

    /**
     * @notice Log a process step for provenance tracking
     *
     * @dev
     * This function records detailed history of actions performed on a batch.
     * It complements the Batch struct by storing time-series data.
     *
     * Example:
     * - step: "Shipped"
     * - data: JSON string with logistics details
     *
     * IMPORTANT:
     * This does NOT modify batch state; it only appends history.
     */
    function logProcessStep(
        uint256 _batchId,
        string memory _step,
        string memory _data
    )
        public
        batchExists(_batchId)
        onlyOwner(_batchId)
    {
        histories[_batchId].push(ProcessRecord({
            step: _step,
            data: _data,
            timestamp: block.timestamp,
            actor: msg.sender
        }));

        emit ProcessLogged(_batchId, _step, msg.sender);
    }

    /* =============================================================
                        VIEW FUNCTIONS
    ============================================================= */

    /**
     * @notice Get current batch state
     * @dev Returns latest snapshot (NOT history)
     */
    function getBatch(uint256 _batchId)
        public
        view
        batchExists(_batchId)
        returns (Batch memory)
    {
        return batches[_batchId];
    }

    /**
     * @notice Get full provenance history
     * @dev Returns chronological list of all actions
     */
    function getBatchHistory(uint256 _batchId)
        public
        view
        batchExists(_batchId)
        returns (ProcessRecord[] memory)
    {
        return histories[_batchId];
    }
}