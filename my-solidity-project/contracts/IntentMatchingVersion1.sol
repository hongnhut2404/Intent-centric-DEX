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

    
     
}