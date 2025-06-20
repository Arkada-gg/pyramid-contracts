// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.22;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {Escrow} from "./Escrow.sol";
import {PyramidEscrow} from "../PyramidEscrow.sol";
import {IEscrow} from "./interfaces/IEscrow.sol";
import {IFactory} from "./interfaces/IFactory.sol";

contract Factory is IFactory, Initializable, AccessControlUpgradeable {
    error Factory__OnlyCallableByPYRAMID();
    error Factory__PYRAMIDQuestIsActive();
    error Factory__NoQuestEscrowFound();
    error Factory__OnlyCallableByAdmin();
    error Factory__EscrowAlreadyExists();
    error Factory__ZeroAddress();

    PyramidEscrow public i_pyramid;
    mapping(bytes32 => address) public s_escrows;
    mapping(bytes32 => address) public s_escrow_admin;

    event EscrowRegistered(
        address indexed registror,
        address indexed escrowAddress,
        bytes32 indexed questId
    );
    event TokenPayout(
        address indexed receiver,
        address indexed tokenAddress,
        uint256 indexed tokenId,
        uint256 amount,
        uint8 tokenType,
        bytes32 questId
    );
    event EscrowWithdrawal(
        address indexed caller,
        address indexed receiver,
        address indexed tokenAddress,
        uint256 tokenId,
        uint256 amount,
        uint8 tokenType,
        bytes32 questId
    );
    event EscrowAdminUpdated(
        address indexed updater,
        bytes32 indexed questId,
        address indexed newAdmin
    );

    modifier onlyAdmin(bytes32 questId) {
        if (
            msg.sender != s_escrow_admin[questId] &&
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
        ) {
            revert Factory__OnlyCallableByAdmin();
        }
        _;
    }

    /// @notice Initializes the contract by setting up roles and linking to the Pyramid contract.
    /// @param admin Address to be granted the default admin role.
    /// @param pyramid Address of the Pyramid contract.
    function initialize(address admin, address pyramid) external initializer {
        if (admin == address(0)) revert Factory__ZeroAddress();
        __AccessControl_init();

        i_pyramid = PyramidEscrow(payable(pyramid));
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Updates the admin of a specific escrow.
    /// @dev Can only be called by the current escrow admin.
    /// @param questId Identifier of the quest associated with the escrow.
    /// @param newAdmin Address of the new admin.
    function updateEscrowAdmin(bytes32 questId, address newAdmin)
        external
        override
    {
        if (s_escrow_admin[questId] != msg.sender) {
            revert Factory__OnlyCallableByAdmin();
        }
        if (newAdmin == address(0)) {
            revert Factory__ZeroAddress();
        }
        s_escrow_admin[questId] = newAdmin;
        emit EscrowAdminUpdated(msg.sender, questId, newAdmin);
    }

    /// @notice Creates a new escrow for a quest.
    /// @dev Can only be called by an account with the default admin role.
    /// @param questId The quest the escrow should be created for.
    /// @param admin Admin of the new escrow.
    /// @param whitelistedTokens Array of addresses of tokens that are whitelisted for the escrow.
    /// @param treasury Address of the treasury where fees are sent.
    function createEscrow(
        bytes32 questId,
        address admin,
        address[] calldata whitelistedTokens,
        address treasury
    ) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (s_escrows[questId] != address(0)) {
            revert Factory__EscrowAlreadyExists();
        }

        s_escrow_admin[questId] = admin;
        address escrow = address(
            new Escrow{salt: questId}(
                address(this),
                whitelistedTokens,
                treasury
            )
        );
        s_escrows[questId] = escrow;

        emit EscrowRegistered(msg.sender, escrow, questId);
    }

    /// @notice Adds a token to the whitelist, allowing it to be used in the escrow.
    /// @param token The address of the token to whitelist.
    function addTokenToWhitelist(bytes32 questId, address token)
        external
        override
        onlyAdmin(questId)
    {
        address escrow = s_escrows[questId];
        if (escrow == address(0)) {
            revert Factory__NoQuestEscrowFound();
        }

        IEscrow(escrow).addTokenToWhitelist(token);
    }

    /// @notice Removes a token from the whitelist.
    /// @param token The address of the token to remove from the whitelist.
    function removeTokenFromWhitelist(bytes32 questId, address token)
        external
        override
        onlyAdmin(questId)
    {
        address escrow = s_escrows[questId];
        if (escrow == address(0)) {
            revert Factory__NoQuestEscrowFound();
        }

        IEscrow(escrow).removeTokenFromWhitelist(token);
    }

    /// @notice Withdraws funds from the escrow associated with a quest.
    /// @dev Withdrawal can only be initiated by the escrow admin or an account with the default admin role.
    /// @param questId The quest the escrow is mapped to.
    /// @param to Recipient of the funds.
    /// @param token Address of the token to withdraw.
    /// @param tokenId Identifier of the token (for ERC721 and ERC1155).
    /// @param tokenType Type of the token being withdrawn.
    function withdrawFunds(
        bytes32 questId,
        address to,
        address token,
        uint256 tokenId,
        TokenType tokenType
    ) external override onlyAdmin(questId) {
        address escrow = s_escrows[questId];
        if (escrow == address(0)) {
            revert Factory__NoQuestEscrowFound();
        }

        if (tokenType == TokenType.NATIVE) {
            uint256 escrowBalance = escrow.balance;
            IEscrow(escrow).withdrawNative(to, escrowBalance, 0);
            emit EscrowWithdrawal(
                msg.sender,
                to,
                address(0),
                0,
                escrowBalance,
                uint8(tokenType),
                questId
            );
        } else if (tokenType == TokenType.ERC20) {
            uint256 erc20Amount = IEscrow(escrow).escrowERC20Reserves(token);
            IEscrow(escrow).withdrawERC20(token, to, erc20Amount, 0);
            emit EscrowWithdrawal(
                msg.sender,
                to,
                token,
                0,
                erc20Amount,
                uint8(tokenType),
                questId
            );
        } else if (tokenType == TokenType.ERC721) {
            IEscrow(escrow).withdrawERC721(token, to, tokenId);
            emit EscrowWithdrawal(
                msg.sender,
                to,
                token,
                tokenId,
                1,
                uint8(tokenType),
                questId
            );
        } else if (tokenType == TokenType.ERC1155) {
            uint256 erc1155Amount = IEscrow(escrow).escrowERC1155Reserves(
                token,
                tokenId
            );
            IEscrow(escrow).withdrawERC1155(token, to, erc1155Amount, tokenId);
            emit EscrowWithdrawal(
                msg.sender,
                to,
                token,
                tokenId,
                erc1155Amount,
                uint8(tokenType),
                questId
            );
        }
    }

    /// @notice Distributes rewards for a quest.
    /// @dev Can only be called by the Pyramid contract.
    /// @param questId The quest the escrow is mapped to.
    /// @param token Address of the token for rewards.
    /// @param to Recipient of the rewards.
    /// @param amount Amount of tokens.
    /// @param rewardTokenId Token ID for ERC721 and ERC1155 rewards.
    /// @param tokenType Type of the token for rewards.
    /// @param rakeBps Basis points for the rake to be taken from the reward.
    function distributeRewards(
        bytes32 questId,
        address token,
        address to,
        uint256 amount,
        uint256 rewardTokenId,
        TokenType tokenType,
        uint256 rakeBps
    ) external override {
        if (msg.sender != address(i_pyramid)) {
            revert Factory__OnlyCallableByPYRAMID();
        }
        address escrow = s_escrows[questId];
        if (escrow == address(0)) {
            revert Factory__NoQuestEscrowFound();
        }

        if (tokenType == TokenType.NATIVE) {
            IEscrow(escrow).withdrawNative(to, amount, rakeBps);
            emit TokenPayout(
                to,
                address(0),
                0,
                amount,
                uint8(tokenType),
                questId
            );
        } else if (tokenType == TokenType.ERC20) {
            IEscrow(escrow).withdrawERC20(token, to, amount, rakeBps);
            emit TokenPayout(to, token, 0, amount, uint8(tokenType), questId);
        } else if (tokenType == TokenType.ERC721) {
            IEscrow(escrow).withdrawERC721(token, to, rewardTokenId);
            emit TokenPayout(
                to,
                token,
                rewardTokenId,
                1,
                uint8(tokenType),
                questId
            );
        } else if (tokenType == TokenType.ERC1155) {
            IEscrow(escrow).withdrawERC1155(token, to, amount, rewardTokenId);
            emit TokenPayout(
                to,
                token,
                rewardTokenId,
                amount,
                uint8(tokenType),
                questId
            );
        }
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
