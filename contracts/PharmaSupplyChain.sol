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
 * - Off-chain JSON is stored in a local service and referenced on-chain by an IPFS-style CID string
 * - Role-based access control ensures only authorized actions
 * - Separation of concerns: Batch (state) vs ProcessRecord (history)
 * - Custom errors for predictable revert reasons and smaller bytecode than strings
 */
contract PharmaSupplyChain {
    /* =============================================================
                        CUSTOM ERRORS (structured reverts)
    ============================================================= */
    error NotAdmin();
    error UnauthorizedRole();
    error BatchDoesNotExist();
    error BatchAlreadyExists();
    error NotBatchOwner();
    error InvalidReceiver();
    error InvalidAddress();
    error EmptyString();
    error InvalidStatusProgression();
    error BatchNotDelivered();
    error VerificationOnlyByAuditor();
    error InvalidCid();

    /* =============================================================
                        ENUMS
    ============================================================= */

    /// @dev Defines roles for participants in supply chain
    enum Role {
        None,
        Manufacturer,
        Distributor,
        Pharmacy,
        Auditor
    }

    /// @dev Defines lifecycle stages of a batch
    enum BatchStatus {
        Created,
        InTransit,
        Delivered,
        Verified
    }

    /* =============================================================
                        STRUCTS
    ============================================================= */

    /// @dev Represents a pharmaceutical product batch
    struct Batch {
        uint256 id;
        address owner;
        string metadata;
        BatchStatus status;
        bool exists;
    }

    /// @dev Immutable provenance log entry; detailed payload stays as JSON string (off-chain style)
    struct ProcessRecord {
        string step;
        string cid;
        uint256 timestamp;
        address actor;
    }

    /* =============================================================
                        STATE VARIABLES
    ============================================================= */

    /// @dev System administrator (deployer)
    address public admin;

    mapping(uint256 => Batch) private batches;
    mapping(uint256 => ProcessRecord[]) private histories;
    mapping(address => Role) public roles;

    /* =============================================================
                        EVENTS
    ============================================================= */

    event RoleAssigned(address indexed user, Role role);
    event BatchCreated(uint256 indexed batchId, address indexed owner, string metadata);
    event OwnershipTransferred(uint256 indexed batchId, address indexed from, address indexed to);
    event ProcessLogged(uint256 indexed batchId, string step, address indexed actor, string cid);
    event StatusUpdated(uint256 indexed batchId, BatchStatus status);
    /// @dev Emitted when an auditor marks a batch as cryptographically "verified" on-chain
    event BatchVerified(uint256 indexed batchId, address indexed auditor);

    /* =============================================================
                        MODIFIERS
    ============================================================= */

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyRole(Role _role) {
        if (roles[msg.sender] != _role) revert UnauthorizedRole();
        _;
    }

    modifier batchExists(uint256 _id) {
        if (!batches[_id].exists) revert BatchDoesNotExist();
        _;
    }

    modifier onlyOwner(uint256 _id) {
        if (batches[_id].owner != msg.sender) revert NotBatchOwner();
        _;
    }

    /* =============================================================
                        CONSTRUCTOR
    ============================================================= */

    /// @dev Deployer becomes admin and initial manufacturer (demo-friendly seed)
    constructor() {
        admin = msg.sender;
        roles[msg.sender] = Role.Manufacturer;
    }

    /* =============================================================
                        ROLE MANAGEMENT
    ============================================================= */

    /// @notice Admin assigns a role to an account (None clears role for access checks that require non-None receiver elsewhere)
    function assignRole(address _user, Role _role) public onlyAdmin {
        if (_user == address(0)) revert InvalidAddress();
        roles[_user] = _role;
        emit RoleAssigned(_user, _role);
    }

    /* =============================================================
                        CORE FUNCTIONS
    ============================================================= */

    /// @notice Manufacturer registers a new batch ID with basic metadata (extended detail via JSON in logProcessStep)
    function createBatch(uint256 _id, string memory _metadata) public onlyRole(Role.Manufacturer) {
        if (batches[_id].exists) revert BatchAlreadyExists();
        if (bytes(_metadata).length == 0) revert EmptyString();

        batches[_id] = Batch({
            id: _id,
            owner: msg.sender,
            metadata: _metadata,
            status: BatchStatus.Created,
            exists: true
        });

        histories[_id].push(
            ProcessRecord({
                step: "Created",
                cid: "",
                timestamp: block.timestamp,
                actor: msg.sender
            })
        );

        emit BatchCreated(_id, msg.sender, _metadata);
    }

    /// @notice Current owner transfers custody; receiver must already have a supply-chain role
    function transferBatch(uint256 _id, address _to) public batchExists(_id) onlyOwner(_id) {
        if (_to == address(0)) revert InvalidAddress();
        if (roles[_to] == Role.None) revert InvalidReceiver();

        address prev = batches[_id].owner;
        batches[_id].owner = _to;
        batches[_id].status = BatchStatus.InTransit;

        histories[_id].push(
            ProcessRecord({
                step: "Transferred",
                cid: "",
                timestamp: block.timestamp,
                actor: msg.sender
            })
        );

        emit OwnershipTransferred(_id, prev, _to);
        emit StatusUpdated(_id, BatchStatus.InTransit);
    }

    /// @notice Owner advances lifecycle (e.g. pharmacy marks delivered). Verified is reserved for auditors.
    function updateStatus(uint256 _id, BatchStatus _status) public batchExists(_id) onlyOwner(_id) {
        if (_status == BatchStatus.Verified) revert VerificationOnlyByAuditor();
        if (uint256(_status) <= uint256(batches[_id].status)) revert InvalidStatusProgression();
        batches[_id].status = _status;
        emit StatusUpdated(_id, _status);
    }

    /// @notice Append an immutable process step by referencing an off-chain JSON payload CID
    /// @dev `_cid` should be an IPFS-style CID (produced by the local off-chain service in this repo).
    function logProcessStep(uint256 _id, string memory _step, string memory _cid)
        public
        batchExists(_id)
        onlyOwner(_id)
    {
        if (bytes(_step).length == 0) revert EmptyString();
        if (bytes(_cid).length == 0) revert InvalidCid();

        histories[_id].push(
            ProcessRecord({step: _step, cid: _cid, timestamp: block.timestamp, actor: msg.sender})
        );

        emit ProcessLogged(_id, _step, msg.sender, _cid);
    }

    /// @notice Auditor attests that they reviewed on-chain history (does not replace regulatory audit)
    function verifyBatch(uint256 _id) public batchExists(_id) onlyRole(Role.Auditor) {
        if (batches[_id].status != BatchStatus.Delivered) revert BatchNotDelivered();

        batches[_id].status = BatchStatus.Verified;

        histories[_id].push(
            ProcessRecord({
                step: "Verified",
                cid: "",
                timestamp: block.timestamp,
                actor: msg.sender
            })
        );

        emit StatusUpdated(_id, BatchStatus.Verified);
        emit BatchVerified(_id, msg.sender);
    }

    /* =============================================================
                        VIEW FUNCTIONS
    ============================================================= */

    function getBatch(uint256 _id) public view batchExists(_id) returns (Batch memory) {
        return batches[_id];
    }

    function getBatchHistory(uint256 _id) public view batchExists(_id) returns (ProcessRecord[] memory) {
        return histories[_id];
    }

    /// @notice Role lookup helper for UIs (same as public mapping getter but explicit)
    function getRole(address _account) public view returns (Role) {
        return roles[_account];
    }
}
