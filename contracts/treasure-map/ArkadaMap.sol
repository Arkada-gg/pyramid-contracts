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
import {IArkadaMap} from "../interfaces/IArkadaMap.sol";

/// @title ArkadaMap
/// @dev Implementation of a map pieces smart contract using ERC1155.
/// The contract is upgradeable using OpenZeppelin's TransparentUpgradeableProxy pattern.
/// There are 12 map pieces (token IDs 0-11), each with its own metadata.
/// Only addresses with MINTER_ROLE can mint pieces.
/// Pieces cannot be transferred by default, only whitelisted addresses can transfer them.
/// Burning is currently disabled but can be enabled in future upgrades.
contract ArkadaMap is
    Initializable,
    ERC1155Upgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    IArkadaMap
{
    // ================================ Constants ================================

    /// @notice Maximum number of map pieces
    uint256 public constant MAX_PIECES = 12;

    /// @notice Role that allows minting map pieces
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // ================================ State Variables ================================

    /// @notice Mapping from token ID to its URI
    mapping(uint256 => string) internal s_tokenURIs;

    /// @notice Mapping of whitelisted addresses that can transfer tokens
    mapping(address => bool) public isWhitelisted;

    /**
     * @dev leaving a storage gap for futures updates
     */
    uint256[50] private __gap;

    // ================================ Modifiers ================================

    modifier validAddress(address _address) {
        if (_address == address(0)) revert ArkadaMap__InvalidAddress();
        _;
    }

    modifier validTokenId(uint256 _tokenId) {
        if (_tokenId >= MAX_PIECES) revert ArkadaMap__TokenIdOutOfRange();
        _;
    }

    // ================================ Constructor ================================

    /// @notice Initializes the ArkadaMap contract
    /// @dev Sets up the ERC1155 token and grants initial roles.
    /// @param _admin The address to be granted the admin role
    /// @param _uri The base URI for tokens (can be empty, will be overridden by per-token URIs)
    function initialize(
        address _admin,
        string memory _uri
    ) external initializer validAddress(_admin) {
        __ERC1155_init(_uri);
        __AccessControl_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
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
}
