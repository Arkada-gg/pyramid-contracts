// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.22;

import {
    Initializable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {
    ERC1155Upgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {
    AccessControlUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {
    EIP712Upgradeable
} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IArkadaMapV2} from "../interfaces/IArkadaMapV2.sol";
import "../../interfaces/IArkadaMap.sol";

/// @title ArkadaMapV2
/// @dev Implementation of a map pieces smart contract using ERC1155.
/// The contract is upgradeable using OpenZeppelin's TransparentUpgradeableProxy pattern.
/// There are 12 map pieces (token IDs 0-11), each with its own metadata.
/// Only addresses with MINTER_ROLE or with valid signature from SIGNER_ROLE can mint pieces.
/// Pieces cannot be transferred by default, only whitelisted addresses can transfer them.
/// Burning is currently disabled but can be enabled in future upgrades.
contract ArkadaMapV2 is
    Initializable,
    ERC1155Upgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    EIP712Upgradeable,
    IArkadaMapV2
{
    using ECDSA for bytes32;

    // ================================ Constants ================================

    /// @notice Maximum number of map pieces
    uint256 public constant MAX_PIECES = 12;

    /// @notice Role that allows minting map pieces
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @notice Role that allows to sign mint data
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");

    /// @notice EIP-712 type hash for MintData struct
    bytes32 internal constant _MINT_DATA_HASH =
        keccak256("MintData(address to,uint256 tokenId,uint256 nonce)");

    // ================================ State Variables ================================

    /// @notice Mapping from token ID to its URI
    mapping(uint256 => string) internal s_tokenURIs;

    /// @notice Mapping of whitelisted addresses that can transfer tokens
    mapping(address => bool) public isWhitelisted;

    /// @notice Mapping to track used nonces for signature-based minting
    /// @dev Prevents signature replay attacks
    mapping(uint256 => bool) internal s_nonces;

    /**
     * @dev Storage gap for future upgrades.
     * Reduced from 50 to 49 to account for s_nonces added above.
     */
    uint256[49] private __gap;

    // ================================ Modifiers ================================

    modifier validAddress(address _address) {
        if (_address == address(0)) revert ArkadaMap__InvalidAddress();
        _;
    }

    modifier validTokenId(uint256 _tokenId) {
        if (_tokenId >= MAX_PIECES) revert ArkadaMap__TokenIdOutOfRange();
        _;
    }

    // ================================ Initializer ================================

    /// @notice Initializes V2-specific state after upgrading from V1
    /// @dev Must be called once after upgradeProxy. Sets up the EIP-712 signing domain.
    function initializeV2() external reinitializer(2) {
        __EIP712_init("ArkadaMap", "1");
    }

    // ================================ Public Functions ================================

    /**
     * @inheritdoc IArkadaMap
     */
    function mint(
        address to,
        uint256 tokenId,
        uint256 amount
    ) external onlyRole(MINTER_ROLE) validAddress(to) validTokenId(tokenId) {
        _mint(to, tokenId, amount, "");

        emit PieceMinted(to, tokenId, amount);
    }

    /**
     * @inheritdoc IArkadaMapV2
     */
    function mintWithSignature(
        MintData calldata data,
        bytes calldata signature
    ) external nonReentrant validAddress(data.to) validTokenId(data.tokenId) {
        _validateSignature(data, signature);
        _mint(data.to, data.tokenId, 1, "");

        emit PieceMinted(data.to, data.tokenId, 1);
        emit SignatureMinted(data.to, data.tokenId, data.nonce);
    }

    /**
     * @inheritdoc IArkadaMap
     */
    function setTokenURI(
        uint256 tokenId,
        string calldata tokenURI
    ) external onlyRole(DEFAULT_ADMIN_ROLE) validTokenId(tokenId) {
        s_tokenURIs[tokenId] = tokenURI;

        emit TokenURIUpdated(msg.sender, tokenId, tokenURI);
    }

    /**
     * @inheritdoc IArkadaMap
     */
    function setWhitelist(
        address account,
        bool isWhitelisted_
    ) external onlyRole(DEFAULT_ADMIN_ROLE) validAddress(account) {
        isWhitelisted[account] = isWhitelisted_;

        emit WhitelistUpdated(account, isWhitelisted_);
    }

    // ================================ Overrides ================================

    /// @notice Retrieves the URI for a given token
    /// @dev Overrides the ERC1155Upgradeable's uri method.
    /// @param tokenId The ID of the token
    /// @return The URI of the specified token
    function uri(uint256 tokenId) public view override returns (string memory) {
        string memory tokenURI = s_tokenURIs[tokenId];

        // If token has custom URI, return it
        if (bytes(tokenURI).length > 0) {
            return tokenURI;
        }

        // Otherwise return base URI with token ID substitution
        return super.uri(tokenId);
    }

    /// @notice Overrides the _update function to enforce transfer restrictions
    /// @dev Allows minting (when from is address(0))
    /// @dev Burning is currently disabled (to == address(0) will revert)
    /// @dev For transfers: only whitelisted addresses can send tokens
    /// @param from The address tokens are transferred from
    /// @param to The address tokens are transferred to
    /// @param ids The array of token IDs
    /// @param values The array of amounts
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal virtual override {
        // Allow minting (from == address(0))
        if (from == address(0)) {
            super._update(from, to, ids, values);
            return;
        }

        // Burning is currently disabled
        if (to == address(0)) {
            revert ArkadaMap__TransferNotAllowed();
        }

        // For transfers between non-zero addresses:
        // Only whitelisted addresses can send tokens
        if (!isWhitelisted[from]) {
            revert ArkadaMap__TransferNotAllowed();
        }

        super._update(from, to, ids, values);
    }

    /// @notice Checks if the contract implements an interface
    /// @dev Overrides the supportsInterface function of ERC1155Upgradeable.
    /// @param interfaceId The interface identifier, as specified in ERC-165
    /// @return True if the contract implements the interface, false otherwise
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC1155Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ================================ Internal ================================

    /// @notice Validates the EIP-712 signature and marks the nonce as used
    /// @param data The mint parameters to validate
    /// @param signature The EIP-712 signature to verify
    function _validateSignature(
        MintData calldata data,
        bytes calldata signature
    ) internal {
        address signer = _getSigner(data, signature);
        if (!hasRole(SIGNER_ROLE, signer)) revert ArkadaMap__InvalidSigner();
        if (s_nonces[data.nonce]) revert ArkadaMap__NonceAlreadyUsed();
        s_nonces[data.nonce] = true;
    }

    /// @notice Recovers the signer address from MintData and its signature
    /// @param data The mint parameters that were signed
    /// @param sig The EIP-712 signature bytes
    /// @return The address that produced the signature
    function _getSigner(
        MintData calldata data,
        bytes calldata sig
    ) internal view returns (address) {
        return _hashTypedDataV4(_getStructHash(data)).recover(sig);
    }

    /// @notice Encodes MintData as an EIP-712 struct hash
    /// @param data The mint parameters to encode
    /// @return The EIP-712 struct hash of data
    function _getStructHash(
        MintData calldata data
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(_MINT_DATA_HASH, data.to, data.tokenId, data.nonce)
            );
    }
}
