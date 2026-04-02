// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.22;

import {IArkadaMap} from "../../interfaces/IArkadaMap.sol";

interface IArkadaMapV2Errors {
    /// @notice Thrown when the recovered signer does not hold SIGNER_ROLE
    error ArkadaMap__InvalidSigner();

    /// @notice Thrown when the provided nonce has already been used
    error ArkadaMap__NonceAlreadyUsed();
}

interface IArkadaMapV2Events {
    /// @notice Emitted when a map piece is minted via EIP-712 signature
    /// @param to The address that received the token
    /// @param tokenId The token ID minted
    /// @param nonce The nonce consumed by this mint
    event SignatureMinted(
        address indexed to,
        uint256 indexed tokenId,
        uint256 indexed nonce
    );
}

interface IArkadaMapV2 is IArkadaMapV2Errors, IArkadaMapV2Events, IArkadaMap {
    // ================================ Structs ================================

    /// @notice Structured data signed by the backend for signature-based minting
    /// @param to The recipient address
    /// @param tokenId The token ID to mint (0-11)
    /// @param nonce Unique number to prevent signature replay
    struct MintData {
        address to;
        uint256 tokenId;
        uint256 nonce;
    }

    // ================================ Functions ================================

    /// @notice Mints a map piece using a backend-issued EIP-712 signature
    /// @param data The mint parameters signed by the backend
    /// @param signature The EIP-712 signature from an address holding SIGNER_ROLE
    function mintWithSignature(
        MintData calldata data,
        bytes calldata signature
    ) external;
}
