// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";  
import "hardhat/console.sol"; 

contract IntentMatchingVersion1 is Ownable, ReentrancyGuard{

    enum IntentStatus{Pending, Filled, Cancelled}    
    constructor() Ownable(msg.sender){

    }

    struct BuyIntent{
        address user;
        IERC20 tokenIn;
        IERC20 tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 deadline;
        IntentStatus status;
    }

    struct SellIntent{
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

    event BuyIntentCreated(uint256 indexed intentId,address indexed user,address indexed tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 deadline);
    event SellIntentCreated(uint256 indexed intentId,address indexed user,address indexed tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 deadline);
    event TradeExecuted(uint256 indexed buyIntentId,uint256 indexed sellIntentId,address indexed executor,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut);
    event IntentCancelled(uint256 indexed intentId, bool isBuyIntent);

    
    function createBuyIntent(
        IERC20 tokenIn, 
        IERC20 tokenOut, 
        uint256 amountIn, 
        uint256 minAmountOut, 
        uint256 deadline) 
        external returns (uint256){

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
    ) external returns (uint256){
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

    function matchIntent(uint256 buyIntentId, uint256 sellIntentId, uint256 amountOut) external nonReentrant{
        BuyIntent storage buy = buyIntents[buyIntentId];
        SellIntent storage sell = sellIntents[sellIntentId];

        console.log("Buy TokenIn: ", address(buy.tokenIn));
        console.log("Sell TokenOut: ", address(sell.tokenOut));
        console.log("Buy TokenOut: ", address(buy.tokenOut));
        console.log("Sell TokenIn", address(sell.tokenIn));

        //validate token pair
        require(buy.tokenIn == sell.tokenOut, "Token Mismatch");
        require(buy.tokenOut == sell.tokenIn, "Token Mismatch");

        //Rate
        uint256 buyerEffectivePrice = (buy.amountIn * 1e18) / buy.minAmountOut;
        uint256 sellerEffectivePrice = (sell.minAmountOut * 1e18) / sell.amountIn;
        require(buyerEffectivePrice >= sellerEffectivePrice, "Price incompatible");

        // Validate price 
        require(buyerEffectivePrice >= sellerEffectivePrice, "Price incompatible");
        
        // Calculate maximum possible trade
        uint256 maxPossibleAmountOut = Math.min(
            buy.minAmountOut,
            sell.amountIn
        );
        require(amountOut <= maxPossibleAmountOut, "Amount too large");
        
        // Calculate required input
        uint256 requiredAmountIn = (amountOut * buy.amountIn) / buy.minAmountOut;
        
        // Execute transfers
        buy.tokenIn.transferFrom(buy.user, sell.user, requiredAmountIn);
        sell.tokenIn.transferFrom(sell.user, buy.user, amountOut);
        
        // Update intent statuses
        buy.status = IntentStatus.Filled;
        sell.status = IntentStatus.Filled;
        
        emit TradeExecuted(
            buyIntentId,
            sellIntentId,
            msg.sender,
            address(buy.tokenIn),
            address(buy.tokenOut),
            requiredAmountIn,
            amountOut
        );
    }

    function getBuyIntent(uint256 intentId) external view returns (BuyIntent memory){
        return buyIntents[intentId];
    }

    function getSellIntent(uint256 intentId) external view returns (SellIntent memory){
        return sellIntents[intentId];
    }
}