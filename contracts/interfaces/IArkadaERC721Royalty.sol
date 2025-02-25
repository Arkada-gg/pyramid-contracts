// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

/**
 * @title IArkadaERC721Royalty
 * @author Arkada
 */
interface IArkadaERC721Royalty {
    /**
     * @param caller function caller (msg.sender)
     * @param to address to mint
     * @param tokenId token id
     */
    event NFTMinted(
        address indexed caller,
        address indexed to,
        uint256 indexed tokenId
    );

    /**
     * @param caller function caller (msg.sender)
     * @param newDeadline mint deadline
     */
    event MintDeadlineUpdated(address indexed caller, uint256 newDeadline);

    /**
     * @param caller function caller (msg.sender)
     * @param newPrice price in ether
     */
    event MintPriceUpdated(address indexed caller, uint256 newPrice);

    /**
     * @param caller function caller (msg.sender)
     * @param newRecipient payment recipient
     */
    event PaymentRecipientUpdated(address indexed caller, address newRecipient);

    /**
     * @param caller function caller (msg.sender)
     * @param newOperator operator address
     */
    event OperatorUpdated(address indexed caller, address newOperator);

    /**
     * @param caller function caller (msg.sender)
     * @param newBaseURI base URI
     */
    event BaseURIUpdated(address indexed caller, string newBaseURI);

    /**
     * @param caller function caller (msg.sender)
     * @param receiver royalty receiver
     * @param feePercent fee percent (10000 = 100%)
     */
    event RoyaltyUpdated(
        address indexed caller,
        address receiver,
        uint96 feePercent
    );

    /**
     * @param caller function caller (msg.sender)
     * @param enabled is enabled
     */
    event OnePerWalletUpdated(address indexed caller, bool enabled);

    /**
     * @notice Mint for typical addresses
     * @dev payable
     */
    function mintNFT() external payable;

    /**
     * @notice Mint for someone
     * revert if caller is not owner or operator
     * @dev not payable
     */
    function mintNFTTo(address to) external;

    /**
     * @notice Set mint price in ether
     * revert if caller is not owner
     * @param _mintPrice new price in ether
     */
    function setMintPrice(uint256 _mintPrice) external;

    /**
     * @notice Set mint deadline
     * revert if caller is not owner
     * @param _mintDeadline new mint deadline timestamp
     */
    function setMintDeadline(uint256 _mintDeadline) external;

    /**
     * @notice Set payments recipient
     * revert if caller is not owner
     * @param _paymentRecipient new payments recipient address
     */
    function setPaymentRecipient(address _paymentRecipient) external;

    /**
     * @notice Set operator address
     * revert if caller is not owner
     * @param _operator new operator address
     */
    function setOperator(address _operator) external;

    /**
     * @notice Set royalty for address
     * revert if caller is not owner
     * revert if feePercent > 1000 (10%)
     * @param receiver royalty receiver address
     * @param feePercent fee percent example: 500 = 5% (10000 = 100%)
     */
    function setRoyalty(address receiver, uint96 feePercent) external;

    /**
     * @notice Set royalty for address
     * revert if caller is not owner
     * @param _baseURI new base URI for all tokens
     */
    function setBaseURI(string memory _baseURI) external;

    /**
     * @notice Enable or disable flag onlyOnePerWallet
     * revert if caller is not owner of same state tried to set
     * @param enabled is enabled
     */
    function setOnePerWallet(bool enabled) external;
}
