// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./interfaces/IDailyCheck.sol";

/**
 * @title DailyCheck
 * @notice Smart contract for daily check streaks
 * @author Arkada
 */
contract DailyCheck is Initializable, IDailyCheck {
    /**
     * @dev address => check data
     */
    mapping(address => CheckData) public checkDatas;

    /**
     * @dev leaving a storage gap for futures updates
     */
    uint256[50] private __gap;

    /**
     * @notice upgradeable pattern contract`s initializer
     */
    function initialize() external initializer {}

    /**
     * @inheritdoc IDailyCheck
     */
    function check() external {
        CheckData memory checkData = checkDatas[msg.sender];

        uint256 currentDay = getDaysCountByTs(block.timestamp);
        uint256 lastCheckDay = getDaysCountByTs(checkData.timestamp);

        require(currentDay > lastCheckDay, "checked today");

        checkData.streak = currentDay - lastCheckDay == 1 ? checkData.streak + 1 : 1;
        checkData.timestamp = block.timestamp;

        checkDatas[msg.sender] = checkData;

        emit DailyCheck(
            msg.sender,
            checkData.streak,
            block.timestamp
        );
    }

    /**
     * @dev calculates day number from 1970 depends on timestamp
     * @param _timespamp timestamp
     *
     * @return day number from 1970
     */
    function getDaysCountByTs(uint256 _timespamp) public pure returns(uint256) {
        return _timespamp / 1 days;
    }
}
