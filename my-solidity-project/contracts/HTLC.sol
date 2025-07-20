// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HTLC {
    address public authorizedCaller;

    constructor(address _authorizedCaller) {
        require(_authorizedCaller != address(0), "Invalid authorized caller");
        authorizedCaller = _authorizedCaller;
    }

    modifier onlyAuthorized() {
        require(msg.sender == authorizedCaller, "Only authorized caller can execute");
        _;
    }

    event Locked(
        bytes32 indexed id,
        address indexed recipient,
        bytes32 secretHash,
        uint256 amount,
        uint256 timelock
    );

    event Received(address indexed from, uint256 amount);

    struct LockData {
        address recipient;
        bytes32 secretHash;
        uint256 amount;
        uint256 timelock;
    }

    mapping(bytes32 => bool) public isLocked;
    mapping(bytes32 => LockData) public lockData; // new mapping to store full data
    bytes32[] public allLockIds;

    function newLock(
        address recipient,
        bytes32 secretHash,
        uint256 timelock
    ) external payable onlyAuthorized {
        require(msg.value > 0, "No ETH sent");
        require(recipient != address(0), "Invalid recipient");
        require(timelock > block.timestamp, "Timelock must be in the future");

        bytes32 id = keccak256(abi.encodePacked(recipient, secretHash, msg.value, timelock));
        require(!isLocked[id], "Lock already exists");

        isLocked[id] = true;
        lockData[id] = LockData(recipient, secretHash, msg.value, timelock);
        allLockIds.push(id);

        emit Locked(id, recipient, secretHash, msg.value, timelock);
    }

    function getAllHTLCs() external view returns (LockData[] memory) {
        LockData[] memory result = new LockData[](allLockIds.length);
        for (uint i = 0; i < allLockIds.length; i++) {
            result[i] = lockData[allLockIds[i]];
        }
        return result;
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }
}
