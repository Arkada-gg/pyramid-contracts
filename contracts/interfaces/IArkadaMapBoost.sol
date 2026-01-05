// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.22;

interface IArkadaMapBoostErrors {
    error ArkadaMapBoost__InvalidPayment();
    error ArkadaMapBoost__AlreadyActivated();
    error ArkadaMapBoost__InvalidAmount();
    error ArkadaMapBoost__InvalidAddress();
    error ArkadaMapBoost__TransferFailed();
    error ArkadaMapBoost__MintingNotActive();
    error ArkadaMapBoost__CannotTransferActivated();
    error ArkadaMapBoost__NotOwner();
}

interface IArkadaMapBoostEvents {
    event MintPriceUpdated(
        address indexed caller,
        uint256 indexed newMintPrice
    );
    event MintingActiveUpdated(address indexed caller, bool indexed isActive);
    event Minted(address indexed caller, uint256 indexed tokenId);
    event TreasuryUpdated(address indexed caller, address indexed newTreasury);
    event BaseURIUpdated(address indexed caller, string indexed newBaseURI);
    event BoostActivated(address indexed caller, uint256 indexed tokenId);
}

interface IArkadaMapBoost is IArkadaMapBoostErrors, IArkadaMapBoostEvents {
    /// @notice Mints a new ArkadaMapBoost
    /// @dev Allows users to mint a new ArkadaMapBoost
    function mint() external payable;

    /// @notice Activates a Boost
    /// Token will be non-transferable after activation
    /// @dev Allows users to activate a Boost
    /// @dev Can only be called by the owner of the token
    /// @param _tokenId The ID of the token to activate
    function activate(uint256 _tokenId) external;

    /// @notice Sets the mint price
    /// @dev Allows the owner to set the mint price
    /// @param _mintPrice The new mint price
    function setMintPrice(uint256 _mintPrice) external;

    /// @notice Sets the minting active status
    /// @dev Allows the owner to set the minting active status
    /// @param _isMintingActive The new minting active status
    function setMintingActive(bool _isMintingActive) external;

    /// @notice Sets the treasury address
    /// @dev Allows the owner to set the treasury address
    /// @param _treasury The new treasury address
    function setTreasury(address _treasury) external;

    /// @notice Sets the base URI
    /// @dev Allows the owner to set the base URI
    /// @param _baseURI The new base URI
    function setBaseURI(string calldata _baseURI) external;
}
