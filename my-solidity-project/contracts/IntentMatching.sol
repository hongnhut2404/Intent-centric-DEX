// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "hardhat/console.sol";

contract IntentMatching is Ownable, ReentrancyGuard {
    enum IntentStatus {
        Pending,
        Filled,
        Cancelled
    }

    constructor() Ownable(msg.sender) {}

    struct BuyIntent {
        address buyer;
        uint256 sellAmount; // BTC amount (off-chain)
        uint256 minBuyAmount; // ETH expected (on-chain)
        uint256 locktime;
        uint256 createdAt;
        IntentStatus status;
        bytes32 offchainId;
    }

    struct SellIntent {
        address seller;
        uint256 sellAmount; // ETH amount
        uint256 minBuyAmount; // BTC expected
        uint256 deadline;
        IntentStatus status;
        bytes32 offchainId;
    }

    struct MatchedTrade {
        uint256 buyIntentId;
        uint256 sellIntentId;
        address executor;
        address recipient;
        uint256 ethAmount;
        uint256 btcAmount;
        uint256 locktime;
        uint256 timestamp;
    }

    uint256 public intentCountBuy;
    uint256 public intentCountSell;

    mapping(uint256 => MatchedTrade) public matchedTrades;
    uint256 public matchedTradeCount;

    mapping(uint256 => BuyIntent) public buyIntents;
    mapping(uint256 => SellIntent) public sellIntents;

    event BuyIntentCreated(
        uint256 indexed intentId,
        address indexed buyer,
        uint256 sellAmount,
        uint256 minBuyAmount,
        uint256 locktime,
        bytes32 offchainId
    );

    event SellIntentCreated(
        uint256 indexed intentId,
        address indexed seller,
        uint256 sellAmount,
        uint256 minBuyAmount,
        uint256 deadline,
        bytes32 offchainId
    );

    event TradeMatched(
        uint256 indexed buyIntentId,
        uint256 indexed sellIntentId,
        address executor,
        address token,
        address recipient,
        uint256 ethAmount,
        uint256 btcAmount,
        uint256 locktime
    );

    event HTLCPrepared(
        uint256 indexed buyIntentId,
        uint256 indexed sellIntentId,
        bytes32 lockId,
        bytes32 secretHash,
        uint256 timelock,
        string btcReceiverAddress
    );

    address public htlcAddress;

    event HTLCAddressUpdated(address indexed htlcAddress);

    function setHTLCAddress(address _htlc) external onlyOwner {
        require(_htlc != address(0), "Invalid HTLC address");
        htlcAddress = _htlc;
        emit HTLCAddressUpdated(_htlc);
    }

    function createBuyIntent(
        uint256 sellAmount,
        uint256 minBuyAmount,
        uint256 locktime,
        bytes32 offchainId
    ) external returns (uint256) {
        require(sellAmount > 0, "Sell amount must be positive");
        require(locktime > block.timestamp, "Locktime must be in the future");

        uint256 id = intentCountBuy++;
        buyIntents[id] = BuyIntent({
            buyer: msg.sender,
            sellAmount: sellAmount,
            minBuyAmount: minBuyAmount,
            locktime: locktime,
            createdAt: block.timestamp,
            status: IntentStatus.Pending,
            offchainId: offchainId
        });

        emit BuyIntentCreated(
            id,
            msg.sender,
            sellAmount,
            minBuyAmount,
            locktime,
            offchainId
        );
        return id;
    }

    function createSellIntent(
        uint256 sellAmount,
        uint256 minBuyAmount,
        uint256 deadline,
        bytes32 offchainId
    ) external returns (uint256) {
        require(sellAmount > 0, "Sell amount must be positive");
        require(deadline > block.timestamp, "Deadline must be in the future");

        uint256 id = intentCountSell++;
        sellIntents[id] = SellIntent({
            seller: msg.sender,
            sellAmount: sellAmount,
            minBuyAmount: minBuyAmount,
            deadline: deadline,
            status: IntentStatus.Pending,
            offchainId: offchainId
        });

        emit SellIntentCreated(
            id,
            msg.sender,
            sellAmount,
            minBuyAmount,
            deadline,
            offchainId
        );
        return id;
    }

    function findBestSellIntent(
        uint256 buyerPrice,
        uint256 maxIterations
    ) internal view returns (bool, uint256) {
        bool found;
        uint256 bestSellId;
        uint256 bestSellPrice = type(uint256).max;

        for (uint256 i = 0; i < Math.min(intentCountSell, maxIterations); i++) {
            SellIntent storage sell = sellIntents[i];
            if (
                sell.status != IntentStatus.Pending ||
                block.timestamp > sell.deadline
            ) {
                continue;
            }

            uint256 sellPrice = (sell.minBuyAmount * 1e18) / sell.sellAmount;
            if (sellPrice < buyerPrice) continue;

            if (sellPrice < bestSellPrice) {
                bestSellPrice = sellPrice;
                bestSellId = i;
                found = true;
            }
        }
        return (found, bestSellId);
    }

    function matchIntent(uint256 buyIntentId) external nonReentrant {
        BuyIntent storage buy = buyIntents[buyIntentId];
        require(buy.status == IntentStatus.Pending, "BuyIntent not pending");
        require(block.timestamp <= buy.locktime, "BuyIntent expired");

        uint256 totalBTCNeeded = buy.sellAmount;
        uint256 totalETHPaid = 0;
        uint256 remainingBTC = totalBTCNeeded;

        for (uint256 i = 0; i < intentCountSell && remainingBTC > 0; i++) {
            SellIntent storage sell = sellIntents[i];

            if (
                sell.status != IntentStatus.Pending ||
                block.timestamp > sell.deadline
            ) continue;

            uint256 sellPrice = (sell.minBuyAmount * 1e18) / sell.sellAmount;
            uint256 buyPrice = (buy.minBuyAmount * 1e18) / buy.sellAmount;

            if (sellPrice > buyPrice) continue;

            uint256 matchedBTC = sell.sellAmount >= remainingBTC
                ? remainingBTC
                : sell.sellAmount;

            uint256 matchedETH = (sell.minBuyAmount * matchedBTC) /
                sell.sellAmount;

            emit TradeMatched(
                buyIntentId,
                i,
                msg.sender,
                address(0),
                buy.buyer,
                matchedETH,
                matchedBTC,
                buy.locktime
            );

            matchedTrades[matchedTradeCount++] = MatchedTrade({
                buyIntentId: buyIntentId,
                sellIntentId: i,
                executor: msg.sender,
                recipient: buy.buyer,
                ethAmount: matchedETH,
                btcAmount: matchedBTC,
                locktime: buy.locktime,
                timestamp: block.timestamp
            });

            remainingBTC -= matchedBTC;
            totalETHPaid += matchedETH;

            if (matchedBTC == sell.sellAmount) {
                sell.status = IntentStatus.Filled;
            } else {
                sell.sellAmount -= matchedBTC;
                sell.minBuyAmount -= matchedETH;
            }
        }

        require(remainingBTC == 0, "Not enough matching sell intents");

        buy.status = IntentStatus.Filled;

        console.log("BuyIntent partially matched with multiple SellIntents");
    }

    function prepareHTLC(
        uint256 buyIntentId,
        uint256 sellIntentId,
        bytes32 secretHash,
        uint256 timelock,
        string calldata btcReceiverAddress
    ) external onlyOwner {
        BuyIntent storage buy = buyIntents[buyIntentId];
        SellIntent storage sell = sellIntents[sellIntentId];

        require(buy.status == IntentStatus.Filled, "BuyIntent not matched yet");
        require(
            sell.status == IntentStatus.Filled,
            "SellIntent not matched yet"
        );

        bytes32 lockId = keccak256(
            abi.encodePacked(buyIntentId, sellIntentId, block.timestamp)
        );

        emit HTLCPrepared(
            buyIntentId,
            sellIntentId,
            lockId,
            secretHash,
            timelock,
            btcReceiverAddress
        );

        console.log("HTLC prepared and emitted for off-chain execution.");
    }

    function getBuyIntent(uint256 id) external view returns (BuyIntent memory) {
        return buyIntents[id];
    }

    function getSellIntent(
        uint256 id
    ) external view returns (SellIntent memory) {
        return sellIntents[id];
    }
}
