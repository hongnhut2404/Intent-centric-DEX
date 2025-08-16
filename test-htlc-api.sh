#!/bin/bash

# HTLC API Demo Script
# This script demonstrates the backend API endpoints

API_BASE="http://localhost:3001"

echo "🧪 HTLC API Demo - Testing Backend Endpoints"
echo "============================================"

echo ""
echo "1️⃣  Checking API Health..."
curl -s "$API_BASE/health" | jq '.' || echo "❌ API not responding"

echo ""
echo "2️⃣  Getting HTLC System Status..."
curl -s "$API_BASE/api/htlc/status" | jq '.' || echo "❌ Status endpoint failed"

echo ""
echo "3️⃣  Viewing Current HTLCs..."
curl -s "$API_BASE/api/htlc/view" | jq '.' || echo "❌ View endpoint failed"

echo ""
echo "4️⃣  Testing HTLC Deployment (POST)..."
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"bytecode":""}' \
  "$API_BASE/api/htlc/deploy" | jq '.' || echo "❌ Deploy endpoint failed"

echo ""
echo "5️⃣  Testing Fund Multisig (POST)..."
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"amount":"100.0"}' \
  "$API_BASE/api/htlc/fund" | jq '.' || echo "❌ Fund endpoint failed"

echo ""
echo "6️⃣  Testing Create HTLC (POST)..."
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"buyIntentId":0}' \
  "$API_BASE/api/htlc/create" | jq '.' || echo "❌ Create endpoint failed"

echo ""
echo "✅ API Demo Complete!"
echo ""
echo "💡 Tips:"
echo "   • Make sure the API server is running: node htlc-api-server.js"
echo "   • Ensure Hardhat local node is running on port 8545"
echo "   • Deploy IntentMatching contract first for proper testing"
echo "   • Check browser Network tab for real-time API calls from UI"
