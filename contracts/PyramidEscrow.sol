// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.22;

import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IFactory} from "./escrow/interfaces/IFactory.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPyramidEscrow} from "./interfaces/IPyramidEscrow.sol";
import {IArkadaRewarder} from "./interfaces/IArkadaRewarder.sol";

/// @title PyramidEscrow
/// @dev Implementation of an NFT smart contract with EIP712 signatures.
/// The contract is upgradeable using OpenZeppelin's TransparentUpgradeableProxy pattern.
contract PyramidEscrow is
    Initializable,
    ERC721Upgradeable,
    AccessControlUpgradeable,
    EIP712Upgradeable,
    ReentrancyGuardUpgradeable,
    IPyramidEscrow
{
    using ECDSA for bytes32;

    uint256 internal s_nextTokenId;
    bool public s_isMintingActive;
    address public s_arkadaRewarder;

    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER");

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
            "PyramidData(string questId,uint256 nonce,uint256 price,address toAddress,string walletProvider,string tokenURI,string embedOrigin,TransactionData[] transactions,FeeRecipient[] recipients,RewardData reward)FeeRecipient(address recipient,uint16 BPS)RewardData(address tokenAddress,uint256 chainId,uint256 amount,uint256 tokenId,uint8 tokenType,uint256 rakeBps,address factoryAddress)TransactionData(string txHash,string networkChainId)"
        );

    mapping(bytes32 => uint256) internal s_questIssueNumbers;
    mapping(uint256 => string) internal s_tokenURIs;
    mapping(uint256 => bool) internal s_nonces;
    // @dev encoded keccak256(questId) with toAddress => isMinted
    mapping(bytes32 => bool) internal s_quests_ids;

    address public s_treasury;
    bytes4 private constant TRANSFER_ERC20 =
        bytes4(keccak256(bytes("transferFrom(address,address,uint256)")));

    /**
     * @dev leaving a storage gap for futures updates
     */
    uint256[50] private __gap;

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
        address _admin,
        address _arkadaRewarder
    ) external initializer {
        if (_admin == address(0)) revert Pyramid__InvalidAdminAddress();
        if (_arkadaRewarder == address(0))
            revert Pyramid__InvalidAdminAddress();
        __ERC721_init(_tokenName, _tokenSymbol);
        __EIP712_init(_signingDomain, _signatureVersion);
        __AccessControl_init();
        __ReentrancyGuard_init();
        s_isMintingActive = true;
        s_arkadaRewarder = _arkadaRewarder;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    }

    /// @notice Retrieves the URI for a given token
    /// @dev Overrides the ERC721Upgradeable's tokenURI method.
    /// @param _tokenId The ID of the token
    /// @return _tokenURI The URI of the specified token
    function tokenURI(uint256 _tokenId)
        public
        view
        override
        returns (string memory _tokenURI)
    {
        return s_tokenURIs[_tokenId];
    }

    /**
     * @inheritdoc IPyramidEscrow
     */
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
    function _mintPyramid(PyramidData calldata data, bytes calldata signature)
        internal
    {
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

        bytes32 questIdHash = keccak256(bytes(data.questId));
        bytes32 questIdAndAddressHash = keccak256(
            abi.encodePacked(questIdHash, data.toAddress)
        );

        if (s_quests_ids[questIdAndAddressHash]) {
            revert Pyramid__MintedForQuestId();
        }
        s_quests_ids[questIdAndAddressHash] = true;

        // Increment the counters for quest completion, issue numbers, and token IDs
        unchecked {
            ++s_questIssueNumbers[questIdHash];
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
            data.reward.amount,
            s_questIssueNumbers[questIdHash],
            data.walletProvider,
            data.embedOrigin
        );

        if (data.reward.chainId != 0) {
            if (data.reward.factoryAddress != address(0)) {
                IFactory(data.reward.factoryAddress).distributeRewards(
                    questIdHash,
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
    function _calculatePayouts(PyramidData calldata data)
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
        uint256 arrayLength = data.recipients.length;

        address[] memory recipients = new address[](arrayLength);
        uint256[] memory amounts = new uint256[](arrayLength);

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
                    recipients[i] = recipient;
                    amounts[i] = referralAmount;
                    emit FeePayout(recipient, referralAmount);
                }
                unchecked {
                    ++i;
                }
            }
        }

        // Add payouts of referrals and user rewards to the ArkadaRewarder
        IArkadaRewarder(s_arkadaRewarder).addRewards(recipients, amounts);

        // Transfer the referrals amount and user rewards to the ArkadaRewarder
        (bool success, ) = payable(s_arkadaRewarder).call{
            value: totalReferrals
        }("");
        if (!success) {
            revert Pyramid__TransferFailed();
        }

        uint256 treasuryPayout = data.price - totalReferrals;

        // Transfer the remaining amount to the treasury
        (success, ) = payable(s_treasury).call{value: treasuryPayout}("");
        if (!success) {
            revert Pyramid__NativePaymentFailed();
        }
        emit TreasuryPayout(msg.sender, treasuryPayout);
    }

    /// @notice Recovers the signer's address from the PyramidData and its associated signature
    /// @dev Utilizes EIP-712 typed data hashing and ECDSA signature recovery
    /// @param data The PyramidData struct containing the details of the minting request
    /// @param sig The signature associated with the PyramidData
    /// @return The address of the signer who signed the PyramidData
    function _getSigner(PyramidData calldata data, bytes calldata sig)
        internal
        view
        returns (address)
    {
        bytes32 digest = _computeDigest(data);
        return digest.recover(sig);
    }

    /// @notice Internal function to compute the EIP712 digest for PyramidData
    /// @dev Generates the digest that must be signed by the signer.
    /// @param data The PyramidData to generate a digest for
    /// @return The computed EIP712 digest
    function _computeDigest(PyramidData calldata data)
        internal
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(keccak256(_getStructHash(data)));
    }

    /// @notice Internal function to generate the struct hash for PyramidData
    /// @dev Encodes the PyramidData struct into a hash as per EIP712 standard.
    /// @param data The PyramidData struct to hash
    /// @return A hash representing the encoded PyramidData
    function _getStructHash(PyramidData calldata data)
        internal
        pure
        returns (bytes memory)
    {
        return
            abi.encode(
                _PYRAMID_DATA_HASH,
                _encodeString(data.questId),
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
    function _encodeString(string calldata _string)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(bytes(_string));
    }

    /// @notice Encodes a transaction data into a byte array
    /// @dev Used for converting transaction data into a consistent format for EIP712 encoding
    /// @param transaction The TransactionData struct to be encoded
    /// @return A byte array representing the encoded transaction data
    function _encodeTx(TransactionData calldata transaction)
        internal
        pure
        returns (bytes memory)
    {
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
    function _encodeCompletedTxs(TransactionData[] calldata txData)
        internal
        pure
        returns (bytes32)
    {
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
    function _encodeRecipient(FeeRecipient calldata data)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(RECIPIENT_DATA_HASH, data.recipient, data.BPS);
    }

    /// @notice Encodes an array of fee recipient data into a single bytes32 hash
    /// @dev Used to aggregate multiple fee recipient entries into a single hash for EIP712 encoding
    /// @param data An array of FeeRecipient structs to be encoded
    /// @return A bytes32 hash representing the aggregated and encoded fee recipient data
    function _encodeRecipients(FeeRecipient[] calldata data)
        internal
        pure
        returns (bytes32)
    {
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
    function _encodeReward(RewardData calldata data)
        internal
        pure
        returns (bytes32)
    {
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

    /**
     * @inheritdoc IPyramidEscrow
     */
    function setIsMintingActive(bool _isMintingActive)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        s_isMintingActive = _isMintingActive;
        emit MintingSwitch(_isMintingActive);
    }

    /**
     * @inheritdoc IPyramidEscrow
     */
    function setTreasury(address _treasury)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (_treasury == address(0)) revert Pyramid__ZeroAddress();
        s_treasury = _treasury;
        emit UpdatedTreasury(_treasury);
    }

    /**
     * @inheritdoc IPyramidEscrow
     */
    function setArkadaRewarder(address _arkadaRewarder)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (_arkadaRewarder == address(0)) revert Pyramid__ZeroAddress();
        s_arkadaRewarder = _arkadaRewarder;
        emit UpdatedArkadaRewarder(_arkadaRewarder);
    }

    /**
     * @inheritdoc IPyramidEscrow
     */
    function withdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 withdrawAmount = address(this).balance;
        (bool success, ) = msg.sender.call{value: withdrawAmount}("");
        if (!success) {
            revert Pyramid__WithdrawFailed();
        }
        emit ContractWithdrawal(withdrawAmount);
    }

    /// @notice Checks if the contract implements an interface
    /// @dev Overrides the supportsInterface function of ERC721Upgradeable and AccessControlUpgradeable.
    /// @param interfaceId The interface identifier, as specified in ERC-165
    /// @return True if the contract implements the interface, false otherwise
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    receive() external payable {}
}
