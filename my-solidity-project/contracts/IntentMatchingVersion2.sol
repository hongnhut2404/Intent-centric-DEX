// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";  
import "hardhat/console.sol"; 

contract IntentMatchingVersion2 is Ownable, ReentrancyGuard {

    enum IntentStatus { Pending, Filled, Cancelled }    
    constructor() Ownable(msg.sender) {}

    struct BuyIntent {
        address user;
        IERC20 tokenIn;
        IERC20 tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 deadline;
        IntentStatus status;
    }

    struct SellIntent {
        address user;
        IERC20 tokenIn;
        IERC20 tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 deadline;
        IntentStatus status;
    }

    uint256 public intentCountBuy = 0;
    uint256 public intentCountSell = 0;
    mapping(uint256 => BuyIntent) public buyIntents;
    mapping(uint256 => SellIntent) public sellIntents;

    event BuyIntentCreated(uint256 indexed intentId, address indexed user, address indexed tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline);
    event SellIntentCreated(uint256 indexed intentId, address indexed user, address indexed tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline);
    event TradeExecuted(uint256 indexed buyIntentId, uint256 indexed sellIntentId, address indexed executor, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
    event IntentCancelled(uint256 indexed intentId, bool isBuyIntent);

    function createBuyIntent(
        IERC20 tokenIn, 
        IERC20 tokenOut, 
        uint256 amountIn, 
        uint256 minAmountOut, 
        uint256 deadline
    ) external returns (uint256) {
        require(amountIn > 0, "Amount must be positive");
        require(deadline > block.timestamp, "Deadline must be in the future");

        uint256 intentId = intentCountBuy++;
        buyIntents[intentId] = BuyIntent({
            user: msg.sender,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            minAmountOut: minAmountOut,
            deadline: deadline,
            status: IntentStatus.Pending
        });

        emit BuyIntentCreated(intentId, msg.sender, address(tokenIn), address(tokenOut), amountIn, minAmountOut, deadline);
        return intentId;
    }

    function createSellIntent(
        IERC20 tokenIn,
        IERC20 tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external returns (uint256) {
        require(amountIn > 0, "Amount must be positive");
        require(deadline > block.timestamp, "Deadline must be in the future");

        uint256 intentId = intentCountSell++;
        sellIntents[intentId] = SellIntent({
            user: msg.sender,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            minAmountOut: minAmountOut,
            deadline: deadline,
            status: IntentStatus.Pending
        });

        emit SellIntentCreated(intentId, msg.sender, address(tokenIn), address(tokenOut), amountIn, minAmountOut, deadline);
        return intentId;
    }

    // Helper function to find the smallest compatible sell intent
    function findSmallestSellIntent(
        BuyIntent storage buy,
        uint256 buyerEffectivePrice,
        uint256 maxIterations
    ) internal returns (bool, uint256, uint256) {
        bool matchFound = false;
        uint256 smallestSellIntentId = 0;
        uint256 smallestSellAmountIn = type(uint256).max;

        for (uint256 i = 0; i < maxIterations; i++) {
            SellIntent storage sell = sellIntents[i];
            console.log("Index:", i);
            if (sell.status != IntentStatus.Pending || block.timestamp > sell.deadline) {
                continue;
            }
            if (buy.tokenIn != sell.tokenOut || buy.tokenOut != sell.tokenIn) {
                continue;
            }
            uint256 sellerEffectivePrice = (sell.minAmountOut * 1e18) / sell.amountIn;
            if (buyerEffectivePrice < sellerEffectivePrice) {
                continue;
            }
            if (sell.amountIn < smallestSellAmountIn && sell.amountIn > 0) {
                smallestSellAmountIn = sell.amountIn;
                smallestSellIntentId = i;
                matchFound = true;
            }
        }
        return (matchFound, smallestSellIntentId, smallestSellAmountIn);
    }

    // Helper function to execute a single trade
    function executeTrade(
        BuyIntent storage buy,
        SellIntent storage sell,
        uint256 buyIntentId,
        uint256 sellIntentId,
        uint256 amountOut
    ) internal {
        uint256 requiredAmountIn = (amountOut * buy.amountIn) / buy.minAmountOut;

        require(buy.tokenIn.balanceOf(buy.user) >= requiredAmountIn, "Insufficient buyer balance");
        require(sell.tokenIn.balanceOf(sell.user) >= amountOut, "Insufficient seller balance");

        buy.tokenIn.transferFrom(buy.user, sell.user, requiredAmountIn);
        sell.tokenIn.transferFrom(sell.user, buy.user, amountOut);

        sell.amountIn -= amountOut;
        sell.minAmountOut = sell.amountIn > 0 ? (sell.minAmountOut * sell.amountIn) / (sell.amountIn + amountOut) : 0;
        if (sell.amountIn == 0) {
            sell.status = IntentStatus.Filled;
        }

        buy.amountIn -= requiredAmountIn;
        buy.minAmountOut -= amountOut;
        if (buy.amountIn == 0) {
            buy.status = IntentStatus.Filled;
        }

        emit TradeExecuted(
            buyIntentId,
            sellIntentId,
            msg.sender,
            address(buy.tokenIn),
            address(buy.tokenOut),
            requiredAmountIn,
            amountOut
        );

        console.log("Partial trade executed: BuyIntent", buyIntentId, "SellIntent", sellIntentId);
        console.log("AmountIn:", requiredAmountIn, "AmountOut:", amountOut);
    }

    function matchIntent(uint256 buyIntentId) external nonReentrant {
        BuyIntent storage buy = buyIntents[buyIntentId];
        require(buy.status == IntentStatus.Pending, "Buy intent not pending");
        require(block.timestamp <= buy.deadline, "Buy intent expired");

        uint256 buyerEffectivePrice = (buy.amountIn * 1e18) / buy.minAmountOut;
        uint256 maxIterations = Math.min(intentCountSell, 100);
        bool progressMade = false;

        while (buy.amountIn > 0) {
            (bool matchFound, uint256 sellIntentId, uint256 sellAmountIn) = findSmallestSellIntent(
                buy,
                buyerEffectivePrice,
                maxIterations
            );

            console.log("Intent Sell Index: ", sellIntentId);

            if (!matchFound) {
                break;
            }

            SellIntent storage sell = sellIntents[sellIntentId];
            uint256 amountOut = Math.min(buy.minAmountOut, sellAmountIn);
            if (amountOut == 0) {
                break;
            }

            executeTrade(buy, sell, buyIntentId, sellIntentId, amountOut);
            progressMade = true;
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