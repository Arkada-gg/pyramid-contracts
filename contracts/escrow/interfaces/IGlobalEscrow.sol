// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import {ITokenType} from "./ITokenType.sol";

interface IGlobalEscrow is ITokenType {
    /// @notice Distributes rewards for a quest.
    /// @dev Can only be called by the distributor role.
    /// @param token Address of the token for rewards.
    /// @param to Recipient of the rewards.
    /// @param amount Amount of tokens.
    /// @param rewardTokenId Token ID for ERC721 and ERC1155 rewards.
    /// @param tokenType Type of the token for rewards.
    /// @param rakeBps Basis points for the rake to be taken from the reward.
    function distributeRewards(
        address token,
        address to,
        uint256 amount,
        uint256 rewardTokenId,
        TokenType tokenType,
        uint256 rakeBps
    ) external;

    /// @notice Withdraws funds from the escrow associated with a quest.
    /// @dev Withdrawal can only be initiated by the escrow withdrawer role.
    /// @param to Recipient of the funds.
    /// @param token Address of the token to withdraw.
    /// @param tokenId Identifier of the token (for ERC721 and ERC1155).
    /// @param tokenType Type of the token being withdrawn.
    function withdrawFunds(
        address to,
        address token,
        uint256 tokenId,
        TokenType tokenType
    ) external;

    function addTokenToWhitelist(address token) external;

    function removeTokenFromWhitelist(address token) external;
}
