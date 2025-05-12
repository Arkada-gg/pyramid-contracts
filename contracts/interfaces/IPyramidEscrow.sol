// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.22;

import {ITokenType} from "../escrow/interfaces/ITokenType.sol";

/// @title IPyramidEscrow
/// @dev Interface of the PyramidEscrow contract.
interface IPyramidEscrow is ITokenType {
    error Pyramid__IsNotSigner();
    error Pyramid__MintingIsNotActive();
    error Pyramid__FeeNotEnough();
    error Pyramid__SignatureAndCubesInputMismatch();
    error Pyramid__WithdrawFailed();
    error Pyramid__ClaimRewardsFailed();
    error Pyramid__NonceAlreadyUsed();
    error Pyramid__TransferFailed();
    error Pyramid__BPSTooHigh();
    error Pyramid__ExcessiveFeePayout();
    error Pyramid__ExceedsContractBalance();
    error Pyramid__QuestNotActive();
    error Pyramid__NativePaymentFailed();
    error Pyramid__ERC20TransferFailed();
    error Pyramid__ExceedsContractAllowance();
    error Pyramid__TreasuryNotSet();
    error Pyramid__InvalidAdminAddress();
    error Pyramid__ZeroAddress();
    error Pyramid__MintedForQuestId();

    enum QuestType {
        QUEST,
        STREAK
    }

    enum Difficulty {
        BEGINNER,
        INTERMEDIATE,
        ADVANCED
    }

    /// @notice Emitted when a new quest is initialized
    /// @param questId The unique identifier of the quest
    /// @param questType The type of the quest (QUEST, STREAK)
    /// @param difficulty The difficulty level of the quest (BEGINNER, INTERMEDIATE, ADVANCED)
    /// @param title The title of the quest
    /// @param tags An array of tags associated with the quest
    /// @param communities An array of communities associated with the quest
    event QuestMetadata(
        uint256 indexed questId,
        QuestType questType,
        Difficulty difficulty,
        string title,
        string[] tags,
        string[] communities
    );

    /// @notice Emitted when a Pyramid is claimed
    /// @param questId The quest ID associated with the Pyramid
    /// @param tokenId The token ID of the minted Pyramid
    /// @param claimer Address of the Pyramid claimer
    /// @param price The price paid for the Pyramid
    /// @param rewards The rewards paid for the Pyramid
    /// @param issueNumber The issue number of the Pyramid
    /// @param walletProvider The name of the wallet provider used for claiming
    /// @param embedOrigin The origin of the embed associated with the Pyramid
    event PyramidClaim(
        string questId,
        uint256 indexed tokenId,
        address indexed claimer,
        uint256 price,
        uint256 rewards,
        uint256 issueNumber,
        string walletProvider,
        string embedOrigin
    );

    /// @notice Emitted for each transaction associated with a Pyramid claim
    /// This event is designed to support both EVM and non-EVM blockchains
    /// @param pyramidTokenId The token ID of the Pyramid
    /// @param txHash The hash of the transaction
    /// @param networkChainId The network and chain ID of the transaction in the format <network>:<chain-id>
    event PyramidTransaction(
        uint256 indexed pyramidTokenId,
        string txHash,
        string networkChainId
    );

    /// @notice Emitted when there is a reward associated with a Pyramid
    /// @param pyramidTokenId The token ID of the Pyramid giving the reward
    /// @param tokenAddress The token address of the reward
    /// @param chainId The blockchain chain ID where the transaction occurred
    /// @param amount The amount of the reward
    /// @param tokenId Token ID of the reward (only applicable for ERC721 and ERC1155)
    /// @param tokenType The type of reward token
    event TokenReward(
        uint256 indexed pyramidTokenId,
        address indexed tokenAddress,
        uint256 indexed chainId,
        uint256 amount,
        uint256 tokenId,
        TokenType tokenType
    );

    /// @notice Emitted when a fee payout is made
    /// @param recipient The address of the payout recipient
    /// @param amount The amount of the payout
    event FeePayout(address indexed recipient, uint256 amount);

    /// @notice Emitted when the minting switch is turned on/off
    /// @param isActive The boolean showing if the minting is active or not
    event MintingSwitch(bool isActive);

    /// @notice Emitted when the contract balance is withdrawn by an admin
    /// @param amount The contract's balance that was withdrawn
    event ContractWithdrawal(uint256 amount);

