// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.22;

import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC1155Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {ERC1155SupplyUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IArkadaCompanyPass} from "./interfaces/IArkadaCompanyPass.sol";

/// @title ArkadaCompanyPass
/// @dev Non-transferable ERC1155 company pass. Each token id represents a pass
/// for a company/event group. Mints are authorized off-chain via EIP712
/// signatures (SIGNER_ROLE), price is defined per-signature. Max 1 pass of
/// each id per wallet.
/// The contract is upgradeable using OpenZeppelin's TransparentUpgradeableProxy pattern.
contract ArkadaCompanyPass is
    Initializable,
    ERC1155SupplyUpgradeable,
    AccessControlUpgradeable,
    EIP712Upgradeable,
    ReentrancyGuardUpgradeable,
    IArkadaCompanyPass
{
    using ECDSA for bytes32;

    // ================================ State Variables ================================

    string public name;
    string public symbol;

    bool public s_isMintingActive;
    address public s_treasury;

    mapping(uint256 => bool) internal s_nonces;
    mapping(uint256 => string) internal s_passURIs;

    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER");
    bytes32 public constant URI_SETTER_ROLE = keccak256("URI_SETTER");

    bytes32 internal constant MINT_PASS_DATA_HASH =
        keccak256(
            "MintPassData(address to,uint256 passId,uint256 price,uint256 deadline,uint256 nonce)"
        );

    /**
     * @dev leaving a storage gap for futures updates
     */
    uint256[50] private __gap;

    // ================================ Constructor ================================

    /// @notice Returns the version of the ArkadaCompanyPass smart contract
    function companyPassVersion() external pure returns (string memory) {
        return "1";
    }

    /// @notice Initializes the ArkadaCompanyPass contract
    /// @dev Sets up the ERC1155 token and grants initial roles.
    /// @param _name The name of the collection
    /// @param _symbol The symbol of the collection
    /// @param _signingDomain Domain used for EIP712 signing
    /// @param _signatureVersion Version of the EIP712 signature
    /// @param _admin Address to be granted the admin role
    /// @param _treasury The address of the treasury
    function initialize(
        string memory _name,
        string memory _symbol,
        string memory _signingDomain,
        string memory _signatureVersion,
        address _admin,
        address _treasury
    ) external initializer {
        if (_admin == address(0)) revert ArkadaCompanyPass__ZeroAddress();
        if (_treasury == address(0)) revert ArkadaCompanyPass__ZeroAddress();

        __ERC1155_init("");
        __ERC1155Supply_init();
        __EIP712_init(_signingDomain, _signatureVersion);
        __AccessControl_init();
        __ReentrancyGuard_init();

        name = _name;
        symbol = _symbol;
        s_isMintingActive = true;
        s_treasury = _treasury;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    }

    // ================================ Public Functions ================================

    /**
     * @inheritdoc IArkadaCompanyPass
     */
    function mintPass(MintPassData calldata data, bytes calldata signature)
        external
        payable
        nonReentrant
    {
        if (!s_isMintingActive) revert ArkadaCompanyPass__MintingNotActive();
        if (block.timestamp > data.deadline)
            revert ArkadaCompanyPass__SignatureExpired();
        if (msg.value != data.price) revert ArkadaCompanyPass__InvalidPrice();
        if (balanceOf(data.to, data.passId) != 0)
            revert ArkadaCompanyPass__AlreadyMinted();

        _validateSignature(data, signature);

        _mint(data.to, data.passId, 1, "");

        (bool success, ) = payable(s_treasury).call{value: msg.value}("");
        if (!success) revert ArkadaCompanyPass__TransferFailed();

        emit PassMinted(data.to, data.passId, data.price, data.nonce);
    }

    /// @notice Retrieves the URI for a given pass id
    /// @dev Overrides the ERC1155Upgradeable's uri method.
    /// URI is set per passId by an address with URI_SETTER_ROLE.
    /// @param _id The id of the pass
    /// @return The URI of the specified pass
    function uri(uint256 _id) public view override returns (string memory) {
        return s_passURIs[_id];
    }

    /// @notice Approvals are disabled since passes are non-transferable
    function setApprovalForAll(address, bool) public pure override {
        revert ArkadaCompanyPass__ApprovalsDisabled();
    }

    // ================================ Admin Functions ================================

    /**
     * @inheritdoc IArkadaCompanyPass
     */
    function setIsMintingActive(bool _isMintingActive)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        s_isMintingActive = _isMintingActive;
        emit MintingSwitch(_isMintingActive);
    }

    /**
     * @inheritdoc IArkadaCompanyPass
     */
    function setTreasury(address _treasury)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (_treasury == address(0)) revert ArkadaCompanyPass__ZeroAddress();
        s_treasury = _treasury;
        emit UpdatedTreasury(msg.sender, _treasury);
    }

    /**
     * @inheritdoc IArkadaCompanyPass
     */
    function setPassURI(uint256 _passId, string calldata _uri)
        external
        onlyRole(URI_SETTER_ROLE)
    {
        s_passURIs[_passId] = _uri;
        emit URI(_uri, _passId);
        emit PassURIUpdated(msg.sender, _passId, _uri);
    }

    // ================================ Internal Functions ================================

    /// @notice Validates the signature for a pass minting request
    /// @dev Ensures that the signature is from a valid signer and the nonce hasn't been used before
    /// @param data The MintPassData struct containing minting details
    /// @param signature The signature to be validated
    function _validateSignature(
        MintPassData calldata data,
        bytes calldata signature
    ) internal {
        address signer = _computeDigest(data).recover(signature);

        if (!hasRole(SIGNER_ROLE, signer)) {
            revert ArkadaCompanyPass__IsNotSigner();
        }
        if (s_nonces[data.nonce]) {
            revert ArkadaCompanyPass__NonceAlreadyUsed();
        }
        s_nonces[data.nonce] = true;
    }

    /// @notice Internal function to compute the EIP712 digest for MintPassData
    /// @dev Generates the digest that must be signed by the signer.
    /// @param data The MintPassData to generate a digest for
    /// @return The computed EIP712 digest
    function _computeDigest(MintPassData calldata data)
        internal
        view
        returns (bytes32)
    {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        MINT_PASS_DATA_HASH,
                        data.to,
                        data.passId,
                        data.price,
                        data.deadline,
                        data.nonce
                    )
                )
            );
    }

    /// @dev Blocks any transfer except minting, passes are soulbound.
    /// Burning is intentionally disabled as well.
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override {
        if (from != address(0)) revert ArkadaCompanyPass__NonTransferable();
        super._update(from, to, ids, values);
    }

    /// @notice Checks if the contract implements an interface
    /// @dev Overrides the supportsInterface function of ERC1155Upgradeable and AccessControlUpgradeable.
    /// @param interfaceId The interface identifier, as specified in ERC-165
    /// @return True if the contract implements the interface, false otherwise
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
