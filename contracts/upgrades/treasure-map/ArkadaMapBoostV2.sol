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
import {IArkadaMapBoostV2} from "../interfaces/IArkadaMapBoostV2.sol";

/// @title ArkadaMapBoostV2
/// @dev Adds adminMint — owner can mint to any address without payment.
contract ArkadaMapBoostV2 is
    Initializable,
    ERC721Upgradeable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    IArkadaMapBoostV2
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

    // ================================ Public Functions ================================

    function mint() external payable {
        _mintBoost(msg.sender);
    }

    /// @inheritdoc IArkadaMapBoostV2
    function adminMint(address to) external onlyOwner validAddress(to) {
        uint256 tokenId = s_nextTokenId;
        _safeMint(to, tokenId);
        unchecked {
            ++s_nextTokenId;
        }
        emit Minted(to, tokenId);
    }

    function activate(uint256 _tokenId) external {
        if (isActivated[_tokenId]) revert ArkadaMapBoost__AlreadyActivated();
        if (_requireOwned(_tokenId) != msg.sender)
            revert ArkadaMapBoost__NotOwner();

        isActivated[_tokenId] = true;

        emit BoostActivated(msg.sender, _tokenId);
    }

    // ================================ Owner Functions ================================

    function setMintPrice(
        uint256 _mintPrice
    ) external onlyOwner validAmount(_mintPrice) {
        mintPrice = _mintPrice;
        emit MintPriceUpdated(msg.sender, _mintPrice);
    }

    function setMintingActive(bool _isMintingActive) external onlyOwner {
        s_isMintingActive = _isMintingActive;
        emit MintingActiveUpdated(msg.sender, _isMintingActive);
    }

    function setTreasury(
        address _treasury
    ) external onlyOwner validAddress(_treasury) {
        treasury = _treasury;
        emit TreasuryUpdated(msg.sender, _treasury);
    }

    function setBaseURI(string calldata _baseURI) external onlyOwner {
        s_baseURI = _baseURI;
        emit BaseURIUpdated(msg.sender, _baseURI);
    }

    // ================================ Private Functions ================================

    function _mintBoost(address to) internal nonReentrant {
        if (!s_isMintingActive) revert ArkadaMapBoost__MintingNotActive();
        if (msg.value != mintPrice) revert ArkadaMapBoost__InvalidPayment();

        uint256 tokenId = s_nextTokenId;
        _safeMint(to, tokenId);

        (bool success, ) = treasury.call{value: msg.value}("");
        if (!success) {
            revert ArkadaMapBoost__TransferFailed();
        }

        unchecked {
            ++s_nextTokenId;
        }

        emit Minted(to, tokenId);
    }

    // ================================ Overrides ================================

    function tokenURI(
        uint256 /* _tokenId */
    ) public view override returns (string memory) {
        return s_baseURI;
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);

        if (from != address(0) && isActivated[tokenId]) {
            revert ArkadaMapBoost__CannotTransferActivated();
        }

        return super._update(to, tokenId, auth);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721Upgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    receive() external payable {
        _mintBoost(msg.sender);
    }
}
