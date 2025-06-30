// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract IntentMatchingVersion3 is Ownable, ReentrancyGuard, Pausable {
    enum IntentStatus { Pending, Filled, Cancelled }

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
    mapping(address => uint256) public userIntentCount;
    uint256 public maxIntentsPerUser = 10;

    // Mapping for sorted intents by price for efficient matching
    mapping(address => mapping(address => mapping(uint256 => uint256[]))) public tokenPairToPriceToSellIntentIds;
    mapping(uint256 => uint256) public sellIntentPrices;

    event BuyIntentCreated(uint256 indexed intentId, address indexed user, address indexed tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline);
    event SellIntentCreated(uint256 indexed intentId, address indexed user, address indexed tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline);
    event TradeExecuted(uint256 indexed buyIntentId, uint256 indexed sellIntentId, address indexed executor, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
    event IntentCancelled(uint256 indexed intentId, bool isBuyIntent);

    constructor() Ownable(msg.sender) {}

    // Helper function to calculate effective price with token decimals
    function getEffectivePrice(
        IERC20 tokenIn,
        IERC20 tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal view returns (uint256) {
        uint8 inDecimals = IERC20Metadata(address(tokenIn)).decimals();
        uint8 outDecimals = IERC20Metadata(address(tokenOut)).decimals();
        return (amountIn * 10**outDecimals) / (minAmountOut * 10**inDecimals);
    }

    function createBuyIntent(
        IERC20 tokenIn,
        IERC20 tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external whenNotPaused returns (uint256) {
        require(amountIn > 0, "Amount must be positive");
        require(deadline > block.timestamp, "Deadline must be in the future");
        require(userIntentCount[msg.sender] < maxIntentsPerUser, "Too many intents");
        require(tokenIn.allowance(msg.sender, address(this)) >= amountIn, "Insufficient allowance");

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

        userIntentCount[msg.sender]++;
        emit BuyIntentCreated(intentId, msg.sender, address(tokenIn), address(tokenOut), amountIn, minAmountOut, deadline);
        return intentId;
    }

    function createSellIntent(
        IERC20 tokenIn,
        IERC20 tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external whenNotPaused returns (uint256) {
        require(amountIn > 0, "Amount must be positive");
        require(deadline > block.timestamp, "Deadline must be in the future");
        require(userIntentCount[msg.sender] < maxIntentsPerUser, "Too many intents");
        require(tokenIn.allowance(msg.sender, address(this)) >= amountIn, "Insufficient allowance");

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

        // Store intent in sorted price structure
        uint256 price = getEffectivePrice(tokenIn, tokenOut, minAmountOut, amountIn);
        tokenPairToPriceToSellIntentIds[address(tokenIn)][address(tokenOut)][price].push(intentId);
        sellIntentPrices[intentId] = price;

        userIntentCount[msg.sender]++;
        emit SellIntentCreated(intentId, msg.sender, address(tokenIn), address(tokenOut), amountIn, minAmountOut, deadline);
        return intentId;
    }

    function executeTrade(
        BuyIntent storage buy,
        SellIntent storage sell,
        uint256 amountOut
    ) internal returns (uint256 requiredAmountIn) {
        requiredAmountIn = (amountOut * buy.amountIn) / buy.minAmountOut;

        require(buy.tokenIn.balanceOf(buy.user) >= requiredAmountIn, "Insufficient buyer balance");
        require(sell.tokenIn.balanceOf(sell.user) >= amountOut, "Insufficient seller balance");

        buy.tokenIn.transferFrom(buy.user, sell.user, requiredAmountIn);
        sell.tokenIn.transferFrom(sell.user, buy.user, amountOut);

        sell.amountIn -= amountOut;
        sell.minAmountOut = sell.amountIn > 0
            ? (sell.minAmountOut * sell.amountIn) / (sell.amountIn + amountOut)
            : 0;
        if (sell.amountIn == 0) {
            sell.status = IntentStatus.Filled;
            userIntentCount[sell.user]--;
        }

        buy.amountIn -= requiredAmountIn;
        buy.minAmountOut -= amountOut;
        if (buy.amountIn == 0) {
            buy.status = IntentStatus.Filled;
            userIntentCount[buy.user]--;
        }
    }


    // Check if sell intent is compatible with buy intent
    function isCompatible(
        BuyIntent storage buy,
        SellIntent storage sell,
        uint256 buyerEffectivePrice
    ) internal view returns (bool) {
        if (sell.status != IntentStatus.Pending || block.timestamp > sell.deadline) {
            return false;
        }
        if (buy.tokenIn != sell.tokenOut || buy.tokenOut != sell.tokenIn) {
            return false;
        }
        uint256 sellerEffectivePrice = getEffectivePrice(sell.tokenIn, sell.tokenOut, sell.minAmountOut, sell.amountIn);
        return buyerEffectivePrice >= sellerEffectivePrice;
    }

    // Internal function to match a single buy intent
    function matchSingleIntent(uint256 buyIntentId) internal returns (bool) {
        BuyIntent storage buy = buyIntents[buyIntentId];
        if (buy.status != IntentStatus.Pending || block.timestamp > buy.deadline) {
            return false;
        }

        uint256 buyerEffectivePrice = getEffectivePrice(buy.tokenIn, buy.tokenOut, buy.amountIn, buy.minAmountOut);
        bool progressMade = false;

        uint256[] storage sellIntentIds = tokenPairToPriceToSellIntentIds[
            address(buy.tokenOut)][address(buy.tokenIn)][buyerEffectivePrice];

        for (uint256 i = 0; i < sellIntentIds.length && buy.amountIn > 0; i++) {
            uint256 sellIntentId = sellIntentIds[i];
            SellIntent storage sell = sellIntents[sellIntentId];

            if (!isCompatible(buy, sell, buyerEffectivePrice)) {
                continue;
            }

            uint256 amountOut = Math.min(buy.minAmountOut, sell.amountIn);
            if (amountOut == 0) {
                continue;
            }

            uint256 requiredAmountIn = executeTrade(buy, sell, amountOut);

            emit TradeExecuted(
                buyIntentId,
                sellIntentId,
                msg.sender,
                address(buy.tokenIn),
                address(buy.tokenOut),
                requiredAmountIn,
                amountOut
            );

            progressMade = true;

            if (sell.status == IntentStatus.Filled) {
                sellIntentIds[i] = sellIntentIds[sellIntentIds.length - 1];
                sellIntentIds.pop();
                delete sellIntentPrices[sellIntentId];
            }
        }

        return progressMade;
    }


    // Match a single buy intent
    function matchIntent(uint256 buyIntentId) external nonReentrant whenNotPaused returns (bool) {
        return matchSingleIntent(buyIntentId);
    }

        // Match a single sell intent with buy intents
    function matchSellIntent(uint256 sellIntentId) external nonReentrant whenNotPaused returns (bool) {
        SellIntent storage sell = sellIntents[sellIntentId];
        require(sell.status == IntentStatus.Pending, "Sell intent not pending");
        require(block.timestamp <= sell.deadline, "Sell intent expired");

        uint256 sellerEffectivePrice = getEffectivePrice(sell.tokenIn, sell.tokenOut, sell.minAmountOut, sell.amountIn);
        bool progressMade = false;

        for (uint256 i = 0; i < intentCountBuy && sell.amountIn > 0; i++) {
            BuyIntent storage buy = buyIntents[i];
            if (buy.status != IntentStatus.Pending || block.timestamp > buy.deadline) {
                continue;
            }
            if (buy.tokenIn != sell.tokenOut || buy.tokenOut != sell.tokenIn) {
                continue;
            }

            uint256 buyerEffectivePrice = getEffectivePrice(buy.tokenIn, buy.tokenOut, buy.amountIn, buy.minAmountOut);
            if (buyerEffectivePrice < sellerEffectivePrice) {
                continue;
            }

            uint256 amountOut = Math.min(buy.minAmountOut, sell.amountIn);
            if (amountOut == 0) {
                continue;
            }

            uint256 requiredAmountIn = executeTrade(buy, sell, amountOut);

            emit TradeExecuted(
                i,
                sellIntentId,
                msg.sender,
                address(buy.tokenIn),
                address(buy.tokenOut),
                requiredAmountIn,
                amountOut
            );

            progressMade = true;
        }

        return progressMade;
    }


    // Batch match multiple buy intents
    function matchMultipleIntents(uint256[] calldata buyIntentIds) external nonReentrant whenNotPaused returns (bool) {
        bool progressMade = false;
        for (uint256 i = 0; i < buyIntentIds.length; i++) {
            // Call internal matchSingleIntent instead of external matchIntent
            bool matched = matchSingleIntent(buyIntentIds[i]);
            progressMade = progressMade || matched;
        }
        return progressMade;
    }

    // Cancel a buy intent
    function cancelBuyIntent(uint256 intentId) external {
        BuyIntent storage intent = buyIntents[intentId];
        require(msg.sender == intent.user, "Not intent owner");
        require(intent.status == IntentStatus.Pending, "Intent not pending");
        intent.status = IntentStatus.Cancelled;
        userIntentCount[msg.sender]--;
        emit IntentCancelled(intentId, true);
    }

    // Cancel a sell intent
    function cancelSellIntent(uint256 intentId) external {
        SellIntent storage intent = sellIntents[intentId];
        require(msg.sender == intent.user, "Not intent owner");
        require(intent.status == IntentStatus.Pending, "Intent not pending");
        intent.status = IntentStatus.Cancelled;
        userIntentCount[msg.sender]--;

        // Remove from price bucket
        uint256 price = sellIntentPrices[intentId];
        uint256[] storage sellIntentIds = tokenPairToPriceToSellIntentIds[address(intent.tokenIn)][address(intent.tokenOut)][price];
        for (uint256 i = 0; i < sellIntentIds.length; i++) {
            if (sellIntentIds[i] == intentId) {
                sellIntentIds[i] = sellIntentIds[sellIntentIds.length - 1];
                sellIntentIds.pop();
                break;
            }
        }
        delete sellIntentPrices[intentId];

        emit IntentCancelled(intentId, false);
    }

    // Clean expired intents
    function cleanExpiredIntents(uint256[] calldata intentIds, bool isBuy) external {
        for (uint256 i = 0; i < intentIds.length; i++) {
            if (isBuy) {
                BuyIntent storage intent = buyIntents[intentIds[i]];
                if (block.timestamp > intent.deadline && intent.status == IntentStatus.Pending) {
                    intent.status = IntentStatus.Cancelled;
                    userIntentCount[intent.user]--;
                    emit IntentCancelled(intentIds[i], true);
                }
            } else {
                SellIntent storage intent = sellIntents[intentIds[i]];
                if (block.timestamp > intent.deadline && intent.status == IntentStatus.Pending) {
                    intent.status = IntentStatus.Cancelled;
                    userIntentCount[intent.user]--;

                    // Remove from price bucket
                    uint256 price = sellIntentPrices[intentIds[i]];
                    uint256[] storage sellIntentIds = tokenPairToPriceToSellIntentIds[address(intent.tokenIn)][address(intent.tokenOut)][price];
                    for (uint256 j = 0; j < sellIntentIds.length; j++) {
                        if (sellIntentIds[j] == intentIds[i]) {
                            sellIntentIds[j] = sellIntentIds[sellIntentIds.length - 1];
                            sellIntentIds.pop();
                            break;
                        }
                    }
                    delete sellIntentPrices[intentIds[i]];

                    emit IntentCancelled(intentIds[i], false);
                }
            }
        }
    }

    // Pause and unpause functions
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // View functions
    function getBuyIntent(uint256 intentId) external view returns (BuyIntent memory) {
        return buyIntents[intentId];
    }

    function getSellIntent(uint256 intentId) external view returns (SellIntent memory) {
        return sellIntents[intentId];
    }
}