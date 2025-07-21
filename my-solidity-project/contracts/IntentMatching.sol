// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "hardhat/console.sol";

contract IntentMatching is Ownable, ReentrancyGuard {
    enum IntentStatus {
        Pending,
        Partial,
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
        uint256 slippage; // New: slippage percentage (e.g., 5 for 5%)
    }

    struct SellIntent {
        address seller;
        uint256 sellAmount; // ETH amount
        uint256 minBuyAmount; // BTC expected
        uint256 deadline;
        IntentStatus status;
        bytes32 offchainId;
    }

    struct RateEntry {
        uint256 index;
        uint256 rate;
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
    uint256 public matchedTradeCount;

    mapping(uint256 => MatchedTrade) public matchedTrades;
    mapping(uint256 => BuyIntent) public buyIntents;
    mapping(uint256 => SellIntent) public sellIntents;

    address public multisigWallet;
    address public htlcAddress;

    // Modifiers
    modifier onlyMultisig() {
        require(msg.sender == multisigWallet, "Only multisig wallet can call");
        _;
    }

    // Events
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
        address indexed executor,
        address seller,
        address buyer,
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

    event HTLCAssociated(
        uint256 indexed buyIntentId,
        bytes32 indexed lockId,
        address recipient,
        bytes32 secretHash
    );

    event NoMatchingSellIntent(uint256 indexed buyIntentId);
    event MultisigWalletUpdated(address oldWallet, address newWallet);
    event HTLCAddressUpdated(address oldAddress, address newAddress);

    // Setters
    function setMultisigWallet(address _wallet) external onlyOwner {
        require(multisigWallet == address(0), "Multisig already set");
        require(_wallet != address(0), "Invalid address");
        emit MultisigWalletUpdated(multisigWallet, _wallet);
        multisigWallet = _wallet;
    }

    function setHTLCAddress(address _htlc) external onlyOwner {
        require(_htlc != address(0), "Invalid HTLC address");
        emit HTLCAddressUpdated(htlcAddress, _htlc);
        htlcAddress = _htlc;
    }

    // Create Buy Intent (open to public)
    function createBuyIntent(
        uint256 sellAmount,
        uint256 minBuyAmount,
        uint256 locktime,
        bytes32 offchainId,
        uint256 slippage
    ) external returns (uint256) {
        require(sellAmount > 0, "Sell amount must be positive");
        require(locktime > block.timestamp, "Locktime must be in the future");
        require(slippage <= 100, "Invalid slippage"); // Optional upper bound check

        uint256 id = intentCountBuy++;
        buyIntents[id] = BuyIntent({
            buyer: msg.sender,
            sellAmount: sellAmount,
            minBuyAmount: minBuyAmount,
            locktime: locktime,
            createdAt: block.timestamp,
            status: IntentStatus.Pending,
            offchainId: offchainId,
            slippage: slippage
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

    // Create Sell Intent (only by multisig)
    function createSellIntent(
        uint256 sellAmount,
        uint256 minBuyAmount,
        uint256 deadline,
        bytes32 offchainId
    ) external onlyMultisig returns (uint256) {
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

    // Match logic
    function matchIntent(uint256 buyIntentId) external nonReentrant {
        BuyIntent storage buy = buyIntents[buyIntentId];
        require(buy.status == IntentStatus.Pending, "BuyIntent not pending");
        require(block.timestamp <= buy.locktime, "BuyIntent expired");

        uint256 remainingBTC = buy.sellAmount;
        uint256 expectedRate = (buy.minBuyAmount * 1e18) / buy.sellAmount;

        // Calculate slippage bounds
        uint256 lowerBoundRate = (expectedRate * (100 - buy.slippage)) / 100;
        uint256 upperBoundRate = expectedRate;

        RateEntry[] memory candidates = new RateEntry[](intentCountSell);
        uint256 count = 0;

        // Step 1: Filter valid SellIntents within slippage bounds
        for (uint256 i = 0; i < intentCountSell; i++) {
            SellIntent storage sell = sellIntents[i];
            if (
                sell.status != IntentStatus.Pending ||
                block.timestamp > sell.deadline
            ) continue;

            uint256 sellRate = (sell.minBuyAmount * 1e18) / sell.sellAmount;
            if (sellRate >= lowerBoundRate && sellRate <= upperBoundRate) {
                candidates[count++] = RateEntry(i, sellRate);
            }
        }

        require(count > 0, "No matching sell intents found");

        // Step 2: Sort by highest sellRate (least favorable to buyer within slippage)
        for (uint256 i = 0; i < count; i++) {
            for (uint256 j = i + 1; j < count; j++) {
                if (candidates[j].rate > candidates[i].rate) {
                    RateEntry memory temp = candidates[i];
                    candidates[i] = candidates[j];
                    candidates[j] = temp;
                }
            }
        }

        uint256 totalETHPaid = 0;

        // Step 3: Match against sorted candidates
        for (uint256 i = 0; i < count && remainingBTC > 0; i++) {
            SellIntent storage sell = sellIntents[candidates[i].index];

            uint256 matchedBTC = sell.sellAmount > remainingBTC
                ? remainingBTC
                : sell.sellAmount;
            uint256 matchedETH = (sell.minBuyAmount * matchedBTC) /
                sell.sellAmount;

            matchedTrades[matchedTradeCount++] = MatchedTrade({
                buyIntentId: buyIntentId,
                sellIntentId: candidates[i].index,
                executor: msg.sender,
                recipient: buy.buyer,
                ethAmount: matchedETH,
                btcAmount: matchedBTC,
                locktime: buy.locktime,
                timestamp: block.timestamp
            });

            emit TradeMatched(
                buyIntentId,
                candidates[i].index,
                msg.sender,
                sell.seller,
                buy.buyer,
                matchedETH,
                matchedBTC,
                buy.locktime
            );

            if (matchedBTC == sell.sellAmount) {
                sell.status = IntentStatus.Filled;
            } else {
                sell.sellAmount -= matchedBTC;
                sell.minBuyAmount -= matchedETH;
            }

            remainingBTC -= matchedBTC;
            totalETHPaid += matchedETH;
        }

        // Step 4: Update BuyIntent status
        if (remainingBTC == 0) {
            buy.status = IntentStatus.Filled;
        } else if (remainingBTC < buy.sellAmount) {
            buy.status = IntentStatus.Partial;
            buy.sellAmount = remainingBTC;
            buy.minBuyAmount -= totalETHPaid;
        }
    }

    // Emit HTLC association
    function associateHTLC(
        uint256 buyIntentId,
        bytes32 lockId,
        address recipient,
        bytes32 secretHash
    ) external onlyMultisig {
        emit HTLCAssociated(buyIntentId, lockId, recipient, secretHash);
    }

    // Getters
    function getBuyIntent(uint256 id) external view returns (BuyIntent memory) {
        return buyIntents[id];
    }

    function getSellIntent(
        uint256 id
    ) external view returns (SellIntent memory) {
        return sellIntents[id];
    }

    function getMatchedTrade(
        uint256 id
    ) external view returns (MatchedTrade memory) {
        return matchedTrades[id];
    }
}
