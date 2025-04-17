// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IArkadaPVPArena} from "./interfaces/IArkadaPVPArena.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";

contract ArkadaPVPArena is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    EIP712Upgradeable,
    IArkadaPVPArena
{
    using ECDSA for bytes32;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");

    bytes32 internal constant _JOIN_DATA_HASH =
        keccak256(
            "JoinData(uint256 arenaId,address player,uint256 nonce)"
        );

    uint256 internal s_nextArenaId;

    address public treasury;

    mapping(uint256 => bool) internal s_nonces;

    mapping(uint256 => ArenaInfo) public arenas;
    mapping(uint256 => uint256) public feesByArena;
    // @dev encoded keccak256(arena.id) with address => participated
    mapping(bytes32 => bool) public participants;
    mapping(uint256 => bytes32) public rootProofByArena;

    function initialize(
        string memory _signingDomain,
        string memory _signatureVersion,
        address _treasury,
        address _signer,
        address _admin
    ) public initializer {
        if (_treasury == address(0)) revert PVPArena__InvalidAddress();
        if (_admin == address(0)) revert PVPArena__InvalidAddress();
        if (_signer == address(0)) revert PVPArena__InvalidAddress();

        __AccessControl_init();
        __ReentrancyGuard_init();
        __EIP712_init(_signingDomain, _signatureVersion);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(SIGNER_ROLE, _signer);

        // Increasing _nextArenaId to start ids from 1 
        unchecked {
            ++s_nextArenaId;
        }
    }

    function createArena(
        ArenaType _type,
        uint256 _entryFee,
        uint256 _duration,
        uint256 _startTime,
        uint256 _requiredPlayers,
        bool _signatured
    ) external {
        if (_duration == 0) revert PVPArena__ZeroValue();
        if (_entryFee == 0) revert PVPArena__ZeroValue();

        if(_signatured) _checkRole(ADMIN_ROLE);

        uint256 arenaId = s_nextArenaId;

        ArenaInfo memory newArena = ArenaInfo({
            id: arenaId,
            creator: msg.sender,
            entryFee: _entryFee,
            duration: _duration,
            startTime: _startTime,
            endTime: _type == ArenaType.TIME ? _startTime + _duration : 0,
            createdAt: block.timestamp,
            arenaType: _type,
            requiredPlayers: _requiredPlayers,
            players: 0,
            signatured: _signatured
        });

        arenas[arenaId] = newArena;

        unchecked {
            ++s_nextArenaId;
        }

        emit ArenaCreated(arenaId, msg.sender, _type, _signatured);
    }

    function joinArena(
        uint256 _arenaId,
    ) external payable nonReentrant {
        _joinArena(_arenaId, msg.sender, false);
    }

    function joinArena(
        JoinData calldata data,
        bytes32 calldata signature
    ) external payable nonReentrant {
        // Validate the signature to ensure the join request is authorized
        _validateSignature(data, signature);

        _joinArena(data.arenaId, data.player, true);
    }

    function leaveArena(uint256 _arenaId) external nonReentrant {
        ArenaInfo memory arena = arenas[_arenaId];

        if(arena.id == 0) revert PVPArena__InvalidArenaID();

        if(arena.arenaType == ArenaType.TIME){
            if(block.timestamp > arena.startTime) revert PVPArena__ArenaStarted();
        }else{
            if(arena.players == arena.requiredPlayers) revert PVPArena__ArenaStarted();
        }

        bytes32 arenaIdHash = keccak256(bytes(arena.id));
        bytes32 arenaIdAndAddressHash = keccak256(
            abi.encodePacked(arenaIdHash, msg.sender)
        );

        if(!participants[arenaIdAndAddressHash]) revert PVPArena__NotJoined();

        arena.players--;

        arenas[_arenaId] = arena;
        participants[arenaIdAndAddressHash] = false;
        feesByArena[_arenaId] -= arena.entryFee;

        (bool success, ) = msg.sender.call{value: arena.entryFee}("");
        require(success, "Transfer failed");

        if (arena.players == 0) {
            delete arenas[_arenaId];
            emit ArenaDeleted(_arenaId);
        }

        emit PlayerLeft(_arenaId, msg.sender);
    }

    function endArenaAndDistributeRewards(
        uint256 _arenaId,
        bytes32 _root
    ) external onlyRole(ADMIN_ROLE) {
        ArenaInfo storage arena = arenas[_arenaId];
        require(arena.id != 0, "Arena does not exist");
        require(block.timestamp >= arena.endTime, "Arena not ended yet");
        require(
            rootProofByArena[_arenaId] == bytes32(0),
            "Rewards already distributed"
        );

        rootProofByArena[_arenaId] = _root;

        uint256 totalFees = feesByArena[_arenaId];
        uint256 feeAmount = (totalFees * 10) / 100;

        (bool success, ) = FEE_ADDRESS.call{value: feeAmount}("");
        require(success, "Fee transfer failed");

        emit ArenaEnded(_arenaId, _root);
    }

    function claimRewards(
        uint256 _arenaId,
        uint256 _amount,
        bytes32[] calldata _proofs
    ) external nonReentrant {
        ArenaInfo storage arena = arenas[_arenaId];
        require(arena.id != 0, "Arena does not exist");
        require(block.timestamp >= arena.endTime, "Arena not ended yet");
        require(participants[_arenaId][msg.sender], "Not a participant");
        require(
            rootProofByArena[_arenaId] != bytes32(0),
            "Rewards not distributed yet"
        );

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, _amount));
        require(
            MerkleProofUpgradeable.verify(
                _proofs,
                rootProofByArena[_arenaId],
                leaf
            ),
            "Invalid proof"
        );

        participants[_arenaId][msg.sender] = false;

        (bool success, ) = msg.sender.call{value: _amount}("");
        require(success, "Transfer failed");

        emit RewardsClaimed(_arenaId, msg.sender, _amount);
    }

    /// @notice Validates the signature for a arena join request
    /// @dev Ensures that the signature is from a valid signer and the nonce hasn't been used before
    /// @param data The JoinData struct containing join details
    /// @param signature The signature to be validated
    function _validateSignature(
        JoinData calldata data,
        bytes32 calldata signature
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
    function _getSigner(JoinData calldata data, bytes32 calldata sig)
        internal
        view
        returns (address)
    {
        bytes32 digest = _computeDigest(data);
        return digest.recover(sig);
    }

    /// @notice Internal function to compute the EIP712 digest for JoinData
    /// @dev Generates the digest that must be signed by the signer.
    /// @param data The JoinData to generate a digest for
    /// @return The computed EIP712 digest
    function _computeDigest(JoinData calldata data)
        internal
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(keccak256(_getStructHash(data)));
    }

    /// @notice Internal function to generate the struct hash for JoinData
    /// @dev Encodes the JoinData struct into a hash as per EIP712 standard.
    /// @param data The JoinData struct to hash
    /// @return A hash representing the encoded JoinData
    function _getStructHash(JoinData calldata data)
        internal
        pure
        returns (bytes memory)
    {
        return
            abi.encode(
                _JOIN_DATA_HASH,
                data.arenaId,
                data.player,
                data.nonce,
            );
    }

    function _joinArena(uint256 _arenaId, address _player, bool _freeFromFee) private {
        ArenaInfo memory arena = arenas[_arenaId];

        if(arena.id == 0) revert PVPArena__InvalidArenaID();
        if(!_freeFromFee && msg.value < arena.entryFee) revert PVPArena__FeeNotEnough();

        if(arena.arenaType == ArenaType.TIME){
            if(block.timestamp > arena.startTime) revert PVPArena__ArenaStarted();
        }else{
            if(arena.players == arena.requiredPlayers) revert PVPArena__ArenaStarted();
        }

        bytes32 arenaIdHash = keccak256(bytes(arena.id));
        bytes32 arenaIdAndAddressHash = keccak256(
            abi.encodePacked(arenaIdHash, _player)
        );

        if(participants[arenaIdAndAddressHash]) revert PVPArena__AlreadyJoined();

        arena.players++;

        // Start arena if type = PLACES and requiredPlayers achieved
        if (
            arena.arenaType == ArenaType.PLACES &&
            arena.players == arena.requiredPlayers
        ) {
            arena.startTime = block.timestamp;
            arena.endTime = block.timestamp + arena.duration;
        }

        arenas[_arenaId] = arena;
        participants[arenaIdAndAddressHash] = true;
        feesByArena[_arenaId] += msg.value;

        emit PlayerJoined(_arenaId, _player);
    }

    receive() external payable {}
}
