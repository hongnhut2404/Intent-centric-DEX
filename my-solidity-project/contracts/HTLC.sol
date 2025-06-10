// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HTLC {
    struct Lock {
        address sender;
        address recipient;
        uint256 amount;
        bytes32 hashlock;
        uint256 timelock;
        bool withdrawn;
        bool refunded;
    }

    mapping(bytes32 => Lock) public locks;

    event Locked(
        bytes32 indexed id,
        address sender,
        address recipient,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock
    );
    event Withdrawn(bytes32 indexed id);
    event Refunded(bytes32 indexed id);

    // Create a new lock
    function newLock(
        address _recipient,
        bytes32 _hashlock,
        uint256 _timelock
    ) external payable returns (bytes32) {
        require(msg.value > 0, "Must send ETH");
        require(_timelock > block.timestamp, "Timelock must be in the future");
        require(_recipient != address(0), "Invalid recipient");

        bytes32 id = keccak256(
            abi.encodePacked(
                msg.sender,
                _recipient,
                msg.value,
                _hashlock,
                _timelock
            )
        );

        require(locks[id].amount == 0, "Lock ID already exists");

        locks[id] = Lock({
            sender: msg.sender,
            recipient: _recipient,
            amount: msg.value,
            hashlock: _hashlock,
            timelock: _timelock,
            withdrawn: false,
            refunded: false
        });

        emit Locked(id, msg.sender, _recipient, msg.value, _hashlock, _timelock);
        return id;
    }

    // Withdraw funds with the correct secret
    function withdraw(bytes32 _id, string memory _secret) external {
        Lock storage lock = locks[_id];
        require(lock.amount > 0, "Lock does not exist");
        require(!lock.withdrawn, "Already withdrawn");
        require(!lock.refunded, "Already refunded");
        require(lock.recipient == msg.sender, "Not the recipient");
        require(lock.hashlock == keccak256(abi.encodePacked(_secret)), "Invalid secret");
        require(block.timestamp < lock.timelock, "Timelock expired");

        lock.withdrawn = true;
        uint256 amount = lock.amount;
        lock.amount = 0;

        (bool success, ) = lock.recipient.call{value: amount}("");
        require(success, "Transfer failed");

        emit Withdrawn(_id);
    }

    // Refund funds to sender after timelock expires
    function refund(bytes32 _id) external {
        Lock storage lock = locks[_id];
        require(lock.amount > 0, "Lock does not exist");
        require(!lock.withdrawn, "Already withdrawn");
        require(!lock.refunded, "Already refunded");
        require(lock.sender == msg.sender, "Not the sender");
        require(block.timestamp >= lock.timelock, "Timelock not expired");

        lock.refunded = true;
        uint256 amount = lock.amount;
        lock.amount = 0;

        (bool success, ) = lock.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit Refunded(_id);
    }

    // View lock details
    function getLock(bytes32 _id)
        external
        view
        returns (
            address sender,
            address recipient,
            uint256 amount,
            bytes32 hashlock,
            uint256 timelock,
            bool withdrawn,
            bool refunded
        )
    {
        Lock memory lock = locks[_id];
        return (
            lock.sender,
            lock.recipient,
            lock.amount,
            lock.hashlock,
            lock.timelock,
            lock.withdrawn,
            lock.refunded
        );
    }
}