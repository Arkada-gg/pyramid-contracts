// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721RoyaltyUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";

import "./interfaces/IArkadaERC721Royalty.sol";

/**
 * @title ArkadaERC721Royalty
 * @notice Smart contract of ERC721 token with royalty implementation
 * @author Arkada
 */
contract ArkadaERC721Royalty is
    Initializable,
    ERC721RoyaltyUpgradeable,
    OwnableUpgradeable,
    IArkadaERC721Royalty
{
    using Counters for Counters.Counter;

    /**
     * @dev address of payments recipient
     */
    address public paymentRecipient;
    /**
     * @dev address of operator who can mint for someone
     */
    address public operator;

    /**
     * @dev timestamp when mint will be blocked
     */
    uint256 public mintDeadline;
    /**
     * @dev mint price in ether
     */
    uint256 public mintPrice;
    /**
     * @dev flag for enable/disable ability of mint multiple per address
     */
    bool public onlyOnePerWallet;

    /**
     * @dev last request id
     */
    Counters.Counter public totalMinted;

    /**
     * @dev address => is minted
     */
    mapping(address => bool) public hasMinted;

    string private _baseTokenURI;

    function initialize(
        string memory _name,
        string memory _symbol,
        string memory baseURI_,
        uint256 _mintPrice,
        uint256 _mintDeadline,
        address _paymentRecipient,
        address _owner
    ) public initializer {
        __ERC721_init(_name, _symbol);
        __ERC721Royalty_init();
        __Ownable_init();

        require(_mintPrice > 0, "invalid price");
        require(_paymentRecipient != address(0), "invalid recipient");
        require(_owner != address(0), "invalid owner");

        _baseTokenURI = baseURI_;
        mintPrice = _mintPrice;
        mintDeadline = _mintDeadline;
        paymentRecipient = _paymentRecipient;
        onlyOnePerWallet = true;

        // Set default royalty to 5%
        _setDefaultRoyalty(msg.sender, 500); // 500 = 5% (10000 = 100%)

        // Setting owner
        _transferOwnership(_owner);
    }

    /**
     * @inheritdoc IArkadaERC721Royalty
     */
    function mintNFT() external payable {
        require(block.timestamp <= mintDeadline, "Locked");
        require(msg.value == mintPrice, "Invalid price");

        if (onlyOnePerWallet) {
            require(!hasMinted[msg.sender], "Already minted");
        }

        totalMinted.increment();
        uint256 tokenId = totalMinted.current();

        hasMinted[msg.sender] = true;

        payable(paymentRecipient).transfer(msg.value);

        _safeMint(msg.sender, tokenId);

        emit NFTMinted(msg.sender, msg.sender, tokenId);
    }

    /**
     * @inheritdoc IArkadaERC721Royalty
     */
    function mintNFTTo(address to) external onlyOwnerOrOperator {
        totalMinted.increment();
        uint256 tokenId = totalMinted.current();

        hasMinted[to] = true;

        _safeMint(to, tokenId);

        emit NFTMinted(msg.sender, to, tokenId);
    }

    /**
     * @inheritdoc IArkadaERC721Royalty
     */
    function setMintPrice(uint256 _mintPrice) external onlyOwner {
        require(_mintPrice > 0, "Invalid price");

        mintPrice = _mintPrice;

        emit MintPriceUpdated(msg.sender, _mintPrice);
    }

    /**
     * @inheritdoc IArkadaERC721Royalty
     */
    function setMintDeadline(uint256 _mintDeadline) external onlyOwner {
        mintDeadline = _mintDeadline;

        emit MintDeadlineUpdated(msg.sender, _mintDeadline);
    }

    /**
     * @inheritdoc IArkadaERC721Royalty
     */
    function setPaymentRecipient(address _paymentRecipient) external onlyOwner {
        require(_paymentRecipient != address(0), "Invalid recipient");

        paymentRecipient = _paymentRecipient;

        emit PaymentRecipientUpdated(msg.sender, _paymentRecipient);
    }

    /**
     * @inheritdoc IArkadaERC721Royalty
     */
    function setOperator(address _operator) external onlyOwner {
        operator = _operator;

        emit OperatorUpdated(msg.sender, _operator);
    }

    /**
     * @inheritdoc IArkadaERC721Royalty
     */
    function setRoyalty(address receiver, uint96 feePercent)
        external
        onlyOwner
    {
        require(feePercent <= 1000, "Fee too high");
        require(receiver != address(0), "Invalid receiver");

        _setDefaultRoyalty(receiver, feePercent);

        emit RoyaltyUpdated(msg.sender, receiver, feePercent);
    }

    /**
     * @inheritdoc IArkadaERC721Royalty
     */
    function setOnePerWallet(bool enabled) external onlyOwner {
        require(enabled != onlyOnePerWallet, "Already in this state");

        onlyOnePerWallet = enabled;

        emit OnePerWalletUpdated(msg.sender, enabled);
    }

    /**
     * @inheritdoc IArkadaERC721Royalty
     */
    function setBaseURI(string memory baseURI_) external onlyOwner {
        _baseTokenURI = baseURI_;

        emit BaseURIUpdated(msg.sender, baseURI_);
    }

    /**
     * @notice Get base URI for all tokens
     * @dev function for marketplaces support
     * @return base token URI
     */
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @notice Get base URI by token id
     * @dev function for marketplaces support, depends on EIP-721
     * @param tokenId token id
     * @return token URI
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(
            _exists(tokenId),
            "ERC721Metadata: URI query for nonexistent token"
        );
        return
            string(
                abi.encodePacked(_baseURI(), "/", tokenId, "/metadata.json")
            );
    }

    /**
     * @dev check sender to be owner or operator
     */
    modifier onlyOwnerOrOperator() {
        require(
            msg.sender == owner() || msg.sender == operator,
            "Not authorized"
        );
        _;
    }
}
