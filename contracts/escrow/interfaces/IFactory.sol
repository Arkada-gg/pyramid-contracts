// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import {ITokenType} from "./ITokenType.sol";

interface IFactory is ITokenType {
    function distributeRewards(
        bytes32 questId,
        address token,
        address to,
        uint256 amount,
        uint256 rewardTokenId,
        TokenType tokenType,
        uint256 rakeBps
    ) external;

    function withdrawFunds(
        bytes32 questId,
        address to,
        address token,
        uint256 tokenId,
        TokenType tokenType
    ) external;

    function createEscrow(
        bytes32 questId,
        address admin,
        address[] memory whitelistedTokens,
        address treasury
    ) external;

    function updateEscrowAdmin(bytes32 questId, address newAdmin) external;

    function addTokenToWhitelist(bytes32 questId, address token) external;

    function removeTokenFromWhitelist(bytes32 questId, address token) external;
}
