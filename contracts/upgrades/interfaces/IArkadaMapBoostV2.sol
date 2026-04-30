// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.22;

import "../../interfaces/IArkadaMapBoost.sol";

interface IArkadaMapBoostV2 is IArkadaMapBoost {
    /// @notice Mints a boost token to an arbitrary address without payment
    /// @dev Can only be called by the contract owner
    /// @param to The address to mint the boost to
    function adminMint(address to) external;
}
