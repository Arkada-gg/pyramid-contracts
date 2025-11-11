// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.22;

import {IPyramidEscrowBase} from "./IPyramidEscrowBase.sol";

/// @title IPyramidEscrowMulti
/// @dev Interface of the PyramidEscrow contract.
interface IPyramidEscrowMulti is IPyramidEscrowBase {
    /// @notice Emitted when a Pyramid is claimed for a multi quest
    /// @param questId The quest ID associated with the Pyramid
    /// @param tokenId The token ID of the minted Pyramid
    /// @param claimer Address of the Pyramid claimer
    /// @param price The price paid for the Pyramid
    /// @param rewards The rewards paid for the Pyramid
    /// @param issueNumber The issue number of the Pyramid
    /// @param walletProvider The name of the wallet provider used for claiming
    /// @param embedOrigin The origin of the embed associated with the Pyramid
    /// @param nonce The nonce of the Pyramid
    event PyramidClaimMulti(
        string questId,
        uint256 indexed tokenId,
        address indexed claimer,
        uint256 price,
        uint256 rewards,
        uint256 issueNumber,
        string walletProvider,
        string embedOrigin,
        uint256 nonce
    );
}
