// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.22;

/// @title IArkadaPVPArena
/// @dev Interface of the ArkadaPVPArena contract.
/// @notice Defines the interface for creating and managing PVP battle arenas with different competition mechanics.
interface IArkadaPVPArena {
    error PVPArena__InvalidAddress();
    /// @notice Thrown when an invalid timestamp is provided for arena start time
    error PVPArena__InvalidTimestamp();
    /// @notice Thrown when the required players count is outside allowed range
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
    error PVPArena__AlreadyClaimed();
    error PVPArena__InvalidDuration();
    error PVPArena__InvalidMinMax();

    /// @notice Emitted when a new arena is created
    /// @param arenaId Unique identifier for the created arena
    /// @param creator Address that created the arena
    /// @param arenaType Type of arena (TIME or PLACES)
    /// @param signatured Whether the arena requires signatures to join
    event ArenaCreated(
        uint256 indexed arenaId,
        address indexed creator,
        ArenaType arenaType,
        bool signatured
    );

    /// @notice Emitted when an arena is deleted
    /// @param arenaId Unique identifier for the deleted arena
    event ArenaDeleted(uint256 indexed arenaId);

    /// @notice Emitted when a player joins an arena
    /// @param arenaId Unique identifier for the arena
    /// @param player Address of the player that joined
    event PlayerJoined(uint256 indexed arenaId, address indexed player);

    /// @notice Emitted when a player leaves an arena
    /// @param arenaId Unique identifier for the arena
    /// @param player Address of the player that left
    event PlayerLeft(uint256 indexed arenaId, address indexed player);

    /// @notice Emitted when an arena is ended and rewards distribution is set up
    /// @param arenaId Unique identifier for the arena
    /// @param root Merkle root for reward distribution proofs
    event ArenaEnded(uint256 indexed arenaId, bytes32 root);

    /// @notice Emitted when a player claims their rewards
    /// @param arenaId Unique identifier for the arena
    /// @param player Address of the player claiming rewards
    /// @param amount Amount of rewards claimed
    event RewardsClaimed(
        uint256 indexed arenaId,
        address indexed player,
        uint256 amount
    );

    /// @notice Emitted when the treasury address is updated
    /// @param caller Address that called the function
    /// @param newTreasury New treasury address
    event TreasurySet(address indexed caller, address indexed newTreasury);

    /// @notice Emitted when the fee basis points are updated
    /// @param caller Address that called the function
    /// @param newFeeBPS New fee percentage in basis points
    event FeeBpsSet(address indexed caller, uint16 indexed newFeeBPS);

    /// @notice Emitted when the players configuration is updated
    /// @param caller Address that called the function
    /// @param min Minimum number of players allowed
    /// @param max Maximum number of players allowed
    event PlayersConfigSet(address indexed caller, uint256 min, uint256 max);

    /// @notice Emitted when the interval to start configuration is updated
    /// @param caller Address that called the function
    /// @param min Minimum interval to start
    /// @param max Maximum interval to start
    event IntervalToStartConfigSet(
        address indexed caller,
        uint256 min,
        uint256 max
    );

    /// @notice Emitted when the duration configuration is updated
    /// @param caller Address that called the function
    /// @param min Minimum duration allowed
    /// @param max Maximum duration allowed
    event DurationConfigSet(address indexed caller, uint256 min, uint256 max);

    /// @notice Defines the types of arenas available
    /// @dev TIME: Arena starts at a specific time, PLACES: Arena starts when filled with required players
    enum ArenaType {
        TIME,
        PLACES
    }

    /// @notice Structure for storing minimum and maximum configuration values
    /// @dev Used for players count, duration, and time interval configurations
    struct MinMax {
        uint256 min;
        uint256 max;
    }

