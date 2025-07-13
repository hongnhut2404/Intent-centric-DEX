// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MultisigWallet {
    address[] public owners;
    mapping(address => bool) public isOwner;
    uint public txCounter;

    struct Transaction {
        address target;
        uint value;
        bytes payload;
        bool executed;
        mapping(address => bool) confirmations;
        uint confirmationCount;
    }

    mapping(uint => Transaction) public transactions;

    event TransactionSubmitted(
        uint indexed txID,
        address indexed target,
        uint value,
        bytes payload
    );
    event TransactionConfirmed(address indexed owner, uint indexed txID);
    event TransactionExecuted(uint indexed txID);

    modifier onlyOwner() {
        require(isOwner[msg.sender], "Not an owner");
        _;
    }

    modifier txExists(uint _txID) {
        require(_txID < txCounter, "Transaction does not exist");
        _;
    }

    modifier notExecuted(uint _txID) {
        require(!transactions[_txID].executed, "Transaction already executed");
        _;
    }

    modifier notConfirmed(uint _txID) {
        require(
            !transactions[_txID].confirmations[msg.sender],
            "Already confirmed"
        );
        _;
    }

    constructor(address[] memory _owners) {
        require(_owners.length > 0, "Owners required");
        for (uint i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "Invalid owner");
            require(!isOwner[owner], "Owner not unique");

            isOwner[owner] = true;
            owners.push(owner);
        }
    }

    function submitTransaction(
        address _target,
        uint _value,
        bytes calldata _payload
    ) external onlyOwner returns (uint txID) {
        txID = txCounter++;

        Transaction storage txn = transactions[txID];
        txn.target = _target;
        txn.value = _value;
        txn.payload = _payload;
        txn.executed = false;
        txn.confirmationCount = 0;

        emit TransactionSubmitted(txID, _target, _value, _payload);
    }

    function confirmTransaction(
        uint _txID
    )
        external
        onlyOwner
        txExists(_txID)
        notExecuted(_txID)
        notConfirmed(_txID)
    {
        Transaction storage txn = transactions[_txID];
        txn.confirmations[msg.sender] = true;
        txn.confirmationCount++;

        emit TransactionConfirmed(msg.sender, _txID);

        if (txn.confirmationCount == owners.length) {
            executeTransaction(_txID);
        }
    }
    function isExecuted(uint _txID) external view returns (bool) {
        require(_txID < txCounter, "Transaction does not exist");
        return transactions[_txID].executed;
    }
    function getTransaction(
        uint _txID
    )
        external
        view
        returns (
            address target,
            uint value,
            bytes memory payload,
            bool executed,
            uint confirmationCount
        )
    {
        require(_txID < txCounter, "Transaction does not exist");
        Transaction storage txn = transactions[_txID];
        return (
            txn.target,
            txn.value,
            txn.payload,
            txn.executed,
            txn.confirmationCount
        );
    }

    function isConfirmed(
        uint _txID,
        address owner
    ) external view returns (bool) {
        require(_txID < txCounter, "Transaction does not exist");
        return transactions[_txID].confirmations[owner];
    }

    function executeTransaction(
        uint _txID
    ) public onlyOwner txExists(_txID) notExecuted(_txID) {
        Transaction storage txn = transactions[_txID];
        require(
            txn.confirmationCount == owners.length,
            "Not enough confirmations"
        );

        txn.executed = true;
        (bool success, ) = txn.target.call{value: txn.value}(txn.payload);
        require(success, "Transaction execution failed");

        emit TransactionExecuted(_txID);
    }

    // View helper to get all owners
    function getOwners() external view returns (address[] memory) {
        return owners;
    }

    receive() external payable {}
}
