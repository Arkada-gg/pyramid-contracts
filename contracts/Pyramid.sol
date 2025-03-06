// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.22;

import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IFactory} from "./escrow/interfaces/IFactory.sol";
import {ITokenType} from "./escrow/interfaces/ITokenType.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Pyramid
/// @dev Implementation of an NFT smart contract with EIP712 signatures.
/// The contract is upgradeable using OpenZeppelin's UUPSUpgradeable pattern.
/// @custom:oz-upgrades-from Pyramid
contract Pyramid is
    Initializable,
    ERC721Upgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    EIP712Upgradeable,
    ReentrancyGuardUpgradeable,
    ITokenType
{
    using ECDSA for bytes32;

    error Pyramid__IsNotSigner();
    error Pyramid__MintingIsNotActive();
    error Pyramid__FeeNotEnough();
    error Pyramid__SignatureAndCubesInputMismatch();
    error Pyramid__WithdrawFailed();
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

    uint256 internal s_nextTokenId;
    bool public s_isMintingActive;

    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER");

    bytes32 internal constant TX_DATA_HASH =
        keccak256("TransactionData(string txHash,string networkChainId)");
    bytes32 internal constant RECIPIENT_DATA_HASH =
        keccak256("FeeRecipient(address recipient,uint16 BPS)");
    bytes32 internal constant REWARD_DATA_HASH =
        keccak256(
            "RewardData(address tokenAddress,uint256 chainId,uint256 amount,uint256 tokenId,uint8 tokenType,uint256 rakeBps,address factoryAddress)"
        );
    bytes32 internal constant _PYRAMID_DATA_HASH =
        keccak256(
            "PyramidData(uint256 questId,uint256 nonce,uint256 price,address toAddress,string walletProvider,string tokenURI,string embedOrigin,TransactionData[] transactions,FeeRecipient[] recipients,RewardData reward)FeeRecipient(address recipient,uint16 BPS)RewardData(address tokenAddress,uint256 chainId,uint256 amount,uint256 tokenId,uint8 tokenType,uint256 rakeBps,address factoryAddress)TransactionData(string txHash,string networkChainId)"
        );

    mapping(uint256 => uint256) internal s_questIssueNumbers;
    mapping(uint256 => string) internal s_tokenURIs;
    mapping(uint256 nonce => bool isConsumed) internal s_nonces;
    mapping(uint256 => bool) internal s_quests;

    address public s_treasury;
    bytes4 private constant TRANSFER_ERC20 =
        bytes4(keccak256(bytes("transferFrom(address,address,uint256)")));

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
    /// @param issueNumber The issue number of the Pyramid
    /// @param walletProvider The name of the wallet provider used for claiming
    /// @param embedOrigin The origin of the embed associated with the Pyramid
    event PyramidClaim(
        uint256 indexed questId,
        uint256 indexed tokenId,
        address indexed claimer,
        uint256 price,
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

    /// @notice Emitted when a quest is disabled
    /// @param questId The ID of the quest that was disabled
    event QuestDisabled(uint256 indexed questId);

    /// @notice Emitted when the treasury address is updated
    /// @param newTreasury The new treasury address
    event UpdatedTreasury(address indexed newTreasury);

    /// @notice Emitted when the L3 token address is updated
    /// @param token The L3 token address
    event UpdatedL3Address(address indexed token);

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
        uint256 questId;
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
    /// @param amount The amount of the reward
    /// @param tokenId The token ID
    /// @param tokenType The token type
    /// @param rakeBps The rake basis points
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

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Returns the version of the Pyramid smart contract
    function pyramidVersion() external pure returns (string memory) {
        return "1";
    }

    /// @notice Initializes the Pyramid contract with necessary parameters
    /// @dev Sets up the ERC721 token with given name and symbol, and grants initial roles.
    /// @param _tokenName Name of the NFT collection
    /// @param _tokenSymbol Symbol of the NFT collection
    /// @param _signingDomain Domain used for EIP712 signing
    /// @param _signatureVersion Version of the EIP712 signature
    /// @param _admin Address to be granted the admin roles
    function initialize(
        string memory _tokenName,
        string memory _tokenSymbol,
        string memory _signingDomain,
        string memory _signatureVersion,
        address _admin
    ) external initializer {
        if (_admin == address(0)) revert Pyramid__InvalidAdminAddress();
        __ERC721_init(_tokenName, _tokenSymbol);
        __EIP712_init(_signingDomain, _signatureVersion);
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        s_isMintingActive = true;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    }

    /// @notice Authorizes an upgrade to a new contract implementation
    /// @dev Overrides the UUPSUpgradeable internal function with access control.
    /// @param newImplementation Address of the new contract implementation
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {}

    /// @notice Checks whether a quest is active or not
    /// @param questId Unique identifier for the quest
    function isQuestActive(uint256 questId) public view returns (bool) {
        return s_quests[questId];
    }

    /// @notice Retrieves the URI for a given token
    /// @dev Overrides the ERC721Upgradeable's tokenURI method.
    /// @param _tokenId The ID of the token
    /// @return _tokenURI The URI of the specified token
    function tokenURI(
        uint256 _tokenId
    ) public view override returns (string memory _tokenURI) {
        return s_tokenURIs[_tokenId];
    }

    /// @notice Mints a Pyramid based on the provided data
    /// @param pyramidData PyramidData struct containing minting information
    /// @param signature Signature of the PyramidData struct
    function mintPyramid(
        PyramidData calldata pyramidData,
        bytes calldata signature
    ) external payable nonReentrant {
        // Check if the minting function is currently active. If not, revert the transaction
        if (!s_isMintingActive) {
            revert Pyramid__MintingIsNotActive();
        }

        // Check if the sent value is at least equal to the price
        if (msg.value < pyramidData.price) {
            revert Pyramid__FeeNotEnough();
        }

        if (s_treasury == address(0)) {
            revert Pyramid__TreasuryNotSet();
        }

        _mintPyramid(pyramidData, signature);
    }

    /// @notice Internal function to handle the logic of minting a single pyramid
    /// @dev Verifies the signer, handles nonce, transactions, referral payments, and minting.
    /// @param data The PyramidData containing details of the minting
    /// @param signature The signature for verification
    function _mintPyramid(
        PyramidData calldata data,
        bytes calldata signature
    ) internal {
        // Cache the tokenId
        uint256 tokenId = s_nextTokenId;

        // Validate the signature to ensure the mint request is authorized
        _validateSignature(data, signature);

        // Iterate over all the transactions in the mint request and emit events
        for (uint256 i = 0; i < data.transactions.length; ) {
            emit PyramidTransaction(
                tokenId,
                data.transactions[i].txHash,
                data.transactions[i].networkChainId
            );
            unchecked {
                ++i;
            }
        }

        // Set the token URI for the Pyramid
        s_tokenURIs[tokenId] = data.tokenURI;

        // Increment the counters for quest completion, issue numbers, and token IDs
        unchecked {
            ++s_questIssueNumbers[data.questId];
            ++s_nextTokenId;
        }

        // process payments
        _processNativePayouts(data);

        // Perform the actual minting of the Pyramid
        _safeMint(data.toAddress, tokenId);

        // Emit an event indicating a Pyramid has been claimed
        emit PyramidClaim(
            data.questId,
            tokenId,
            data.toAddress,
            data.price,
            s_questIssueNumbers[data.questId],
            data.walletProvider,
            data.embedOrigin
        );

        if (data.reward.chainId != 0) {
            if (data.reward.factoryAddress != address(0)) {
                IFactory(data.reward.factoryAddress).distributeRewards(
                    data.questId,
                    data.reward.tokenAddress,
                    data.toAddress,
                    data.reward.amount,
                    data.reward.tokenId,
                    data.reward.tokenType,
                    data.reward.rakeBps
                );
            }

            emit TokenReward(
                tokenId,
                data.reward.tokenAddress,
                data.reward.chainId,
                data.reward.amount,
                data.reward.tokenId,
                data.reward.tokenType
            );
        }
    }

    /// @notice Validates the signature for a Pyramid minting request
    /// @dev Ensures that the signature is from a valid signer and the nonce hasn't been used before
    /// @param data The PyramidData struct containing minting details
    /// @param signature The signature to be validated
    function _validateSignature(
        PyramidData calldata data,
        bytes calldata signature
    ) internal {
        address signer = _getSigner(data, signature);
        if (!hasRole(SIGNER_ROLE, signer)) {
            revert Pyramid__IsNotSigner();
        }
        if (s_nonces[data.nonce]) {
            revert Pyramid__NonceAlreadyUsed();
        }
        s_nonces[data.nonce] = true;
    }

    /// @dev Calculates payout amounts for all recipients
    /// @param data The PyramidData containing recipient information
    /// @return payoutAmounts Array of amounts to pay each recipient
    /// @return totalAmount Total amount to be paid to recipients
    function _calculatePayouts(
        PyramidData calldata data
    )
        internal
        pure
        returns (uint256[] memory payoutAmounts, uint256 totalAmount)
    {
        uint256 recipientsLength = data.recipients.length;
        uint16 MAX_BPS = 10_000;
        payoutAmounts = new uint256[](recipientsLength);
        totalAmount = 0;

        for (uint256 i = 0; i < recipientsLength; ) {
            if (data.recipients[i].BPS > MAX_BPS) {
                revert Pyramid__BPSTooHigh();
            }

            payoutAmounts[i] = (data.price * data.recipients[i].BPS) / MAX_BPS;
            totalAmount += payoutAmounts[i];

            if (totalAmount > data.price) {
                revert Pyramid__ExcessiveFeePayout();
            }

            unchecked {
                ++i;
            }
        }
    }

    /// @notice Processes fee payouts to specified recipients when handling native payments
    /// @dev Distributes a portion of the minting fee to designated addresses based on their Basis Points (BPS)
    /// @param data The PyramidData struct containing payout details
    function _processNativePayouts(PyramidData calldata data) internal {
        uint256 totalReferrals;

        if (data.recipients.length > 0) {
            // max basis points is 10k (100%)
            uint16 maxBps = 10_000;
            uint256 contractBalance = address(this).balance;
            for (uint256 i = 0; i < data.recipients.length; ) {
                if (data.recipients[i].BPS > maxBps) {
                    revert Pyramid__BPSTooHigh();
                }

                // Calculate the referral amount for each recipient
                uint256 referralAmount = (data.price * data.recipients[i].BPS) /
                    maxBps;
                totalReferrals = totalReferrals + referralAmount;

                // Ensure the total payout does not exceed the cube price or contract balance
                if (totalReferrals > data.price) {
                    revert Pyramid__ExcessiveFeePayout();
                }
                if (totalReferrals > contractBalance) {
                    revert Pyramid__ExceedsContractBalance();
                }

                // Transfer the referral amount to the recipient
                address recipient = data.recipients[i].recipient;
                if (recipient != address(0)) {
                    (bool payoutSuccess, ) = recipient.call{
                        value: referralAmount
                    }("");
                    if (!payoutSuccess) {
                        revert Pyramid__TransferFailed();
                    }

                    emit FeePayout(recipient, referralAmount);
                }
                unchecked {
                    ++i;
                }
            }
        }

        (bool success, ) = payable(s_treasury).call{
            value: data.price - totalReferrals
        }("");
        if (!success) {
            revert Pyramid__NativePaymentFailed();
        }
    }

    /// @notice Recovers the signer's address from the PyramidData and its associated signature
    /// @dev Utilizes EIP-712 typed data hashing and ECDSA signature recovery
    /// @param data The PyramidData struct containing the details of the minting request
    /// @param sig The signature associated with the PyramidData
    /// @return The address of the signer who signed the PyramidData
    function _getSigner(
        PyramidData calldata data,
        bytes calldata sig
    ) internal view returns (address) {
        bytes32 digest = _computeDigest(data);
        return digest.recover(sig);
    }

    /// @notice Internal function to compute the EIP712 digest for CubeData
    /// @dev Generates the digest that must be signed by the signer.
    /// @param data The PyramidData to generate a digest for
    /// @return The computed EIP712 digest
    function _computeDigest(
        PyramidData calldata data
    ) internal view returns (bytes32) {
        return _hashTypedDataV4(keccak256(_getStructHash(data)));
    }

    /// @notice Internal function to generate the struct hash for PyramidData
    /// @dev Encodes the PyramidData struct into a hash as per EIP712 standard.
    /// @param data The PyramidData struct to hash
    /// @return A hash representing the encoded PyramidData
    function _getStructHash(
        PyramidData calldata data
    ) internal pure returns (bytes memory) {
        return
            abi.encode(
                _PYRAMID_DATA_HASH,
                data.questId,
                data.nonce,
                data.price,
                data.toAddress,
                _encodeString(data.walletProvider),
                _encodeString(data.tokenURI),
                _encodeString(data.embedOrigin),
                _encodeCompletedTxs(data.transactions),
                _encodeRecipients(data.recipients),
                _encodeReward(data.reward)
            );
    }

    /// @notice Encodes a string into a bytes32 hash
    /// @dev Used for converting strings into a consistent format for EIP712 encoding
    /// @param _string The string to be encoded
    /// @return The keccak256 hash of the encoded string
    function _encodeString(
        string calldata _string
    ) internal pure returns (bytes32) {
        return keccak256(bytes(_string));
    }

    /// @notice Encodes a transaction data into a byte array
    /// @dev Used for converting transaction data into a consistent format for EIP712 encoding
    /// @param transaction The TransactionData struct to be encoded
    /// @return A byte array representing the encoded transaction data
    function _encodeTx(
        TransactionData calldata transaction
    ) internal pure returns (bytes memory) {
        return
            abi.encode(
                TX_DATA_HASH,
                _encodeString(transaction.txHash),
                _encodeString(transaction.networkChainId)
            );
    }

    /// @notice Encodes an array of transaction data into a single bytes32 hash
    /// @dev Used to aggregate multiple transactions into a single hash for EIP712 encoding
    /// @param txData An array of TransactionData structs to be encoded
    /// @return A bytes32 hash representing the aggregated and encoded transaction data
    function _encodeCompletedTxs(
        TransactionData[] calldata txData
    ) internal pure returns (bytes32) {
        bytes32[] memory encodedTxs = new bytes32[](txData.length);
        for (uint256 i = 0; i < txData.length; ) {
            encodedTxs[i] = keccak256(_encodeTx(txData[i]));
            unchecked {
                ++i;
            }
        }

        return keccak256(abi.encodePacked(encodedTxs));
    }

    /// @notice Encodes a fee recipient data into a byte array
    /// @dev Used for converting fee recipient information into a consistent format for EIP712 encoding
    /// @param data The FeeRecipient struct to be encoded
    /// @return A byte array representing the encoded fee recipient data
    function _encodeRecipient(
        FeeRecipient calldata data
    ) internal pure returns (bytes memory) {
        return abi.encode(RECIPIENT_DATA_HASH, data.recipient, data.BPS);
    }

    /// @notice Encodes an array of fee recipient data into a single bytes32 hash
    /// @dev Used to aggregate multiple fee recipient entries into a single hash for EIP712 encoding
    /// @param data An array of FeeRecipient structs to be encoded
    /// @return A bytes32 hash representing the aggregated and encoded fee recipient data
    function _encodeRecipients(
        FeeRecipient[] calldata data
    ) internal pure returns (bytes32) {
        bytes32[] memory encodedRecipients = new bytes32[](data.length);
        for (uint256 i = 0; i < data.length; ) {
            encodedRecipients[i] = keccak256(_encodeRecipient(data[i]));
            unchecked {
                ++i;
            }
        }

        return keccak256(abi.encodePacked(encodedRecipients));
    }

    /// @notice Encodes the reward data for a Pyramid mint
    /// @param data An array of FeeRecipient structs to be encoded
    /// @return A bytes32 hash representing the encoded reward data
    function _encodeReward(
        RewardData calldata data
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    REWARD_DATA_HASH,
                    data.tokenAddress,
                    data.chainId,
                    data.amount,
                    data.tokenId,
                    data.tokenType,
                    data.rakeBps,
                    data.factoryAddress
                )
            );
    }

    /// @notice Enables or disables the minting process
    /// @dev Can only be called by an account with the default admin role.
    /// @param _isMintingActive Boolean indicating whether minting should be active
    function setIsMintingActive(
        bool _isMintingActive
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        s_isMintingActive = _isMintingActive;
        emit MintingSwitch(_isMintingActive);
    }

    /// @notice Sets a new treasury address
    /// @dev Can only be called by an account with the default admin role.
    /// @param _treasury Address of the new treasury to receive fees
    function setTreasury(
        address _treasury
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        s_treasury = _treasury;
        emit UpdatedTreasury(_treasury);
    }

    /// @notice Withdraws the contract's balance to the message sender
    /// @dev Can only be called by an account with the default admin role.
    function withdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 withdrawAmount = address(this).balance;
        (bool success, ) = msg.sender.call{value: withdrawAmount}("");
        if (!success) {
            revert Pyramid__WithdrawFailed();
        }
        emit ContractWithdrawal(withdrawAmount);
    }

    /// @notice Initializes a new quest with given parameters
    /// @dev Can only be called by an account with the signer role.
    /// @param questId Unique identifier for the quest
    /// @param communities Array of community names associated with the quest
    /// @param title Title of the quest
    /// @param difficulty Difficulty level of the quest
    /// @param questType Type of the quest
    function initializeQuest(
        uint256 questId,
        string[] memory communities,
        string memory title,
        Difficulty difficulty,
        QuestType questType,
        string[] memory tags
    ) external onlyRole(SIGNER_ROLE) {
        s_quests[questId] = true;
        emit QuestMetadata(
            questId,
            questType,
            difficulty,
            title,
            tags,
            communities
        );
    }

    /// @notice Unpublishes and disables a quest
    /// @dev Can only be called by an account with the signer role
    /// @param questId Unique identifier for the quest
    function unpublishQuest(uint256 questId) external onlyRole(SIGNER_ROLE) {
        s_quests[questId] = false;
        emit QuestDisabled(questId);
    }

    /// @notice Checks if the contract implements an interface
    /// @dev Overrides the supportsInterface function of ERC721Upgradeable and AccessControlUpgradeable.
    /// @param interfaceId The interface identifier, as specified in ERC-165
    /// @return True if the contract implements the interface, false otherwise
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
