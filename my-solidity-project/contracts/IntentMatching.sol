// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";  
import "hardhat/console.sol"; 

contract IntentMatching is Ownable, ReentrancyGuard {

    enum IntentStatus { Pending, Filled, Cancelled }    
    constructor() Ownable(msg.sender) {}

    struct BuyIntent {
        address buyer;
        uint256 sellAmount;      // BTC amount (off-chain)
        uint256 minBuyAmount;    // ETH expected (on-chain)
        uint256 locktime;
        uint256 createdAt;
        IntentStatus status;
        bytes32 offchainId;
    }

    struct SellIntent {
        address seller;
        uint256 sellAmount;      // ETH sell 
        uint256 minBuyAmount;    // BTC expected (off-chain)
        uint256 deadline;
        IntentStatus status;
        bytes32 offchainId;
    }

    uint256 public intentCountBuy = 0;
    uint256 public intentCountSell = 0;
    mapping(uint256 => BuyIntent) public buyIntents;
    mapping(uint256 => SellIntent) public sellIntents;

    event BuyIntentCreated(uint256 indexed intentId, address indexed buyer, uint256 sellAmount, uint256 minBuyAmount, uint256 locktime);
    event SellIntentCreated(uint256 indexed intentId, address indexed seller, uint256 sellAmount, uint256 minBuyAmount, uint256 deadline);

    function createBuyIntent(
        uint256 sellAmount,
        uint256 minBuyAmount,
        uint256 locktime,
        bytes32 offchainId
    ) external returns (uint256) {
        require(sellAmount > 0, "Sell amount must be positive");
        require(locktime > block.timestamp, "Locktime must be in the future");

        uint256 intentId = intentCountBuy++;
        buyIntents[intentId] = BuyIntent({
            buyer: msg.sender,
            sellAmount: sellAmount,
            minBuyAmount: minBuyAmount,
            locktime: locktime,
            createdAt: block.timestamp,
            status: IntentStatus.Pending,
            offchainId: offchainId
        });

        emit BuyIntentCreated(intentId, msg.sender, sellAmount, minBuyAmount, locktime);
        return intentId;
    }

    function createSellIntent(
        uint256 sellAmount,
        uint256 minBuyAmount,
        uint256 deadline,
        bytes32 offchainId
    ) external returns (uint256) {
        require(sellAmount > 0, "Sell amount must be positive");
        require(deadline > block.timestamp, "Deadline must be in the future");

        uint256 intentId = intentCountSell++;
        sellIntents[intentId] = SellIntent({
            seller: msg.sender,
            sellAmount: sellAmount,
            minBuyAmount: minBuyAmount,
            deadline: deadline,
            status: IntentStatus.Pending,
            offchainId: offchainId
        });

        emit SellIntentCreated(intentId, msg.sender, sellAmount, minBuyAmount, deadline);
        return intentId;
    }

    event TradeExecuted(
        uint256 indexed buyIntentId,
        uint256 indexed sellIntentId,
        address executor,
        address token,        // Token to be locked (ETH/WETH)
        address recipient,    // Buyer who will receive tokens from HTLC
        uint256 amountETH,        // Amount of token to be locked
        uint256 amountBTC,        // Amount of token to be locked
        uint256 locktime
    );

    event HTLCInitiate(
        address indexed sender,
        address indexed receiver,
        uint256 timelock,
        uint256 amount,
        address token
    );



    // Helper function to find the smallest compatible sell intent
    function findSmallestSellIntent(
        BuyIntent storage buy,
        uint256 buyerEffectivePrice,  // e.g. (ETH_expected * 1e18) / BTC_offered
        uint256 maxIterations
    ) internal view returns (bool, uint256, uint256) {
        bool matchFound = false;
        uint256 smallestSellIntentId = 0;
        uint256 smallestSellAmount = type(uint256).max;

        for (uint256 i = 0; i < maxIterations; i++) {
            SellIntent storage sell = sellIntents[i];
            console.log("Index:", i);

            if (sell.status != IntentStatus.Pending || block.timestamp > sell.deadline) {
                continue;
            }

            // Seller's effective price = (BTC_expected * 1e18) / ETH_selling
            uint256 sellerEffectivePrice = (sell.minBuyAmount * 1e18) / sell.sellAmount;

            if (buyerEffectivePrice < sellerEffectivePrice) {
                continue;
            }

            if (sell.sellAmount < smallestSellAmount && sell.sellAmount > 0) {
                smallestSellAmount = sell.sellAmount;
                smallestSellIntentId = i;
                matchFound = true;
            }
        }

        return (matchFound, smallestSellIntentId, smallestSellAmount);
    }


    // Helper function to execute a single trade
    function executeTrade(
        BuyIntent storage buy,
        SellIntent storage sell,
        uint256 buyIntentId,
        uint256 sellIntentId,
        uint256 amountOut,
        uint256 timelock
    ) internal {
        buy.status = IntentStatus.Filled;
        sell.status = IntentStatus.Filled;

        emit TradeExecuted(
            buyIntentId,
            sellIntentId,
            msg.sender,
            address(0),
            buy.buyer,
            amountOut,
            buy.sellAmount,
            buy.locktime
        );

        emit HTLCInitiate(
            sell.seller,
            buy.buyer,
            timelock,
            amountOut,
            address(0)
        );

        console.log("HTLC info emitted for off-chain listener");
    }


    function matchIntent(uint256 buyIntentId) external nonReentrant {
        BuyIntent storage buy = buyIntents[buyIntentId];
        require(buy.status == IntentStatus.Pending, "Buy intent not pending");
        require(block.timestamp <= buy.locktime, "Buy intent expired");

        // Buyer: wants ETH (minBuyAmount), offers BTC (sellAmount)
        uint256 buyerEffectivePrice = (buy.minBuyAmount * 1e18) / buy.sellAmount;

        uint256 maxIterations = Math.min(intentCountSell, 100);
        bool progressMade = false;

        while (buy.sellAmount > 0) {
            (bool matchFound, uint256 sellIntentId, uint256 sellSellAmount) = findSmallestSellIntent(
                buy,
                buyerEffectivePrice,
                maxIterations
            );

            console.log("Matching with SellIntent ID:", sellIntentId);

            if (!matchFound) {
                break;
            }

            SellIntent storage sell = sellIntents[sellIntentId];

            uint256 amountOut = Math.min(buy.minBuyAmount, sell.sellAmount);
            if (amountOut == 0) {
                break;
            }

            // Mark both intents as filled for now (you can later support partial fills)
            buy.status = IntentStatus.Filled;
            sell.status = IntentStatus.Filled;

            // For coordination with off-chain HTLC executor, emit an event
            emit TradeExecuted(
                buyIntentId,
                sellIntentId,
                sell.seller,
                address(0),
                buy.buyer,
                amountOut / 1e18,
                buy.sellAmount / 1e8,
                buy.locktime
            );

            progressMade = true;
            break; // only do 1 match for now; remove this if supporting multiple fills
        }

        require(progressMade, "No progress made");
    }


    function getBuyIntent(uint256 intentId) external view returns (BuyIntent memory) {
        return buyIntents[intentId];
    }

    function getSellIntent(uint256 intentId) external view returns (SellIntent memory) {
        return sellIntents[intentId];
    }
}