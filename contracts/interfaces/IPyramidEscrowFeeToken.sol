// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.22;

import {IPyramidEscrowBaseFeeToken} from "./IPyramidEscrowBaseFeeToken.sol";

/// @title IPyramidEscrowFeeToken
/// @dev Interface of the PyramidEscrow contract.
interface IPyramidEscrowFeeToken is IPyramidEscrowBaseFeeToken {
    error Pyramid__MintedForQuestId();

    /// @notice Emitted when a Pyramid is claimed
    /// @param questId The quest ID associated with the Pyramid
    /// @param tokenId The token ID of the minted Pyramid
    /// @param claimer Address of the Pyramid claimer
    /// @param price The price paid for the Pyramid
    /// @param rewards The rewards paid for the Pyramid
    /// @param issueNumber The issue number of the Pyramid
    /// @param walletProvider The name of the wallet provider used for claiming
    /// @param embedOrigin The origin of the embed associated with the Pyramid
    event PyramidClaim(
        string questId,
        uint256 indexed tokenId,
        address indexed claimer,
        uint256 price,
        uint256 rewards,
        uint256 issueNumber,
        string walletProvider,
        string embedOrigin
    );
}
