
# Record start time
start_time=$(date +%s%3N)
echo "Start time: $start_time"

echo "Generating payment message with secret and OP_RETURN..."
cd src/payment-channel
go run main.go generate-message

echo "Verifying OP_RETURN content and checking signature..."
go run main.go verify-opreturn ../../data-script/payment_message.json ../../data-script/payment_opreturn.txt

echo "Creating Bitcoin HTLC contract from extracted info..."
cd ../htlc/create-htlc
go run *.go

echo "Funding the Bitcoin HTLC..."
cd ../fund
go run *.go

echo "Waiting for funds to be mined into the HTLC (60 seconds)..."
sleep 60

echo "Scanning HTLC address to collect UTXO data..."
cd ../scan-htlc
go run *.go

echo "Creating redeem transaction to claim HTLC output..."
cd ../create-redeem
go run *.go

echo "Signing the redeem transaction with secret and private key..."
cd ../sign-redeem
go run *.go

echo "Workflow completed. You can now broadcast the signed transaction manually."

# Record end time in milliseconds
end_time=$(date +%s%3N)

# Calculate elapsed time in milliseconds
elapsed_ms=$((end_time - start_time))

# Convert to seconds and milliseconds
seconds=$((elapsed_ms / 1000))
milliseconds=$((elapsed_ms % 1000))

echo ""
echo "Script completed in ${seconds}.${milliseconds} seconds."