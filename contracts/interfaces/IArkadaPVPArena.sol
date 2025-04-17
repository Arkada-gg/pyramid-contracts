// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.22;

/// @title IArkadaPVPArena
/// @dev Interface of the ArkadaPVPArena contract.
interface IArkadaPVPArena {
    error PVPArena__InvalidAddress();
    error PVPArena__ZeroValue();
    error PVPArena__InvalidArenaID();
    error PVPArena__FeeNotEnough();
    error PVPArena__ArenaStarted();
    error PVPArena__AlreadyJoined();
    error PVPArena__NotJoined();
    error PVPArena__TreasuryNotSet();
    error PVPArena__IsNotSigner();
    error PVPArena__NonceAlreadyUsed();

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
}
