// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.22;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IArkadaRewarder} from "./interfaces/IArkadaRewarder.sol";
/**
 * @title ArkadaRewarder
 * @notice Smart contract for paying rewards to Arkada users
 * @author Arkada
 */
contract ArkadaRewarder is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    IArkadaRewarder
{
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @notice Mapping of user addresses to their pending rewards in wei
    mapping(address => uint256) public userRewards;

    /**
     * @dev Modifier to restrict access to owner or operator
     */
    modifier onlyOperatorOrOwner() {
        if (
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender) &&
            !hasRole(OPERATOR_ROLE, msg.sender)
        ) revert ArkadaRewarder__NotAuthorized();
        _;
    }

    /// @notice Initializes the ArkadaRewarder contract with necessary parameters
    /// @param _admin Address to be granted the admin roles
    function initialize(address _admin) external initializer {
        if (_admin == address(0)) revert ArkadaRewarder__InvalidAddress();
        __AccessControl_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    }

    /**
     * @inheritdoc IArkadaRewarder
     */
    function setRewards(
        address[] calldata users,
        uint256[] calldata amounts
    ) external onlyOperatorOrOwner {
        if (users.length != amounts.length)
            revert ArkadaRewarder__ArrayLengthMismatch();

        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] == address(0)) revert ArkadaRewarder__InvalidAddress();
            userRewards[users[i]] = amounts[i];
            emit RewardsSet(msg.sender, users[i], amounts[i]);
        }
    }

    /**
     * @inheritdoc IArkadaRewarder
     */
    function addRewards(
        address user,
        uint256 amount
    ) external onlyOperatorOrOwner {
        if (user == address(0)) revert ArkadaRewarder__InvalidAddress();
        if (amount == 0) revert ArkadaRewarder__InvalidAmount();

        userRewards[user] += amount;

        emit RewardsAdded(msg.sender, user, amount);
    }

    /**
     * @inheritdoc IArkadaRewarder
     */
    function claimReward() external nonReentrant {
        uint256 reward = userRewards[msg.sender];
        if (reward == 0) revert ArkadaRewarder__NoRewardsToClaim();

        userRewards[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: reward}("");
        if (!success) revert ArkadaRewarder__TransferFailed();

        emit RewardsClaimed(msg.sender, reward);
    }

    /**
     * @inheritdoc IArkadaRewarder
     */
    function withdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        if (balance == 0) revert ArkadaRewarder__NoBalanceToWithdraw();
        (bool success, ) = msg.sender.call{value: balance}("");
        if (!success) revert ArkadaRewarder__TransferFailed();
    }

    receive() external payable {}
}