    /// @notice Emitted when a user claims their rewards
    /// @param user The address of the user who claimed their rewards
    /// @param amount The amount of rewards claimed
    event ClaimRewards(address indexed user, uint256 amount);

    /// @notice Emitted when a quest is disabled
    /// @param questId The ID of the quest that was disabled
    event QuestDisabled(uint256 indexed questId);

    /// @notice Emitted when the treasury address is updated
    /// @param newTreasury The new treasury address
    event UpdatedTreasury(address indexed newTreasury);

    /// @notice Emitted when the Arkada rewarder address is updated
    /// @param newArkadaRewarder The new Arkada rewarder address
    event UpdatedArkadaRewarder(address indexed newArkadaRewarder);

    /// @notice Emitted when payout to treasury
    /// @param caller caller address
    /// @param amount ether amount
    event TreasuryPayout(address indexed caller, uint256 amount);

    /// @dev Represents the data needed for minting a Pyramid.
    /// @param questId The ID of the quest associated with the Pyramid
    /// @param nonce A unique number to prevent replay attacks
    /// @param price The price paid for minting the Pyramid
    /// @param toAddress The address where the Pyramid will be minted
    /// @param walletProvider The wallet provider used for the transaction
    /// @param tokenURI The URI pointing to the Pyramid's metadata
    /// @param embedOrigin The origin source of the Pyramid's embed content
    /// @param transactions An array of transactions related to the Pyramid
    /// @param recipients An array of recipients for fee payouts
    /// @param reward Data about the reward associated with the Pyramid
    struct PyramidData {
        string questId;
        uint256 nonce;
        uint256 price;
        address toAddress;
        string walletProvider;
        string tokenURI;
        string embedOrigin;
        TransactionData[] transactions;
        FeeRecipient[] recipients;
        RewardData reward;
    }

    /// @dev Represents a recipient for fee distribution.
    /// @param recipient The address of the fee recipient
    /// @param BPS The basis points representing the fee percentage for the recipient
    struct FeeRecipient {
        address recipient;
        uint16 BPS;
    }

    /// @dev Contains data about the token rewards associated with a Pyramid.
    /// @param tokenAddress The token address of the reward
    /// @param chainId The blockchain chain ID where the transaction occurred
    /// @param amount The amount of the reward (in ETH for this implementation)
    /// @param tokenId The token ID of the reward (only applicable for ERC721 and ERC1155)
    /// @param tokenType The token type (ERC20, ERC721, ERC1155, NATIVE)
    /// @param rakeBps The rake basis points which will go to the treasury
    /// @param factoryAddress The escrow factory address
    struct RewardData {
        address tokenAddress;
        uint256 chainId;
        uint256 amount;
        uint256 tokenId;
        TokenType tokenType;
        uint256 rakeBps;
        address factoryAddress;
    }

    /// @dev Contains data about a specific transaction related to a Pyramid
    /// and is designed to support both EVM and non-EVM data.
    /// @param txHash The hash of the transaction
    /// @param networkChainId The network and chain ID of the transaction in the format <network>:<chain-id>
    struct TransactionData {
        string txHash;
        string networkChainId;
    }

    /// @notice Mints a Pyramid based on the provided data
    /// @param pyramidData PyramidData struct containing minting information
    /// @param signature Signature of the PyramidData struct
    function mintPyramid(
        PyramidData calldata pyramidData,
        bytes calldata signature
    ) external payable;

    /// @notice Enables or disables the minting process
    /// @dev Can only be called by an account with the default admin role.
    /// @param _isMintingActive Boolean indicating whether minting should be active
    function setIsMintingActive(bool _isMintingActive) external;

    /// @notice Sets a new treasury address
    /// @dev Can only be called by an account with the default admin role.
    /// @param _treasury Address of the new treasury to receive fees
    function setTreasury(address _treasury) external;

    /// @notice Withdraws the contract's balance to the message sender
    /// @dev Can only be called by an account with the default admin role.
    function withdraw() external;

    /// @notice Sets a new Arkada rewarder address
    /// @dev Can only be called by an account with the default admin role.
    /// @param _arkadaRewarder Address of the new Arkada rewarder
    function setArkadaRewarder(address _arkadaRewarder) external;
}
