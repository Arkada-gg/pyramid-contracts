// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IArkadaPVPArenaV3} from "./interfaces/IArkadaPVPArenaV3.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title ArkadaPVPArenaV3
/// @dev Implementation of a PVP Arena smart contract with EIP712 signatures.
/// The contract is upgradeable using OpenZeppelin's proxy pattern.
/// Allows users to create and join battle arenas, with different types of competition mechanics.
contract ArkadaPVPArenaV3 is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    EIP712Upgradeable,
    IArkadaPVPArenaV3
{
    using ECDSA for bytes32;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @notice Type hash for join data according to EIP-712
    /// @dev Used in typed signature recovery for arena joining
    bytes32 internal constant _JOIN_DATA_HASH =
        keccak256(
            "JoinData(uint256 arenaId,address player,bool freeFromFee,uint256 discountBps,uint256 nonce)"
        );

    /// @dev max basis points is 10000 (100%)
    uint16 public constant MAX_BPS = 10000;

    /// @notice Counter for arena IDs, incremented for each new arena
    /// @dev Next available ID for arena creation
    uint256 internal s_nextArenaId;

    /// @notice Address where protocol fees are sent
    /// @dev Set during initialization and can be updated by admin
    address public treasury;

    /// @notice Fee percentage in basis points (10000 = 100%)
    /// @dev Fee taken from each arena's prize pool
    uint16 public feeBPS;

    /// @notice Time left to rebuy in basis points (10000 = 100%)
    uint16 public timeLeftToRebuyBPS;

    /// @notice Min/max configuration for player counts in arenas
    /// @dev Used to validate player requirements for PLACES type arenas
    MinMax public playersConfig;

    /// @notice Min/max configuration for time intervals before arena start
    /// @dev Used to validate start times for TIME type arenas
    MinMax public intervalToStartConfig;

    /// @notice Min/max configuration for arena durations
    /// @dev Used to validate duration for all arena types
    MinMax public durationConfig;

    /// @notice Mapping to track used nonces for signature validation
    /// @dev Prevents signature replay attacks
    mapping(uint256 => bool) internal s_nonces;

    /// @notice Mapping from arena ID to arena information
    /// @dev Stores all data about each arena
    mapping(uint256 => ArenaInfo) public arenas;

    /// @notice Mapping from arena ID to total fees collected
    /// @dev Used for calculating prize pools and protocol fees
    mapping(uint256 => uint256) public feesByArena;

    /// @notice Tracks participation in arenas
    /// @dev Maps keccak256(arenaId, playerAddress) to participation status
    mapping(bytes32 => bool) public participants;

    /// @notice Tracks how much user paid for participate in arena
    /// @dev Maps keccak256(arenaId, playerAddress) to paid amount
    mapping(bytes32 => uint256) public paidForParticipate;

    /// @notice Tracks claimed rewards by players
    /// @dev Maps keccak256(arenaId, playerAddress) to claim status
    mapping(bytes32 => bool) public claimed;

    /// @notice Stores the merkle roots for reward distribution
    /// @dev Used to verify reward claims with merkle proofs
    mapping(uint256 => bytes32) public rootProofByArena;

    /// @notice Initializes the ArkadaPVPArena contract with necessary parameters
    /// @dev Sets up contract with configuration parameters and grants initial roles
    /// @param _signingDomain Domain used for EIP712 signing
    /// @param _signatureVersion Version of the EIP712 signature
    /// @param _addressesInitParams Addresses params
    /// @param _feeBPS Fee percentage in basis points to be sent to treasury
    /// @param _playersConfig Min/Max configuration for player counts
    /// @param _intervalToStartConfig Min/Max configuration for start time intervals
    /// @param _durationConfig Min/Max configuration for arena durations
    function initialize(
        string memory _signingDomain,
        string memory _signatureVersion,
        AddressesInitParams calldata _addressesInitParams,
        uint16 _feeBPS,
        uint16 _timeLeftToRebuyBPS,
        MinMax memory _playersConfig,
        MinMax memory _intervalToStartConfig,
        MinMax memory _durationConfig
    ) public initializer {
        if (_addressesInitParams.treasury == address(0))
            revert PVPArena__InvalidAddress();
        if (_addressesInitParams.admin == address(0))
            revert PVPArena__InvalidAddress();
        if (_addressesInitParams.signer == address(0))
            revert PVPArena__InvalidAddress();
        if (_addressesInitParams.operator == address(0))
            revert PVPArena__InvalidAddress();

        __AccessControl_init();
        __ReentrancyGuard_init();
        __EIP712_init(_signingDomain, _signatureVersion);

        _grantRole(DEFAULT_ADMIN_ROLE, _addressesInitParams.admin);
        _grantRole(ADMIN_ROLE, _addressesInitParams.admin);
        _grantRole(SIGNER_ROLE, _addressesInitParams.signer);
        _grantRole(OPERATOR_ROLE, _addressesInitParams.operator);

        treasury = _addressesInitParams.treasury;
        feeBPS = _feeBPS;
        playersConfig = _playersConfig;
        intervalToStartConfig = _intervalToStartConfig;
        durationConfig = _durationConfig;
        timeLeftToRebuyBPS = _timeLeftToRebuyBPS;

        // Increasing _nextArenaId to start ids from 1
        unchecked {
            ++s_nextArenaId;
        }
    }

    /**
     * @inheritdoc IArkadaPVPArenaV3
     */
    function createArena(
        ArenaType _type,
        uint256 _entryFee,
        uint256 _duration,
        uint256 _startTime,
        uint256 _requiredPlayers,
        string calldata _name,
        ArenaBoolParams calldata _boolParams
    ) external payable returns (uint256 arenaId) {
        if (_boolParams.signatured) _checkRole(ADMIN_ROLE);

        _validateArenaParams(
            _type,
            _entryFee,
            _duration,
            _startTime,
            _requiredPlayers
        );

        arenaId = s_nextArenaId++;

        bool hasAdminRole = hasRole(ADMIN_ROLE, msg.sender);

        if (!hasAdminRole && msg.value < _entryFee)
            revert PVPArena__InvalidFeeAmount();

        uint256 initialPrizePool = hasAdminRole
            ? msg.value
            : msg.value - _entryFee;

        ArenaInfo memory newArena = ArenaInfo({
            id: arenaId,
            creator: msg.sender,
            entryFee: _entryFee,
            duration: _duration,
            startTime: _startTime,
            endTime: _type == ArenaType.TIME ? _startTime + _duration : 0,
            createdAt: block.timestamp,
            arenaType: _type,
            requiredPlayers: _requiredPlayers < playersConfig.min
                ? playersConfig.min
                : _requiredPlayers,
            players: 0,
            initialPrizePool: initialPrizePool,
            emergencyClosed: false,
            boolParams: _boolParams,
            name: _name
        });

        arenas[arenaId] = newArena;

        emit ArenaCreated(arenaId, msg.sender, _type, _boolParams.signatured);

        if (!hasAdminRole) _joinArena(newArena, msg.sender, false, 0);
    }

    function _validateArenaParams(
        ArenaType _type,
        uint256 _entryFee,
        uint256 _duration,
        uint256 _startTime,
        uint256 _requiredPlayers
    ) internal view {
        if (_duration < durationConfig.min || _duration > durationConfig.max)
            revert PVPArena__InvalidDuration();

        if (_entryFee == 0) revert PVPArena__ZeroValue();

        if (_type == ArenaType.TIME) {
            if (_startTime < block.timestamp + intervalToStartConfig.min)
                revert PVPArena__InvalidTimestamp();
            if (_startTime > block.timestamp + intervalToStartConfig.max)
                revert PVPArena__InvalidTimestamp();
        }

        if (_type == ArenaType.PLACES) {
            if (
                _requiredPlayers < playersConfig.min ||
                _requiredPlayers > playersConfig.max
            ) revert PVPArena__InvalidPlayersRequired();
        }
    }

    /**
     * @inheritdoc IArkadaPVPArenaV3
     */
    function joinArena(uint256 _arenaId) external payable nonReentrant {
        ArenaInfo memory arena = arenas[_arenaId];

        if (arena.boolParams.signatured) revert PVPArena__ArenaIsSignatured();

        _joinArena(arena, msg.sender, false, 0);
    }

    /**
     * @inheritdoc IArkadaPVPArenaV3
     */
    function joinArena(
        JoinData calldata data,
        bytes calldata signature
    ) external payable nonReentrant {
        // Validate the signature to ensure the join request is authorized
        _validateSignature(data, signature);

        ArenaInfo memory arena = arenas[data.arenaId];

        _joinArena(arena, data.player, data.freeFromFee, data.discountBps);
    }

    /**
     * @inheritdoc IArkadaPVPArenaV3
     */
    function leaveArena(uint256 _arenaId) external nonReentrant {
        ArenaInfo memory arena = arenas[_arenaId];

        if (arena.id == 0) revert PVPArena__InvalidArenaID();

        if (!arena.emergencyClosed) {
            if (
                block.timestamp >= arena.startTime &&
                arena.players >= arena.requiredPlayers
            ) revert PVPArena__ArenaStarted();
        }

        bytes32 arenaIdHash = keccak256(abi.encodePacked(arena.id));
        bytes32 arenaIdAndAddressHash = keccak256(
            abi.encodePacked(arenaIdHash, msg.sender)
        );

        if (!participants[arenaIdAndAddressHash]) revert PVPArena__NotJoined();

        arena.players--;
        arenas[_arenaId] = arena;

        participants[arenaIdAndAddressHash] = false;

        uint256 paidForEntry = paidForParticipate[arenaIdAndAddressHash];
        if (paidForEntry > 0) {
            feesByArena[_arenaId] -= paidForEntry;

            (bool success, ) = msg.sender.call{value: paidForEntry}("");
            if (!success) revert PVPArena__TransferFailed();
        }

        if (arena.players == 0) {
            if (arena.initialPrizePool > 0) {
                (bool success, ) = treasury.call{value: arena.initialPrizePool}(
                    ""
                );
                if (!success) revert PVPArena__TransferFailed();
            }

            delete arenas[_arenaId];
            emit ArenaDeleted(_arenaId);
        }

        emit PlayerLeft(_arenaId, msg.sender);
    }

    /**
     * @inheritdoc IArkadaPVPArenaV3
     */
    function endArenaAndDistributeRewards(
        uint256 _arenaId,
        bytes32 _root
    ) external onlyRole(OPERATOR_ROLE) {
        ArenaInfo memory arena = arenas[_arenaId];

        if (arena.id == 0) revert PVPArena__InvalidArenaID();

        if (arena.emergencyClosed) revert PVPArena__EmergencyClosed();

        if (
            block.timestamp < arena.startTime ||
            arena.players < arena.requiredPlayers
        ) revert PVPArena__ArenaNotStarted();

        if (block.timestamp < arena.endTime) revert PVPArena__ArenaNotEnded();

        if (rootProofByArena[_arenaId] != bytes32(0))
            revert PVPArena__AlreadyEnded();

        rootProofByArena[_arenaId] = _root;

        uint256 arenaFees = feesByArena[_arenaId];

        uint256 treasuryAmount = arenaFees < arena.initialPrizePool
            ? arenaFees
            : arena.initialPrizePool;

        uint256 feesAmount = arenaFees > arena.initialPrizePool
            ? arenaFees
            : arena.initialPrizePool;

        uint256 feeAmount = (feesAmount * feeBPS) / MAX_BPS;

        (bool success, ) = treasury.call{value: feeAmount + treasuryAmount}("");
        if (!success) revert PVPArena__TransferFailed();

        emit ArenaEnded(_arenaId, _root);
    }

    /**
     * @inheritdoc IArkadaPVPArenaV3
     */
    function claimRewards(
        uint256 _arenaId,
        uint256 _amount,
        bytes32[] calldata _proofs
    ) external nonReentrant {
        bytes32 arenaIdHash = keccak256(abi.encodePacked(_arenaId));
        bytes32 arenaIdAndAddressHash = keccak256(
            abi.encodePacked(arenaIdHash, msg.sender)
        );

        if (claimed[arenaIdAndAddressHash]) revert PVPArena__AlreadyClaimed();

        bytes32 root = rootProofByArena[_arenaId];

        if (root == bytes32(0)) revert PVPArena__RewardsNotDistributed();

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, _amount));
        bool verified = MerkleProof.verifyCalldata(_proofs, root, leaf);
        if (!verified) revert PVPArena__InvalidProofs();

        claimed[arenaIdAndAddressHash] = true;

        (bool success, ) = msg.sender.call{value: _amount}("");
        if (!success) revert PVPArena__TransferFailed();

        emit RewardsClaimed(_arenaId, msg.sender, _amount);
    }

    /**
     * @inheritdoc IArkadaPVPArenaV3
     */
    function rebuy(uint256 _arenaId) external payable nonReentrant {
        ArenaInfo memory arena = arenas[_arenaId];

        if (arena.id == 0) revert PVPArena__InvalidArenaID();

        if (arena.emergencyClosed) revert PVPArena__EmergencyClosed();

        if (
            block.timestamp < arena.startTime ||
            arena.players < arena.requiredPlayers
        ) revert PVPArena__ArenaNotStarted();

        if (arena.boolParams.lockRebuy) revert PVPArena__ArenaRebuyLocked();

        if (msg.value < arena.entryFee) revert PVPArena__InvalidFeeAmount();

        bytes32 arenaIdHash = keccak256(abi.encodePacked(_arenaId));
        bytes32 arenaIdAndAddressHash = keccak256(
            abi.encodePacked(arenaIdHash, msg.sender)
        );

        if (!participants[arenaIdAndAddressHash]) revert PVPArena__NotJoined();

        uint256 rebuyEndTime = arena.startTime +
            (arena.duration -
                ((arena.duration * timeLeftToRebuyBPS) / MAX_BPS));
        if (block.timestamp > rebuyEndTime)
            revert PVPArena__ArenaRebuyTimeExeeded();

        feesByArena[_arenaId] += arena.entryFee;
        paidForParticipate[arenaIdAndAddressHash] += arena.entryFee;

        emit PlayerRebuy(_arenaId, msg.sender);
    }

    /**
     * @inheritdoc IArkadaPVPArenaV3
     */
    function setTreasury(address _treasury) external onlyRole(ADMIN_ROLE) {
        if (_treasury == address(0)) revert PVPArena__InvalidAddress();
        treasury = _treasury;
        emit TreasurySet(msg.sender, _treasury);
    }

    /**
     * @inheritdoc IArkadaPVPArenaV3
     */
    function setFeeBPS(uint16 _feeBPS) external onlyRole(ADMIN_ROLE) {
        feeBPS = _feeBPS;
        emit FeeBpsSet(msg.sender, _feeBPS);
    }

    /**
     * @inheritdoc IArkadaPVPArenaV3
     */
    function setTimeLeftToRebuyBPS(
        uint16 _timeLeftToRebuyBPS
    ) external onlyRole(ADMIN_ROLE) {
        timeLeftToRebuyBPS = _timeLeftToRebuyBPS;
        emit TimeLeftToRebuyBPSSet(msg.sender, _timeLeftToRebuyBPS);
    }

    /**
     * @inheritdoc IArkadaPVPArenaV3
     */
    function setPlayersConfig(
        MinMax calldata _config
    ) external onlyRole(ADMIN_ROLE) {
        if (_config.max < _config.min) revert PVPArena__InvalidMinMax();
        playersConfig = _config;
        emit PlayersConfigSet(msg.sender, _config.min, _config.max);
    }

    /**
     * @inheritdoc IArkadaPVPArenaV3
     */
    function setIntervalToStartConfig(
        MinMax calldata _config
    ) external onlyRole(ADMIN_ROLE) {
        if (_config.max < _config.min) revert PVPArena__InvalidMinMax();
        intervalToStartConfig = _config;
        emit IntervalToStartConfigSet(msg.sender, _config.min, _config.max);
    }

    /**
     * @inheritdoc IArkadaPVPArenaV3
     */
    function updateMerkleRoot(
        uint256 _arenaId,
        bytes32 _root
    ) external onlyRole(ADMIN_ROLE) {
        if (_root == bytes32(0)) revert PVPArena__InvalidProofs();
        rootProofByArena[_arenaId] = _root;
        emit RootUpdated(msg.sender, _arenaId, _root);
    }

    /**
     * @inheritdoc IArkadaPVPArenaV3
     */
    function setDurationConfig(
        MinMax calldata _config
    ) external onlyRole(ADMIN_ROLE) {
        if (_config.max < _config.min) revert PVPArena__InvalidMinMax();
        durationConfig = _config;
        emit DurationConfigSet(msg.sender, _config.min, _config.max);
    }

    /**
     * @inheritdoc IArkadaPVPArenaV3
     */
    function emergencyClose(uint256 _arenaId) external onlyRole(ADMIN_ROLE) {
        ArenaInfo memory arena = arenas[_arenaId];

        if (arena.id == 0) revert PVPArena__InvalidArenaID();

        arena.emergencyClosed = true;

        if (arena.initialPrizePool > 0) {
            (bool success, ) = treasury.call{value: arena.initialPrizePool}("");
            if (!success) revert PVPArena__TransferFailed();
            arena.initialPrizePool = 0;
        }

        arenas[_arenaId] = arena;

        emit EmergencyClosed(msg.sender, _arenaId);
    }

    /// @notice Validates the signature for a arena join request
    /// @dev Ensures that the signature is from a valid signer and the nonce hasn't been used before
    /// @param data The JoinData struct containing join details
    /// @param signature The signature to be validated
    function _validateSignature(
        JoinData calldata data,
        bytes calldata signature
    ) internal {
        address signer = _getSigner(data, signature);

        if (!hasRole(SIGNER_ROLE, signer)) {
            revert PVPArena__IsNotSigner();
        }
        if (s_nonces[data.nonce]) {
            revert PVPArena__NonceAlreadyUsed();
        }
        s_nonces[data.nonce] = true;
    }

    /// @notice Recovers the signer's address from the JoinData and its associated signature
    /// @dev Utilizes EIP-712 typed data hashing and ECDSA signature recovery
    /// @param data The JoinData struct containing the details of join request
    /// @param sig The signature associated with the JoinData
    /// @return The address of the signer who signed the JoinData
    function _getSigner(
        JoinData calldata data,
        bytes calldata sig
    ) internal view returns (address) {
        bytes32 digest = _computeDigest(data);
        return digest.recover(sig);
    }

    /// @notice Internal function to compute the EIP712 digest for JoinData
    /// @dev Generates the digest that must be signed by the signer.
    /// @param data The JoinData to generate a digest for
    /// @return The computed EIP712 digest
    function _computeDigest(
        JoinData calldata data
    ) internal view returns (bytes32) {
        return _hashTypedDataV4(keccak256(_getStructHash(data)));
    }

    /// @notice Internal function to generate the struct hash for JoinData
    /// @dev Encodes the JoinData struct into a hash as per EIP712 standard.
    /// @param data The JoinData struct to hash
    /// @return A hash representing the encoded JoinData
    function _getStructHash(
        JoinData calldata data
    ) internal pure returns (bytes memory) {
        return
            abi.encode(
                _JOIN_DATA_HASH,
                data.arenaId,
                data.player,
                data.freeFromFee,
                data.discountBps,
                data.nonce
            );
    }

    /// @notice Internal function to process joining an arena
    /// @dev Handles the logic for both standard joins and signature-based joins
    /// @param _arena Arena data
    /// @param _player The address of the player joining
    /// @param _freeFromFee Whether the player is exempt from the entry fee
    function _joinArena(
        ArenaInfo memory _arena,
        address _player,
        bool _freeFromFee,
        uint256 discountBps
    ) private {
        if (_arena.id == 0) revert PVPArena__InvalidArenaID();

        if (_arena.emergencyClosed) revert PVPArena__EmergencyClosed();

        uint256 entryFeeWithDiscount = _arena.entryFee -
            ((_arena.entryFee * discountBps) / MAX_BPS);

        if (!_freeFromFee && msg.value < entryFeeWithDiscount)
            revert PVPArena__InvalidFeeAmount();

        if (
            _arena.arenaType == ArenaType.TIME &&
            block.timestamp >= _arena.startTime &&
            _arena.players < _arena.requiredPlayers
        ) revert PVPArena__ArenaCanceled();

        if (
            block.timestamp >= _arena.startTime &&
            _arena.players >= _arena.requiredPlayers
        ) {
            if (_arena.boolParams.lockArenaOnStart)
                revert PVPArena__ArenaLockedOnStart();

            uint256 rebuyEndTime = _arena.startTime +
                (_arena.duration -
                    ((_arena.duration * timeLeftToRebuyBPS) / MAX_BPS));
            if (block.timestamp > rebuyEndTime)
                revert PVPArena__ArenaRebuyTimeExeeded();
        }

        bytes32 arenaIdHash = keccak256(abi.encodePacked(_arena.id));
        bytes32 arenaIdAndAddressHash = keccak256(
            abi.encodePacked(arenaIdHash, _player)
        );

        if (participants[arenaIdAndAddressHash])
            revert PVPArena__AlreadyJoined();

        _arena.players++;

        // Start arena if type = PLACES and requiredPlayers achieved
        if (
            _arena.arenaType == ArenaType.PLACES &&
            _arena.players == _arena.requiredPlayers
        ) {
            _arena.startTime = block.timestamp;
            _arena.endTime = block.timestamp + _arena.duration;
        }

        arenas[_arena.id] = _arena;
        participants[arenaIdAndAddressHash] = true;
        if (!_freeFromFee) feesByArena[_arena.id] += entryFeeWithDiscount;

        paidForParticipate[arenaIdAndAddressHash] = _freeFromFee
            ? 0
            : entryFeeWithDiscount;

        emit PlayerJoined(_arena.id, _player);
    }
}
