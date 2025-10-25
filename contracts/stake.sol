// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PredictionStake is Pausable, Ownable {
    
    uint256 public totalStaked;
    
    struct StakeAccount {
        address staker;
        uint256 amount;
        uint256 timestamp;
    }
    
    mapping(address => StakeAccount) public stakes;
    mapping(address => bool) public blocklist;
    
    event TreasuryInitialized(address indexed owner, uint256 timestamp);
    event StakeEvent(address indexed user, uint256 amount, uint256 totalAmount, uint256 timestamp);
    event ContractBalance(uint256 balance, uint256 totalStaked, uint256 timestamp);
    event AddressBlocklisted(address indexed blockedAddress, uint256 timestamp);
    event AddressUnblocklisted(address indexed unblockedAddress, uint256 timestamp);
    
    error InvalidAmount();
    error ArithmeticOverflow();
    error TransferFailed();
    error Blocklisted();
    
    modifier notBlocklisted(address user) {
        if (blocklist[user]) revert Blocklisted();
        _;
    }
    
    // Initialize treasury
    constructor() Ownable(msg.sender) {
        emit TreasuryInitialized(msg.sender, block.timestamp);
    }
    
    // Stake ETH into contract
    function stake() external payable whenNotPaused notBlocklisted(msg.sender) {
        if (msg.value == 0) revert InvalidAmount();
        
        StakeAccount storage userStake = stakes[msg.sender];
        
        if (userStake.staker == address(0)) {
            userStake.staker = msg.sender;
            userStake.amount = msg.value;
            userStake.timestamp = block.timestamp;
        } else {
            uint256 newAmount = userStake.amount + msg.value;
            if (newAmount < userStake.amount) revert ArithmeticOverflow();
            
            userStake.amount = newAmount;
            userStake.timestamp = block.timestamp;
        }
        
        uint256 newTotal = totalStaked + msg.value;
        if (newTotal < totalStaked) revert ArithmeticOverflow();
        totalStaked = newTotal;
        
        emit StakeEvent(msg.sender, msg.value, userStake.amount, block.timestamp);
    }
    
    // Get contract ETH balance
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    // Emit contract balance event
    function fetchContractBalance() external {
        emit ContractBalance(address(this).balance, totalStaked, block.timestamp);
    }
    
    // Get user stake info
    function getStakeAccount(address user) external view returns (address staker, uint256 amount, uint256 timestamp) {
        StakeAccount memory userStake = stakes[user];
        return (userStake.staker, userStake.amount, userStake.timestamp);
    }
    
    // Check if user has stake
    function hasStake(address user) external view returns (bool) {
        return stakes[user].staker != address(0);
    }
    
    // Pause contract
    function pause() external onlyOwner {
        _pause();
    }
    
    // Unpause contract
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // Add address to blocklist
    function addToBlocklist(address user) external onlyOwner {
        blocklist[user] = true;
        emit AddressBlocklisted(user, block.timestamp);
    }
    
    // Remove address from blocklist
    function removeFromBlocklist(address user) external onlyOwner {
        blocklist[user] = false;
        emit AddressUnblocklisted(user, block.timestamp);
    }
    
    // Check if address is blocklisted
    function isBlocklisted(address user) external view returns (bool) {
        return blocklist[user];
    }
    
    // Accept direct ETH transfers as stakes
    receive() external payable whenNotPaused notBlocklisted(msg.sender) {
        if (msg.value == 0) revert InvalidAmount();
        
        StakeAccount storage userStake = stakes[msg.sender];
        
        if (userStake.staker == address(0)) {
            userStake.staker = msg.sender;
            userStake.amount = msg.value;
            userStake.timestamp = block.timestamp;
        } else {
            uint256 newAmount = userStake.amount + msg.value;
            if (newAmount < userStake.amount) revert ArithmeticOverflow();
            
            userStake.amount = newAmount;
            userStake.timestamp = block.timestamp;
        }
        
        uint256 newTotal = totalStaked + msg.value;
        if (newTotal < totalStaked) revert ArithmeticOverflow();
        totalStaked = newTotal;
        
        emit StakeEvent(msg.sender, msg.value, userStake.amount, block.timestamp);
    }
}