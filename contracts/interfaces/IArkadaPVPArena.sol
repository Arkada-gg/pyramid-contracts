// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.22;

/// @title IArkadaPVPArena
/// @dev Interface of the ArkadaPVPArena contract.
interface IArkadaPVPArena {
    error PVPArena__InvalidAddress();
    error PVPArena__InvalidTimestamp();
    error PVPArena__InvalidPlayersRequired();
    error PVPArena__ZeroValue();
    error PVPArena__InvalidArenaID();
    error PVPArena__InvalidFeeAmount();
    error PVPArena__ArenaStarted();
    error PVPArena__ArenaNotStarted();
    error PVPArena__ArenaNotEnded();
    error PVPArena__AlreadyEnded();
    error PVPArena__AlreadyJoined();
    error PVPArena__NotJoined();
    error PVPArena__IsNotSigner();
    error PVPArena__NonceAlreadyUsed();
    error PVPArena__TransferFailed();
    error PVPArena__RewardsNotDistributed();
    error PVPArena__InvalidProofs();
    error PVPArena__IAlreadyClaimed();

    event ArenaCreated(
        uint256 indexed arenaId,
        address indexed creator,
        ArenaType arenaType,
        bool signatured
    );
    event ArenaDeleted(uint256 indexed arenaId);
    event PlayerJoined(uint256 indexed arenaId, address indexed player);
    event PlayerLeft(uint256 indexed arenaId, address indexed player);
    event ArenaEnded(uint256 indexed arenaId, bytes32 root);
    event RewardsClaimed(
        uint256 indexed arenaId,
        address indexed player,
        uint256 amount
    );
    event TreasurySet(address indexed caller, address indexed newTreasury);
    event FeeBpsSet(address indexed caller, uint16 indexed newFeeBPS);
    event MinPlayersCountSet(
        address indexed caller,
        uint256 indexed newMinPlayersCount
    );
    event MinIntervalToStartSet(
        address indexed caller,
        uint256 indexed newMinIntervalToStart
    );

    enum ArenaType {
        TIME,
        PLACES
    }

    struct ArenaInfo {
        uint256 id;
        address creator;
        uint256 entryFee;
        uint256 duration;
        uint256 startTime;
        uint256 endTime;
        uint256 createdAt;
        ArenaType arenaType;
        uint256 requiredPlayers;
        uint256 players;
        bool signatured;
    }

    struct JoinData {
        uint256 arenaId;
        address player;
        uint256 nonce;
    }

    function createArena(
        ArenaType _type,
        uint256 _entryFee,
        uint256 _duration,
        uint256 _startTime,
        uint256 _requiredPlayers,
        bool _signatured
    ) external;

    function joinArena(uint256 _arenaId) external payable;

    function joinArena(
        JoinData calldata data,
        bytes calldata signature
    ) external;

    function leaveArena(uint256 _arenaId) external;

    function endArenaAndDistributeRewards(
        uint256 _arenaId,
        bytes32 _root
    ) external;

    function setTreasury(address _treasury) external;

    function setFeeBPS(uint16 _feeBPS) external;

    function setMinPlayersCount(uint256 _minPlayersCount) external;

    function setMinIntervalToStart(uint256 _minIntervalToStart) external;
}
