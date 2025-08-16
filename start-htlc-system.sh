#!/bin/bash

# HTLC System Startup Script
# This script starts both the backend API and frontend UI

echo "🚀 Starting Intent-centric DEX with HTLC Integration"
echo "=================================================="

# Check if node modules exist
if [ ! -d "front-end/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd front-end && npm install && cd ..
fi

if [ ! -f "my-solidity-project/node_modules/express/package.json" ]; then
    echo "📦 Installing backend dependencies..."
    cd my-solidity-project
    npm install express cors ethers nodemon
    cd ..
fi

echo "🔧 Starting Hardhat local node..."
cd my-solidity-project
npx hardhat node --port 8545 &
HARDHAT_PID=$!
cd ..

echo "⏳ Waiting for Hardhat node to start..."
sleep 5

echo "🌐 Starting HTLC API server (localhost:3001)..."
cd my-solidity-project
node htlc-api-server.js &
API_PID=$!
cd ..

echo "⏳ Waiting for API server to start..."
sleep 3

echo "🎨 Starting Frontend UI (localhost:5173)..."
cd front-end
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ All services started successfully!"
echo ""
echo "🌐 Access Points:"
echo "   Frontend UI:    http://localhost:5173"
echo "   API Server:     http://localhost:3001"
echo "   Hardhat Node:   http://localhost:8545"
echo ""
echo "📋 Quick Start Guide:"
echo "   1. Open http://localhost:5173"
echo "   2. Click 'Connect' and choose User/MM role"
echo "   3. Navigate to 'HTLCs' tab"
echo "   4. Follow the setup workflow: Deploy → Fund → Create → View"
echo ""
echo "🛑 To stop all services: Ctrl+C or run 'kill $HARDHAT_PID $API_PID $FRONTEND_PID'"

# Trap Ctrl+C and cleanup
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $HARDHAT_PID $API_PID $FRONTEND_PID 2>/dev/null
    wait
    echo "✅ All services stopped"
    exit 0
}

trap cleanup SIGINT

# Wait for any process to exit
wait
