#!/bin/bash

cd "$(dirname "$0")"

TARGET=static/abis.js

echo "// generate abi" > $TARGET

echo "window.abis = {}" >> $TARGET

for file in Controller PriceOracle StakingRewards IUniswapV2Pair IERC20
do
    echo "process $file.json..."
    echo -n "window.abis.$file = " >> $TARGET
    more ../contracts/abis/$file.json >> $TARGET
    echo "" >> $TARGET
done

echo -n "window.addresses = " >> $TARGET
more ../deploy/contracts.json >> $TARGET
