# Script to generate a new block every minute
# Put this script at the root of your unpacked folder
#!/bin/bash

address=`./bin/bitcoin-cli getnewaddress` 

echo "Address of mining wallet:"
echo $address > mineraddress.txt

sleep 2
echo "Generating a block every minute. Press [CTRL+C] to stop.."

while :
do
        echo "Generate a new block `date '+%d/%m/%Y %H:%M:%S'`"
        ./bin/bitcoin-cli generatetoaddress 1 $address
        sleep 60
done
