// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

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
        uint256 sellAmount;     // BTC amount (off-chain units, e.g. satoshis)
        uint256 minBuyAmount;   // ETH expected (on-chain, wei)
        uint256 locktime;
        uint256 createdAt;
        IntentStatus status;
        bytes32 offchainId;
        uint256 slippage;       // percentage 0..100
    }

    struct SellIntent {
        address seller;         // market maker EOA
        uint256 sellAmount;     // ETH amount (wei)
        uint256 minBuyAmount;   // BTC expected (sats)
        uint256 deadline;
        IntentStatus status;
        bytes32 offchainId;
    }

    struct RateEntry {
        uint256 index;
        uint256 rate;           // ETH per BTC scaled by 1e18
    }

    struct MatchedTrade {
        uint256 buyIntentId;
        uint256 sellIntentId;
        address executor;
        address recipient;
        uint256 ethAmount;      // wei
        uint256 btcAmount;      // sats
        uint256 locktime;
        uint256 timestamp;
    }

    uint256 public intentCountBuy;
    uint256 public intentCountSell;
    uint256 public matchedTradeCount;

    mapping(uint256 => MatchedTrade) public matchedTrades;
    mapping(uint256 => BuyIntent) public buyIntents;
    mapping(uint256 => SellIntent) public sellIntents;

    // ROLES
    address public marketMaker;     // EOA allowed to create sell intents
    address public multisigWallet;  // solver multisig (for HTLC ops)
    address public htlcAddress;

    // --- Modifiers ---
    modifier onlyMultisig() {
        require(msg.sender == multisigWallet, "Only multisig wallet can call");
        _;
    }

    modifier onlyMarketMaker() {
        require(msg.sender == marketMaker, "Only market maker");
        _;
    }

    // --- Events ---
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
        uint256 locktime,
        uint256 timestamp
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
    event MarketMakerUpdated(address oldAddress, address newAddress);
    event MultisigWalletUpdated(address oldWallet, address newWallet);
    event HTLCAddressUpdated(address oldAddress, address newAddress);

    // --- Setters ---
    function setMarketMaker(address _mm) external onlyOwner {
        require(_mm != address(0), "Invalid marketMaker");
        emit MarketMakerUpdated(marketMaker, _mm);
        marketMaker = _mm;
    }

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

    // --- Create intents ---
    function createBuyIntent(
        uint256 sellAmount,     // BTC (sats)
        uint256 minBuyAmount,   // ETH (wei)
        uint256 locktime,
        bytes32 offchainId,
        uint256 slippage
    ) external returns (uint256) {
        require(sellAmount > 0, "Sell amount must be positive");
        require(locktime > block.timestamp, "Locktime must be in the future");
        require(slippage <= 100, "Invalid slippage");

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

        emit BuyIntentCreated(id, msg.sender, sellAmount, minBuyAmount, locktime, offchainId);
        return id;
    }

    function createSellIntent(
        uint256 sellAmount,     // ETH (wei)
        uint256 minBuyAmount,   // BTC (sats)
        uint256 deadline,
        bytes32 offchainId
    ) external onlyMarketMaker returns (uint256) {
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

        emit SellIntentCreated(id, msg.sender, sellAmount, minBuyAmount, deadline, offchainId);
        return id;
    }

    // --- Matching (supports partial fills across multiple sell intents) ---
    function matchIntent(uint256 buyIntentId) external nonReentrant {
        BuyIntent storage buy = buyIntents[buyIntentId];
        require(buy.status == IntentStatus.Pending, "BuyIntent not pending");
        require(block.timestamp <= buy.locktime, "BuyIntent expired");

        // expectedRate = ETH/BTC (scaled by 1e18)
        uint256 expectedRate = (buy.minBuyAmount * 1e18) / buy.sellAmount;
        uint256 lowerBoundRate = (expectedRate * (100 - buy.slippage)) / 100;
        uint256 upperBoundRate = expectedRate;

        // Collect candidate sell intents that satisfy the buyer's slippage bounds
        RateEntry[] memory candidates = new RateEntry[](intentCountSell);
        uint256 count = 0;

        for (uint256 i = 0; i < intentCountSell; i++) {
            SellIntent storage sell = sellIntents[i];
            if (sell.status != IntentStatus.Pending || block.timestamp > sell.deadline) continue;

            // sellRate = ETH/BTC (scaled by 1e18) from seller's quoted amounts
            // ETH per BTC = sell.sellAmount / sell.minBuyAmount
            uint256 sellRate = (sell.sellAmount * 1e18) / sell.minBuyAmount;

            if (sellRate >= lowerBoundRate && sellRate <= upperBoundRate) {
                candidates[count++] = RateEntry(i, sellRate);
            }
        }

        require(count > 0, "No matching sell intents found");

        // Sort candidates by highest rate (least favorable to buyer within tolerance)
        for (uint256 i = 0; i < count; i++) {
            for (uint256 j = i + 1; j < count; j++) {
                if (candidates[j].rate > candidates[i].rate) {
                    RateEntry memory tmp = candidates[i];
                    candidates[i] = candidates[j];
                    candidates[j] = tmp;
                }
            }
        }

        uint256 remainingBTC = buy.sellAmount; // sats
        uint256 totalETHPaid = 0;              // wei

        for (uint256 i = 0; i < count && remainingBTC > 0; i++) {
            SellIntent storage sell = sellIntents[candidates[i].index];

            // Seller capacity in BTC (sats)
            uint256 sellerCapBTC = sell.minBuyAmount;

            // BTC we can match (sats)
            uint256 matchedBTC = remainingBTC < sellerCapBTC ? remainingBTC : sellerCapBTC;

            // ETH (wei) for that BTC using ETH/BTC ratio: sellETH / sellBTC
            uint256 matchedETH = (sell.sellAmount * matchedBTC) / sell.minBuyAmount;

            // Record trade
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
                buy.locktime,
                block.timestamp
            );

            // Update seller (partial or filled), preserving units
            if (matchedBTC == sell.minBuyAmount) {
                sell.status = IntentStatus.Filled;
                sell.minBuyAmount = 0; // BTC remaining
                sell.sellAmount   = 0; // ETH remaining
            } else {
                sell.minBuyAmount -= matchedBTC; // BTC (sats)
                sell.sellAmount   -= matchedETH; // ETH (wei)
            }

            remainingBTC -= matchedBTC;   // sats
            totalETHPaid += matchedETH;   // wei
        }

        // Update buyer
        if (remainingBTC == 0) {
            buy.status = IntentStatus.Filled;
        } else if (remainingBTC < buy.sellAmount) {
            buy.status = IntentStatus.Partial;
            buy.sellAmount   = remainingBTC;   // sats still to fill
            buy.minBuyAmount -= totalETHPaid;  // wei still expected
        }
    }

    // --- HTLC (solver multisig only) ---
    function associateHTLC(
        uint256 buyIntentId,
        bytes32 lockId,
        address recipient,
        bytes32 secretHash
    ) external onlyMultisig {
        emit HTLCAssociated(buyIntentId, lockId, recipient, secretHash);
    }

    // --- Getters ---
    function getBuyIntent(uint256 id) external view returns (BuyIntent memory) {
        return buyIntents[id];
    }

    function getSellIntent(uint256 id) external view returns (SellIntent memory) {
        return sellIntents[id];
    }

    function getMatchedTrade(uint256 id) external view returns (MatchedTrade memory) {
        return matchedTrades[id];
    }
}
