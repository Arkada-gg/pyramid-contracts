// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "./interfaces/IArkadaRewarder.sol";

/**
 * @title ArkadaRewarder
 * @notice Smart contract for paying rewards to Arkada users
 * @author Arkada
 */
contract ArkadaRewarder is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    IArkadaRewarder
{
    /// @notice Operator role that can set rewards
    address public operator;

    /// @notice Mapping of user addresses to their pending rewards in wei
    mapping(address => uint256) public userRewards;

    /**
     * @dev Modifier to restrict access to owner or operator
     */
    modifier onlyOperatorOrOwner() {
        require(
            msg.sender == owner() || msg.sender == operator,
            "Not authorized"
        );
        _;
    }

    /**
     * @dev leaving a storage gap for futures updates
     */
    uint256[50] private __gap;

    /**
     * @notice Initializes the contract
     * @param _operator Address of the operator
     */
    function initialize(address _operator) external initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        operator = _operator;
        emit OperatorUpdated(address(0), _operator);
    }

    /**
     * @inheritdoc IArkadaRewarder
     */
    function setRewards(address[] calldata users, uint256[] calldata amounts)
        external
        onlyOperatorOrOwner
    {
        require(users.length == amounts.length, "arrays length mismatch");

        for (uint256 i = 0; i < users.length; i++) {
            require(users[i] != address(0), "zero address");
            userRewards[users[i]] = amounts[i];
            emit RewardsSet(msg.sender, users[i], amounts[i]);
        }
    }

    /**
     * @inheritdoc IArkadaRewarder
     */
    function claimReward() external nonReentrant {
        uint256 reward = userRewards[msg.sender];
        require(reward > 0, "no rewards to claim");

        userRewards[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: reward}("");
        require(success, "transfer failed");

        emit RewardsClaimed(msg.sender, reward);
    }

    /**
     * @inheritdoc IArkadaRewarder
     */
    function setOperator(address newOperator) external onlyOwner {
        require(newOperator != address(0), "zero address");
        address oldOperator = operator;
        operator = newOperator;
        emit OperatorUpdated(oldOperator, newOperator);
    }

    /**
     * @notice Allows the contract to receive ETH
     */
    receive() external payable {}
}
