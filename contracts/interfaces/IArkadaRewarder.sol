// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

/**
 * @title IArkadaRewarder
 * @author Arkada
 */
interface IArkadaRewarder {
    error ArkadaRewarder__InvalidAddress();
    error ArkadaRewarder__InvalidAmount();
    error ArkadaRewarder__ArrayLengthMismatch();
    error ArkadaRewarder__NoRewardsToClaim();
    error ArkadaRewarder__TransferFailed();
    error ArkadaRewarder__NoBalanceToWithdraw();
    error ArkadaRewarder__NotAuthorized();

    /// @notice Event emitted when rewards are set for a user
    /// @param caller Address of the caller
    /// @param user Address of the user
    /// @param amount Amount of rewards in wei
    event RewardsSet(
        address indexed caller,
        address indexed user,
        uint256 amount
    );

    /// @notice Event emitted when rewards are added for a user
    /// @param caller Address of the caller
    /// @param user Address of the user
    /// @param amount Amount of rewards in wei
    event RewardsAdded(
        address indexed caller,
        address indexed user,
        uint256 amount
    );

    /// @notice Event emitted when rewards are claimed by a user
    /// @param user Address of the user
    /// @param amount Amount of rewards in wei
    event RewardsClaimed(address indexed user, uint256 amount);

    /// @notice Event emitted when operator is updated
    /// @param oldOperator Address of the old operator
    /// @param newOperator Address of the new operator
    event OperatorUpdated(
        address indexed oldOperator,
        address indexed newOperator
    );

    /**
     * @notice Sets rewards for multiple users
     * @param users Array of user addresses
     * @param amounts Array of reward amounts in wei
     */
    function setRewards(address[] calldata users, uint256[] calldata amounts)
        external;

    /**
     * @notice Claims rewards for the caller
     */
    function claimReward() external;

    /**
     * @notice Withdraws the contract's balance to the message sender
     */
    function withdraw() external;

    /**
     * @notice Adds rewards for a user
     * @param user Address of the user
     * @param amount Amount of rewards in wei
     */
    function addRewards(address user, uint256 amount) external;
}
