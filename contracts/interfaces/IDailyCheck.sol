// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

/**
 * @notice check scruct
 * @param streak streak of daily checks
 * @param timestamp timespamp
 */
struct CheckData {
    uint256 streak;
    uint256 timestamp;
}

/**
 * @title IDailyCheck
 * @author Arkada
 */
interface IDailyCheck {
    /**
     * @param caller function caller (msg.sender)
     * @param streak streak of daily checks
     * @param timestamp timespamp
     */
    event DailyCheck(address indexed caller, uint256 streak, uint256 timestamp);

    /**
     * @notice daily checking process
     * reverted if already executed today by address
     */
    function check() external;
}