    /// @notice Structure for storing arena information
    /// @dev Contains all details about an arena including its state and configuration
    /// @param id Unique identifier for the arena, auto-incremented ID starting from 1
    /// @param creator Address that created the arena, has no special privileges once arena is created
    /// @param entryFee Fee amount required to join the arena, paid in native token
    /// @param duration Duration of the arena in seconds, must be within durationConfig min/max range
    /// @param startTime Timestamp when the arena will start, for TIME type: set at creation, for PLACES type: set when player requirement is met
    /// @param endTime Timestamp when the arena will end, calculated as startTime + duration
    /// @param createdAt Timestamp when the arena was created, set to block.timestamp at creation
    /// @param arenaType Type of arena (TIME or PLACES), determines the starting mechanism and validation rules
    /// @param requiredPlayers Number of players required to start a PLACES type arena, must be within playersConfig min/max range
    /// @param players Current number of players in the arena, incremented when players join, decremented when they leave
    /// @param signatured Whether the arena requires signatures to join, if true, only players with valid signatures can join
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

    /// @notice Structure for joining an arena with a signature
    /// @dev Used for authorized joins with signature validation using EIP-712
    /// @param arenaId ID of the arena to join, must reference a valid existing arena
    /// @param player Address of the player that will join the arena, the beneficiary of the join operation
    /// @param nonce Unique number to prevent signature reuse, each nonce can only be used once across all join operations
    struct JoinData {
        uint256 arenaId;
        address player;
        uint256 nonce;
    }

    /// @notice Creates a new battle arena with specified parameters
    /// @dev Creates either TIME-based or PLACES-based arenas with different mechanics
    /// @param _type Type of arena (TIME or PLACES)
    /// @param _entryFee Fee required to join the arena
    /// @param _duration Duration of the arena in seconds
    /// @param _startTime Timestamp when the arena will start (for TIME type)
    /// @param _requiredPlayers Number of players required to start (for PLACES type)
    /// @param _signatured Whether the arena requires signatures to join
    /// @return arenaId Unique identifier for the created arena
    function createArena(
        ArenaType _type,
        uint256 _entryFee,
        uint256 _duration,
        uint256 _startTime,
        uint256 _requiredPlayers,
        bool _signatured
    ) external returns (uint256);

    /// @notice Allows a user to join an arena by paying the entry fee
    /// @dev User must send the exact entry fee amount
    /// @param _arenaId The ID of the arena to join
    function joinArena(uint256 _arenaId) external payable;

    /// @notice Allows a user to join an arena using a signature from an authorized signer
    /// @dev For signatured arenas or special access cases
    /// @param data The JoinData struct containing join details
    /// @param signature The signature from an authorized signer
    function joinArena(
        JoinData calldata data,
        bytes calldata signature
    ) external;

    /// @notice Allows a player to leave an arena and get refunded
    /// @dev Only possible if the arena hasn't started yet
    /// @param _arenaId The ID of the arena to leave
    function leaveArena(uint256 _arenaId) external;

    /// @notice Ends an arena and sets up the reward distribution system
    /// @dev Only callable by admin when arena has completed
    /// @param _arenaId The ID of the arena to end
    /// @param _root Merkle root for reward distribution proofs
    function endArenaAndDistributeRewards(
        uint256 _arenaId,
        bytes32 _root
    ) external;

    /// @notice Allows a player to claim their rewards from an ended arena
    /// @dev Uses merkle proofs to verify eligibility for rewards
    /// @param _arenaId The ID of the arena to claim rewards from
    /// @param _amount The amount of rewards to claim
    /// @param _proofs Merkle proofs to verify reward eligibility
    function claimRewards(
        uint256 _arenaId,
        uint256 _amount,
        bytes32[] calldata _proofs
    ) external;

    /// @notice Sets the treasury address that receives protocol fees
    /// @dev Only callable by admin
    /// @param _treasury New treasury address
    function setTreasury(address _treasury) external;

    /// @notice Sets the fee percentage in basis points (10000 = 100%)
    /// @dev Only callable by admin
    /// @param _feeBPS New fee percentage in basis points
    function setFeeBPS(uint16 _feeBPS) external;

    /// @notice Sets the min/max configuration for player counts
    /// @dev Only callable by admin
    /// @param _config New player count configuration
    function setPlayersConfig(MinMax calldata _config) external;

    /// @notice Sets the min/max configuration for time intervals to start
    /// @dev Only callable by admin
    /// @param _config New time interval configuration
    function setIntervalToStartConfig(MinMax calldata _config) external;

    /// @notice Sets the min/max configuration for arena durations
    /// @dev Only callable by admin
    /// @param _config New duration configuration
    function setDurationConfig(MinMax calldata _config) external;
}
