// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.22;

import {
    Initializable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {
    ERC721Upgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {
    OwnableUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IArkadaMapBoost} from "../interfaces/IArkadaMapBoost.sol";

/// @title ArkadaMapBoost
/// @dev Implementation of a map boost smart contract.
/// The contract is upgradeable using OpenZeppelin's TransparentUpgradeableProxy pattern.
contract ArkadaMapBoost is
    Initializable,
    ERC721Upgradeable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    IArkadaMapBoost
{
    // ================================ State Variables ================================

    uint256 internal s_nextTokenId;
    string internal s_baseURI;

    uint256 public mintPrice;
    bool public s_isMintingActive;
    address public treasury;

    mapping(uint256 => bool) public isActivated;

    /**
     * @dev leaving a storage gap for futures updates
     */
    uint256[50] private __gap;

    // ================================ Modifiers ================================

    modifier validAmount(uint256 _amount) {
        if (_amount == 0) revert ArkadaMapBoost__InvalidAmount();
        _;
    }
    modifier validAddress(address _address) {
        if (_address == address(0)) revert ArkadaMapBoost__InvalidAddress();
        _;
    }

    // ================================ Constructor ================================

    /// @notice Initializes the ArkadaMapBoost contract
    /// @dev Sets up the ERC721 token with given name and symbol, and grants initial role.
    /// @param _name The name of the NFT
    /// @param _symbol The symbol of the NFT
    /// @param _baseURI The base URI for the NFT
    /// @param _admin The address to be granted the admin role
    /// @param _treasury The address of the treasury
    /// @param _mintPrice The mint price for the NFT
    function initialize(
        string memory _name,
        string memory _symbol,
        string memory _baseURI,
        address _admin,
        address _treasury,
        uint256 _mintPrice
    ) external initializer validAddress(_treasury) validAmount(_mintPrice) {
        __ERC721_init(_name, _symbol);
        __ReentrancyGuard_init();
        __Ownable_init(_admin);

        mintPrice = _mintPrice;
        s_isMintingActive = true;
        treasury = _treasury;
        s_baseURI = _baseURI;
    }

    // ================================ Public Functions ================================

    /**
     * @inheritdoc IArkadaMapBoost
     */
    function mint() external payable {
        _mint();
    }

    /**
     * @inheritdoc IArkadaMapBoost
     */
    function activate(uint256 _tokenId) external {
        if (isActivated[_tokenId]) revert ArkadaMapBoost__AlreadyActivated();
        if (_requireOwned(_tokenId) != msg.sender)
            revert ArkadaMapBoost__NotOwner();

        isActivated[_tokenId] = true;

        emit BoostActivated(msg.sender, _tokenId);
    }

    // ================================ Owner Functions ================================

    /**
     * @inheritdoc IArkadaMapBoost
     */
    function setMintPrice(
        uint256 _mintPrice
    ) external onlyOwner validAmount(_mintPrice) {
        mintPrice = _mintPrice;
        emit MintPriceUpdated(msg.sender, _mintPrice);
    }

    /**
     * @inheritdoc IArkadaMapBoost
     */
    function setMintingActive(bool _isMintingActive) external onlyOwner {
        s_isMintingActive = _isMintingActive;
        emit MintingActiveUpdated(msg.sender, _isMintingActive);
    }

    /**
     * @inheritdoc IArkadaMapBoost
     */
    function setTreasury(
        address _treasury
    ) external onlyOwner validAddress(_treasury) {
        treasury = _treasury;
        emit TreasuryUpdated(msg.sender, _treasury);
    }

    /**
     * @inheritdoc IArkadaMapBoost
     */
    function setBaseURI(string calldata _baseURI) external onlyOwner {
        s_baseURI = _baseURI;
        emit BaseURIUpdated(msg.sender, _baseURI);
    }

    // ================================ Private Functions ================================

    function _mint() internal nonReentrant {
        if (!s_isMintingActive) revert ArkadaMapBoost__MintingNotActive();
        if (msg.value != mintPrice) revert ArkadaMapBoost__InvalidPayment();

        // Cache the tokenId
        uint256 tokenId = s_nextTokenId;

        // Perform the actual minting of the ArkadaMapBoost
        _safeMint(msg.sender, tokenId);

        // Transfer the mint price to the treasury
        (bool success, ) = treasury.call{value: msg.value}("");
        if (!success) {
            revert ArkadaMapBoost__TransferFailed();
        }

        unchecked {
            ++s_nextTokenId;
        }

        emit Minted(msg.sender, tokenId);
    }

    // ================================ Overrides ================================

    /// @notice Retrieves the URI for a given token
    /// @dev Overrides the ERC721Upgradeable's tokenURI method.
    /// @dev Returns the same URI for all tokens.
    /// @return _tokenURI The URI of the specified token
    function tokenURI(
        uint256 /* _tokenId */
    ) public view override returns (string memory _tokenURI) {
        return s_baseURI;
    }

    /// @notice Overrides the _update function to prevent transfers of activated NFTs
    /// @dev Allows minting (when from is address(0)) but blocks transfers of activated tokens
    /// @param to The address to transfer the token to
    /// @param tokenId The token ID to transfer
    /// @param auth The address authorized to perform the transfer
    /// @return The previous owner of the token
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);

        // Allow minting (when from is address(0)), but block transfers of activated tokens
        if (from != address(0) && isActivated[tokenId]) {
            revert ArkadaMapBoost__CannotTransferActivated();
        }

        return super._update(to, tokenId, auth);
    }

    // ================================ Internal Functions ================================

    /// @notice Checks if the contract implements an interface
    /// @dev Overrides the supportsInterface function of ERC721Upgradeable.
    /// @param interfaceId The interface identifier, as specified in ERC-165
    /// @return True if the contract implements the interface, false otherwise
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721Upgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    receive() external payable {
        _mint();
    }
}
