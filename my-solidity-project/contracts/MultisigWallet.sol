// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MultisigWallet {
    address[] public owners;
    mapping(address => bool) public isOwner;
    uint public required;

    uint public txCounter;

    struct Transaction {
        address target;
        uint value;
        bytes payload;
        bool executed;
    }

    mapping(uint => Transaction) public transactions;
    mapping(uint => mapping(address => bool)) public confirmations;

    event TransactionSubmitted(uint indexed txID, address indexed target, uint value, bytes payload);
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
        require(!confirmations[_txID][msg.sender], "Already confirmed");
        _;
    }

    constructor(address[] memory _owners, uint _required) {
        require(_owners.length > 0, "Owners required");
        require(_required > 0 && _required <= _owners.length, "Invalid required confirmations");

        for (uint i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "Invalid owner");
            require(!isOwner[owner], "Owner not unique");

            isOwner[owner] = true;
            owners.push(owner);
        }

        required = _required;
    }

    function submitTransaction(
        address _target,
        uint _value,
        bytes calldata _payload
    ) external onlyOwner returns (uint txID) {
        txID = txCounter++;

        transactions[txID] = Transaction({
            target: _target,
            value: _value,
            payload: _payload,
            executed: false
        });

        emit TransactionSubmitted(txID, _target, _value, _payload);
    }

    function confirmTransaction(uint _txID)
        external
        onlyOwner
        txExists(_txID)
        notExecuted(_txID)
        notConfirmed(_txID)
    {
        confirmations[_txID][msg.sender] = true;
        emit TransactionConfirmed(msg.sender, _txID);
    }

    function executeTransaction(uint _txID)
        public
        onlyOwner
        txExists(_txID)
        notExecuted(_txID)
    {
        uint count = getConfirmationCount(_txID);
        require(count >= required, "Not enough confirmations");

        Transaction storage txn = transactions[_txID];
        txn.executed = true;

        (bool success, ) = txn.target.call{value: txn.value}(txn.payload);
        require(success, "Transaction execution failed");

        emit TransactionExecuted(_txID);
    }

    function getConfirmationCount(uint _txID) public view returns (uint count) {
        require(_txID < txCounter, "Transaction does not exist");

        for (uint i = 0; i < owners.length; i++) {
            if (confirmations[_txID][owners[i]]) {
                count += 1;
            }
        }
    }

    function isConfirmed(uint _txID, address owner) external view returns (bool) {
        require(_txID < txCounter, "Transaction does not exist");
        return confirmations[_txID][owner];
    }

    function isExecuted(uint _txID) external view returns (bool) {
        require(_txID < txCounter, "Transaction does not exist");
        return transactions[_txID].executed;
    }

    function getOwners() external view returns (address[] memory) {
        return owners;
    }

    receive() external payable {}
}
