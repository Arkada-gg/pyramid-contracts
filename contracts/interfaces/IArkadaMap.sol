// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.22;

interface IArkadaMapErrors {
    error ArkadaMap__InvalidAddress();
    error ArkadaMap__InvalidTokenId();
    error ArkadaMap__NotMinter();
    error ArkadaMap__TransferNotAllowed();
    error ArkadaMap__CannotReceiveFromNonWhitelist();
    error ArkadaMap__TokenIdOutOfRange();
}

interface IArkadaMapEvents {
    event PieceMinted(
        address indexed to,
        uint256 indexed tokenId,
        uint256 amount
    );
    event WhitelistUpdated(address indexed account, bool indexed isWhitelisted);
    event TokenURIUpdated(
        address indexed caller,
        uint256 indexed tokenId,
        string indexed newURI
    );
}

interface IArkadaMap is IArkadaMapErrors, IArkadaMapEvents {
    /// @notice Mints a map piece
    /// @dev Can only be called by addresses with MINTER_ROLE
    /// @param to The address to mint to
    /// @param tokenId The token ID (0-11)
    /// @param amount The amount to mint
    function mint(address to, uint256 tokenId, uint256 amount) external;

    /// @notice Sets the URI for a specific token
    /// @dev Can only be called by admin
    /// @param tokenId The token ID (0-11)
    /// @param tokenURI The new URI for the token
    function setTokenURI(uint256 tokenId, string calldata tokenURI) external;

    /// @notice Adds or removes an address from the whitelist
    /// @dev Can only be called by admin
    /// @param account The address to update
    /// @param isWhitelisted Whether the address should be whitelisted
    function setWhitelist(address account, bool isWhitelisted) external;
}
