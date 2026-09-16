// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.22;

interface IArkadaCompanyPassErrors {
    error ArkadaCompanyPass__MintingNotActive();
    error ArkadaCompanyPass__SignatureExpired();
    error ArkadaCompanyPass__InvalidPrice();
    error ArkadaCompanyPass__AlreadyMinted();
    error ArkadaCompanyPass__NonceAlreadyUsed();
    error ArkadaCompanyPass__IsNotSigner();
    error ArkadaCompanyPass__TransferFailed();
    error ArkadaCompanyPass__ZeroAddress();
    error ArkadaCompanyPass__NonTransferable();
    error ArkadaCompanyPass__ApprovalsDisabled();
}

interface IArkadaCompanyPassEvents {
    event PassMinted(
        address indexed to,
        uint256 indexed passId,
        uint256 price,
        uint256 nonce
    );
    event MintingSwitch(bool isActive);
    event UpdatedTreasury(address indexed caller, address indexed newTreasury);
    event PassURIUpdated(
        address indexed caller,
        uint256 indexed passId,
        string newUri
    );
}

interface IArkadaCompanyPass is
    IArkadaCompanyPassErrors,
    IArkadaCompanyPassEvents
{
    /// @notice Data signed by a SIGNER_ROLE key authorizing a single pass mint
    /// @param to Recipient of the pass, can differ from the transaction sender
    /// @param passId ERC1155 token id of the company pass
    /// @param price Mint price in native currency, must equal msg.value
    /// @param deadline Timestamp after which the signature is no longer valid
    /// @param nonce Unique nonce, can only be used once
    struct MintPassData {
        address to;
        uint256 passId;
        uint256 price;
        uint256 deadline;
        uint256 nonce;
    }

    /// @notice Mints a company pass authorized by an EIP712 signature
    /// @dev Signature must be produced by an address with SIGNER_ROLE.
    /// One pass per wallet per passId, passes are non-transferable.
    /// @param data The MintPassData containing details of the minting
    /// @param signature The EIP712 signature for verification
    function mintPass(MintPassData calldata data, bytes calldata signature)
        external
        payable;

    /// @notice Sets the minting active status
    /// @dev Allows the admin to pause/unpause all minting
    /// @param _isMintingActive The new minting active status
    function setIsMintingActive(bool _isMintingActive) external;

    /// @notice Sets the treasury address
    /// @dev Allows the admin to set the treasury address
    /// @param _treasury The new treasury address
    function setTreasury(address _treasury) external;

    /// @notice Sets the metadata URI for a pass id
    /// @dev Can only be called by an address with URI_SETTER_ROLE
    /// @param _passId The id of the pass
    /// @param _uri The new metadata URI
    function setPassURI(uint256 _passId, string calldata _uri) external;
}
