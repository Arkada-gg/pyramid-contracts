// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

interface ITokenType {
    enum TokenType {
        ERC20,
        ERC721,
        ERC1155,
        NATIVE
    }
}
