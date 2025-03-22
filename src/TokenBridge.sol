// src/TokenBridge.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TokenBridge is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Events
    event TokenAdded(address token);
    event Deposit(
        address indexed token,
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 nonce
    );
    event Distribution(
        address indexed token,
        address indexed to,
        uint256 amount,
        uint256 nonce
    );

    // State variables
    uint256 private _nonce;
    mapping(address => bool) private _supportedTokens;
    mapping(uint256 => bool) private _processedDeposits;
    bool private _paused;

    // Modifiers
    modifier whenNotPaused() {
        require(!_paused, "Bridge: paused");
        _;
    }

    modifier onlyDistributor() {
        require(msg.sender == owner(), "Bridge: not distributor");
        _;
    }

    constructor() Ownable(msg.sender) {
        _nonce = 0;
        _paused = false;
    }

    /**
     * @dev Adds a token to the supported tokens list
     * @param token The token address to add
     */
    function addSupportedToken(address token) external onlyOwner {
        _supportedTokens[token] = true;
        emit TokenAdded(token);
    }

    /**
     * @dev Removes a token from the supported tokens list
     * @param token The token address to remove
     */
    function removeSupportedToken(address token) external onlyOwner {
        _supportedTokens[token] = false;
    }

    /**
     * @dev Pauses the bridge
     */
    function pause() external onlyOwner {
        _paused = true;
    }

    /**
     * @dev Unpauses the bridge
     */
    function unpause() external onlyOwner {
        _paused = false;
    }

    /**
     * @dev Deposits tokens to the bridge
     * @param token The token address
     * @param amount The amount to deposit
     * @param recipient The address that will receive tokens on the other chain
     */
    function deposit(
        address token,
        uint256 amount,
        address recipient
    ) external nonReentrant whenNotPaused {
        require(_supportedTokens[token], "Bridge: token not supported");
        require(amount > 0, "Bridge: amount must be greater than 0");
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        uint256 currentNonce = _nonce++;
        emit Deposit(token, msg.sender, recipient, amount, currentNonce);
    }

    /**
     * @dev Distributes tokens from the bridge to a recipient
     * @param token The token address
     * @param recipient The recipient address
     * @param amount The amount to distribute
     * @param depositNonce The nonce of the corresponding deposit
     */
    function distribute(
        address token,
        address recipient,
        uint256 amount,
        uint256 depositNonce
    ) external nonReentrant whenNotPaused onlyDistributor {
        require(_supportedTokens[token], "Bridge: token not supported");
        require(!_processedDeposits[depositNonce], "Bridge: deposit already processed");
        
        _processedDeposits[depositNonce] = true;
        IERC20(token).safeTransfer(recipient, amount);
        
        emit Distribution(token, recipient, amount, depositNonce);
    }

    /**
     * @dev Withdraws tokens in case of emergency
     * @param token The token address
     * @param amount The amount to withdraw
     */
    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @dev Checks if a token is supported by the bridge
     * @param token The token address
     * @return bool True if the token is supported, false otherwise
     */
    function isSupportedToken(address token) external view returns (bool) {
        return _supportedTokens[token];
    }
}
