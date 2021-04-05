const
    STATUS_NORMAL = 0,
    STATUS_ABOVE = 1,
    STATUS_BELOW = 2,
    STATUS_DEEP_BELOW = 3,
    STATUS_LIQUIDATION = 4,
    BN_0 = ethers.utils.parseUnits("0", 18),
    BN_1 = ethers.utils.parseUnits("1", 18),
    BN_1000 = ethers.utils.parseUnits("1000", 18),
    BN_0_95 = ethers.utils.parseUnits("0.95", 18),
    BN_0_5 = ethers.utils.parseUnits("0.5", 18),
    BN_0_1 = ethers.utils.parseUnits("0.1", 18),
    BN_MAX = ethers.constants.MaxUint256.div("16");

const network = {
    name: NETWORK_NAME,
    chainId: CHAIN_ID,
    scan: SCAN,
    swap: SWAP,
    swapName: SWAP_NAME,
};

const cashToken = {
    contract: null, // attach later when vue mounted
    address: window.addresses[network.name]["cash"],
    symbol: 'FDC',
    decimals: 18,
    totalSupply: NaN, // update by timer
    price: NaN, // update by timer
    oraclePrice: NaN, // update by timer
};

const shareToken = {
    contract: null, // attach later when vue mounted
    address: window.addresses[network.name]["share"],
    symbol: 'FDS',
    decimals: 18,
    totalSupply: NaN, // update by timer
    holdByCashDaiLpStaking: NaN, // update by timer
    holdByShareDaiLpStaking: NaN, // update by timer
    price: NaN, // update by timer
};

const daiToken = {
    contract: null, // attach later when vue mounted
    address: window.addresses[network.name]["dai"],
    symbol: 'DAI',
    decimals: 18,
    reserves: NaN, // update by timer
    investment: NaN, // update by timer
};

const cashDaiLpToken = {
    address: window.addresses[network.name]["uniCashDaiPair"],
    contract: null, // attach later when vue mounted
    token0: null, // set to 'cash' or 'dai' later after load contract
    token1: null, // set to 'cash' or 'dai' later after load contract
    tvl: NaN, // update by timer
    symbol: 'FDC-DAI-LP',
    decimals: 18,
    totalSupply: NaN,
};

const shareDaiLpToken = {
    address: window.addresses[network.name]["uniShareDaiPair"],
    contract: null, // attach later when vue mounted
    token0: null, // set to 'share' or 'dai' later after load contract
    token1: null, // set to 'share' or 'dai' later after load contract
    tvl: NaN, // update by timer
    symbol: 'FDS-DAI-LP',
    decimals: 18,
    totalSupply: NaN,
};

const cashDaiLpStaking = {
    contract: null, // attach later when vue mounted
    address: window.addresses[network.name]["cashDaiLpStaking"],
    totalSupply: NaN,
};

const shareDaiLpStaking = {
    contract: null, // attach later when vue mounted
    address: window.addresses[network.name]["shareDaiLpStaking"],
    totalSupply: NaN,
};

const formatters = {
    formatTime: function (seconds) {
        if (isNaN(seconds)) {
            return '-';
        }
        let h, m, s, r = '';
        h = parseInt(seconds / 3600);
        seconds = seconds - h * 3600;
        m = parseInt(seconds / 60);
        s = seconds - m * 60;
        if (h > 0) {
            r = r + h + 'h';
        }
        return r + m + 'm' + s + 's';

    },
    formatPrice: function (price, decimalsIfBN) {
        if (price === undefined) {
            return '-';
        }
        if (price instanceof ethers.BigNumber) {
            price = ethers.utils.formatUnits(price, decimalsIfBN || 18);
            price = parseFloat(price);
        }
        if (isNaN(price)) {
            return "-";
        }
        return price.toFixed(3);
    },
    formatQty: function (qty, decimalsIfBN) {
        if (qty === undefined) {
            return '-';
        }
        if (qty instanceof ethers.BigNumber) {
            qty = ethers.utils.formatUnits(qty, decimalsIfBN || 18);
            qty = parseFloat(qty);
        }
        if (isNaN(qty)) {
            return "-";
        }
        return parseInt(qty).toLocaleString();
    },
    formatQty3: function (qty, decimalsIfBN) {
        if (qty === undefined) {
            return '-';
        }
        if (qty instanceof ethers.BigNumber) {
            qty = ethers.utils.formatUnits(qty, decimalsIfBN || 18);
            qty = parseFloat(qty);
        }
        if (isNaN(qty)) {
            return "-";
        }
        return parseFloat(qty).toFixed(3);
    },
    formatPercent: function (p) {
        if (p === undefined || isNaN(p)) {
            return "-";
        }
        let x = p / 100;
        if (x >= 1) {
            return x.toFixed(1);
        }
        if (x >= 0.1) {
            return x.toFixed(2);
        }
        return x.toFixed(3);
    },
};

function bn2number(bn) {
    return parseFloat(ethers.utils.formatUnits(bn, 18));
}

function str2bn(str) {
    return ethers.utils.parseUnits(str, 18);
}

function num2bn(num) {
    if (isNaN(num)) {
        return BN_0;
    }
    return ethers.utils.parseUnits(String(num), 18);
}

function addressEquals(addr0, addr1) {
    return addr0.toLowerCase() === addr1.toLowerCase();
}

// set token0 / token1 for Xyz/Dai pair:
async function _detectXyzDaiLpPair(xyzDaiLpToken, daiToken, xyzName) {
    if (xyzDaiLpToken.token0 === null) {
        let
            t0address = await xyzDaiLpToken.contract.token0(),
            isDaiAddress = addressEquals(t0address, daiToken.address);
        xyzDaiLpToken.token0 = isDaiAddress ? 'dai' : xyzName;
        console.log('set ' + xyzName + '-dai-lp token0 = ' + xyzDaiLpToken.token0);
    }
    if (xyzDaiLpToken.token1 === null) {
        let
            t1address = await cashDaiLpToken.contract.token1(),
            isDaiAddress = addressEquals(t1address, daiToken.address);
        xyzDaiLpToken.token1 = isDaiAddress ? 'dai' : xyzName;
        console.log('set ' + xyzName + '-dai-lp token1 = ' + xyzDaiLpToken.token1);
    }
}

// get price and tvl of uni pair, return [price, tvl]:
async function getPriceAndTvlByLP(lpToken, daiToken, anotherTokenName) {
    await _detectXyzDaiLpPair(lpToken, daiToken, anotherTokenName);
    let
        reserves = await lpToken.contract.getReserves(),
        reserve0 = reserves[0],
        reserve1 = reserves[1];
    console.log('get ' + anotherTokenName + ' price by LP...');
    let price = (lpToken.token0 === 'dai') ? reserve0.mul(BN_1000).div(reserve1) : reserve1.mul(BN_1000).div(reserve0);
    let tvl = (lpToken.token0 === 'dai') ? reserve0.mul(2) : reserve1.mul(2);
    let r = [bn2number(price) / 1000, tvl];
    console.log(anotherTokenName + ' price = ' + r[0] + ', tvl = ' + r[1]);
    return r;
}

// get oracle price:
async function getCashOraclePrice(priceOracleContract, cashDaiLpToken, cashToken, daiToken) {
    await _detectXyzDaiLpPair(cashDaiLpToken, daiToken, 'cash');
    let
        lastPrice = await priceOracleContract.consult(cashToken.address, BN_1),
        reserves = await cashDaiLpToken.contract.getReserves(),
        price0CumLast = await cashDaiLpToken.contract.price0CumulativeLast(),
        price1CumLast = await cashDaiLpToken.contract.price1CumulativeLast(),
        reserve0 = reserves[0],
        reserve1 = reserves[1],
        timestamp = reserves[2];
    console.log(lastPrice);
    console.log(reserves);
    if (cashDaiLpToken.token0 === 'cash') {
        // 
    } else {
        //
    }
    let price = lastPrice;
    console.log("fetched oracle price: " + bn2number(price) + " / BN = ", lastPrice);
    return price;
}

function getWeb3Provider() {
    if (window.ethereum) {
        return new ethers.providers.Web3Provider(window.ethereum, "any");
    }
    console.error("there is no web3 provider.");
    return null;
}

function initApp() {
    $("[data-toggle=tooltip]").tooltip();
    console.log("init app...");
    const web3provider = getWeb3Provider();
    window.vm = new Vue({
        el: "#app",
        data: {
            provider: web3provider,
            network: network,
            wallet: {
                installed:
                    web3provider !== null &&
                    web3provider.connection &&
                    web3provider.connection.url === "metamask",
                account: null,
                chainId: "",
            },
            tokens: {
                cash: cashToken,
                share: shareToken,
                dai: daiToken,
                cashDaiLp: cashDaiLpToken,
                shareDaiLp: shareDaiLpToken,
            },
            staking: {
                cashDaiLpStaking: cashDaiLpStaking,
                shareDaiLpStaking: shareDaiLpStaking,
            },
            controller: {
                status: NaN,
                quota: 0
            },
            // BN of balances:
            balances: {
                cash: NaN,
                share: NaN,
                dai: NaN,
                cashDaiLp: NaN,
                shareDaiLp: NaN,
                stakedCashDaiLp: NaN,
                stakedShareDaiLp: NaN,
            },
            // form operations:
            forms: {
                mintCash: 0,
            },
            priceOracle: {
                contract: null,
                period: NaN,
                blockTimestampLast: NaN,
                now: parseInt(Date.now() / 1000),
            },
            timerEnabled: true
        },
        computed: {
            periodElapsedPercent: function () {
                let
                    period = this.priceOracle.period,
                    start = this.priceOracle.blockTimestampLast,
                    end = start + period,
                    now = this.priceOracle.now;
                if (isNaN(period) || isNaN(start) || isNaN(end)) {
                    return 0;
                }
                if (now < start) {
                    return 0;
                }
                if (now > end) {
                    return 100;
                }
                return parseInt((now - start) * 100 / period);
            },
            periodElapsedTime: function () {
                let
                    period = this.priceOracle.period,
                    start = this.priceOracle.blockTimestampLast,
                    end = start + period,
                    now = this.priceOracle.now;
                if (isNaN(period) || isNaN(start) || isNaN(end)) {
                    return NaN;
                }
                if (now < start) {
                    return 0;
                }
                if (now > end) {
                    return period;
                }
                return parseInt(now - start);
            },
            periodRemainingTime: function () {
                let
                    period = this.priceOracle.period,
                    elapsed = this.periodElapsedTime;
                return period - elapsed;
            },
            shareCirculatingSupply: function () {
                if (isNaN(this.tokens.share.totalSupply) || isNaN(this.tokens.share.holdByCashDaiLpStaking)) {
                    return NaN;
                }
                let t = this.tokens.share.totalSupply.sub(this.tokens.share.holdByCashDaiLpStaking);
                if (!isNaN(this.tokens.share.holdByShareDaiLpStaking)) {
                    t = t.sub(this.tokens.share.holdByShareDaiLpStaking);
                }
                return t;
            },
            reservesPerCash: function () {
                let
                    r = this.tokens.dai.reserves,
                    i = this.tokens.dai.investment,
                    t = this.tokens.cash.totalSupply;
                if (isNaN(r) || isNaN(i) || isNaN(t)) {
                    return NaN;
                }
                return (bn2number(r) + bn2number(i)) / bn2number(t);
            },
            spendDaiWhenMintCash: function () {
                let a = this.forms.mintCash;
                return a / 2;
            },
            spendShareWhenMintCash: function () {
                let
                    p = this.tokens.share.price,
                    a = this.forms.mintCash;
                if (isNaN(p)) {
                    return NaN;
                }
                return a * 0.5 / p;
            },
            swapCashDaiUrl: function () {
                return this.network.swap + '/#/swap?inputCurrency=' + this.tokens.dai.address + '&outputCurrency=' + this.tokens.cash.address;
            },
            swapShareDaiUrl: function () {
                return this.network.swap + '/#/swap?inputCurrency=' + this.tokens.dai.address + '&outputCurrency=' + this.tokens.share.address;
            },
            addCashDaiLiqUrl: function () {
                return this.network.swap + '/#/add/' + this.tokens.dai.address + '/' + this.tokens.cash.address;
            },
            addShareDaiLiqUrl: function () {
                return this.network.swap + '/#/add/' + this.tokens.dai.address + '/' + this.tokens.share.address;
            },
            installWallet: function () {
                return this.provider === null;
            },
            ready: function () {
                return (
                    this.wallet.installed &&
                    this.wallet.chainId === this.network.chainId &&
                    this.wallet.account !== null
                );
            },
            // status: no cash price, above water, in the shallow, in the deep and dead:
            statusNoCashPrice: function () {
                return isNaN(this.controller.status);
            },
            statusAboveWater: function () {
                return this.controller.status === STATUS_ABOVE;
            },
            statusStable: function () {
                return this.controller.status === STATUS_NORMAL;
            },
            statusInShallow: function () {
                return this.controller.status === STATUS_BELOW;
            },
            statusInDeep: function () {
                return this.controller.status === STATUS_DEEP_BELOW;
            },
            statusDead: function () {
                return this.controller.status === STATUS_LIQUIDATION;
            },
            flyHeight: function () {
                let p = this.tokens.cash.oraclePrice;
                if (isNaN(p)) {
                    return 100;
                }
                let n = parseInt(bn2number(p) * 100);
                return n > 200 ? 200 : n;
            }
        },
        filters: {
            time: formatters.formatTime,
            price: formatters.formatPrice,
            qty: formatters.formatQty,
            qty3: formatters.formatQty3,
            percent: formatters.formatPercent,
        },
        methods: {
            async mintCash() {
                let
                    that = this,
                    controllerAddress = this.getContractAddress('Controller'),
                    controllerContract = this.loadContract('Controller'),
                    mintAmount = this.forms.mintCash,
                    bnMintAmount = num2bn(mintAmount);
                console.log('prepare mint ' + mintAmount + ' cash...');
                if (mintAmount <= 0) {
                    return;
                }
                if (!this.ready) {
                    this.showAlert('Wallet Not Ready', 'Please connect wallet to correct network first.');
                    return;
                }
                let afn = async function (setMessage, setError) {
                    setMessage('Prepare Mint Cash', 'Prepare mint cash...');
                    let approvedDai = await that.tokens.dai.contract.allowance(that.wallet.account, controllerAddress);
                    if (approvedDai.lt(bnMintAmount)) {
                        setMessage('Approve Spent DAI', 'Please approve the fodiator.cash to spent your DAI in wallet.')
                        let tx1 = await that.tokens.dai.contract.approve(controllerAddress, BN_MAX);
                        setMessage('Approve Spent DAI', 'Waiting for blockchain confirm...');
                        await tx1.wait(1);
                    }
                    setMessage('Mint Cash', 'Please confirm "mintCash" operation in wallet.');
                    let fromBlock = await that.provider.getBlockNumber();
                    console.log('will query from block ' + fromBlock + '...');
                    let tx2 = await controllerContract.mintCash(bnMintAmount, parseInt(Date.now() / 1000 + 120));
                    setMessage('Mint Cash', 'Waiting for blockchain confirm...');
                    await tx2.wait(1);
                    console.log(tx2);
                    // query log:
                    setMessage('Mint Cash', 'Query transaction logs...');
                    let logs = await controllerContract.queryFilter(controllerContract.filters.MintCash, fromBlock, 'latest');
                    let log = logs[0];
                    setMessage('Mint Cash', 'You have successfully spent ' +
                        formatters.formatQty3(log.args[1]) + ' DAI and ' +
                        formatters.formatQty3(log.args[2]) + ' Share, and minted ' +
                        formatters.formatQty3(log.args[3]) + ' Cash.');
                    return true;
                };
                this.invokeWallet(afn);
            },
            async stakeCashDaiLp() {
                await this._stake(this.balances.cashDaiLp, this.tokens.cashDaiLp, this.staking.cashDaiLpStaking);
                this.balances.cashDaiLp = NaN;
                this.balances.stakedCashDaiLp = NaN;
                this.balances.unclaimedCashDaiLpReward = NaN;
                this.tokens.cashDaiLp.totalSupply = NaN;
            },
            async stakeShareDaiLp() {
                await this._stake(this.balances.shareDaiLp, this.tokens.shareDaiLp, this.staking.shareDaiLpStaking);
                this.balances.shareDaiLp = NaN;
                this.balances.stakedShareDaiLp = NaN;
                this.balances.unclaimedShareDaiLpReward = NaN;
                this.tokens.shareDaiLp.totalSupply = NaN;
            },
            async unstakeCashDaiLp() {
                await this._unstake(this.balances.stakedCashDaiLp, this.tokens.cashDaiLp, this.staking.cashDaiLpStaking);
                this.balances.cashDaiLp = NaN;
                this.balances.stakedCashDaiLp = NaN;
                this.balances.unclaimedCashDaiLpReward = NaN;
            },
            async unstakeShareDaiLp() {
                await this._unstake(this.balances.stakedShareDaiLp, this.tokens.shareDaiLp, this.staking.shareDaiLpStaking);
                this.balances.shareDaiLp = NaN;
                this.balances.stakedShareDaiLp = NaN;
                this.balances.unclaimedShareDaiLpReward = NaN;
            },
            async claimCashDaiLpReward() {
                await this._claim(this.tokens.cashDaiLp, this.tokens.share, this.staking.cashDaiLpStaking);
                this.balances.unclaimedCashDaiLpReward = NaN;
            },
            async claimShareDaiLpReward() {
                await this._claim(this.tokens.shareDaiLp, this.tokens.share, this.staking.shareDaiLpStaking);
                this.balances.unclaimedShareDaiLpReward = NaN;
            },
            async _stake(amount, lpToken, staking) {
                if (!this.ready) {
                    this.showAlert('Wallet Not Ready', 'Please connect wallet to correct network first.');
                    return;
                }
                let that = this;
                console.log('stake ' + lpToken.symbol + '...');
                let afn = async function (setMessage, setError) {
                    setMessage('Prepare Stake', 'Prepare stake ' + lpToken.symbol + '...');
                    let approvedLp = await lpToken.contract.allowance(that.wallet.account, staking.address);
                    if (approvedLp.lt(amount)) {
                        setMessage('Approve Spent ' + lpToken.symbol, 'Please approve the fodiator.cash to spent your ' + lpToken.symbol + ' in wallet.')
                        let tx1 = await lpToken.contract.approve(staking.address, BN_MAX);
                        setMessage('Approve Spent ' + lpToken.symbol, 'Waiting for blockchain confirm...');
                        await tx1.wait(1);
                    }
                    setMessage('Stake ' + lpToken.symbol, 'Please confirm "stake" operation in wallet.');
                    let tx2 = await staking.contract.stake(amount);
                    setMessage('Stake ' + lpToken.symbol, 'Waiting for blockchain confirm...');
                    await tx2.wait(1);
                    setMessage('Stake ' + lpToken.symbol, 'You have successfully staked ' + formatters.formatQty3(amount) + ' ' + lpToken.symbol + '.');
                    return true;
                };
                this.invokeWallet(afn);
            },
            async _unstake(amount, lpToken, staking) {
                console.log('unstake ' + lpToken.symbol + ': amount = ', amount);
                if (!this.ready) {
                    this.showAlert('Wallet Not Ready', 'Please connect wallet to correct network first.');
                    return;
                }
                if (amount.isZero()) {
                    console.error('skip unstake for amount = 0.');
                    return true;
                }
                let that = this;
                let afn = async function (setMessage, setError) {
                    setMessage('Unstake ' + lpToken.symbol, 'Please confirm "unstake" operation in wallet.');
                    let tx = await staking.contract.exit();
                    setMessage('Unstake ' + lpToken.symbol, 'Waiting for blockchain confirm...');
                    await tx.wait(1);
                    setMessage('Unstake ' + lpToken.symbol, 'You have successfully unstaked ' + formatters.formatQty3(amount) + ' ' + lpToken.symbol + '.');
                    return true;
                };
                this.invokeWallet(afn);
            },
            async _claim(lpToken, rewardToken, staking) {
                console.log('claim ' + rewardToken.symbol + '...');
                if (!this.ready) {
                    this.showAlert('Wallet Not Ready', 'Please connect wallet to correct network first.');
                    return;
                }
                let that = this;

                let afn = async function (setMessage, setError) {
                    setMessage('Claim Reward', 'Claim reward...');
                    let fromBlock = await that.provider.getBlockNumber();
                    console.log('will query from block ' + fromBlock + '...');
                    let tx = await staking.contract.getReward();
                    await tx.wait(1);
                    console.log(tx);
                    // query log:
                    setMessage('Claim Reward', 'Query transaction logs...');
                    let logs = await staking.contract.queryFilter(staking.contract.filters.RewardPaid, fromBlock, 'latest');
                    let log = logs[0];
                    setMessage('Claim Reward', 'You have successfully claimed ' +
                        formatters.formatQty3(log.args[1]) + ' Share.');
                    return true;
                };
                this.invokeWallet(afn);
            },
            isZero(n) {
                if (isNaN(n)) {
                    return true;
                }
                if (n instanceof ethers.BigNumber) {
                    return n.isZero();
                }
                if (typeof (n) === 'string') {
                    n = parseFloat(n);
                }
                return n === 0;
            },
            percent(n, total) {
                if (isNaN(n) || isNaN(total)) {
                    return '-';
                }
                console.log(n);
                console.log(total);
                if (n.isZero()) {
                    return BN_0;
                }
                let
                    fn = bn2number(n),
                    ft = bn2number(total),
                    r = fn * 100 / ft;
                return r;
            },
            async onTimer(updateSlowerChange) {
                console.log('timer triggered (' + updateSlowerChange + ')...');
                if (!this.timerEnabled) {
                    console.warn('skip update for timer is not enabled.');
                    return;
                }
                this.priceOracle.now = parseInt(Date.now() / 1000);
                if (!this.ready) {
                    console.error('skip update for wallet is not ready.');
                    return;
                }
                let
                    priceOracle = this.loadContract('PriceOracle'),
                    controller = this.loadContract('Controller'),
                    cashDaiPair = this.loadContract('IUniswapV2Pair', this.getContractAddress('uniCashDaiPair')),
                    uniSharePair = this.loadContract('IUniswapV2Pair', this.getContractAddress('uniShareDaiPair'));

                // get oracle price:
                this.tokens.cash.oraclePrice = await getCashOraclePrice(priceOracle, this.tokens.cashDaiLp, this.tokens.cash, this.tokens.dai);
                // get status and quota:
                console.log('query status & quota...');
                let status0 = await controller.status0();
                this.controller.status = status0[0];
                this.controller.quota = bn2number(status0[1]);
                console.log('quota from status0() = ' + this.controller.quota + ', quota = ' + this.controller.quota);

                // update account balance:
                this.balances.eth = await this.provider.getBalance(this.wallet.account);
                this.balances.cash = await this.tokens.cash.contract.balanceOf(this.wallet.account);
                this.balances.share = await this.tokens.share.contract.balanceOf(this.wallet.account);
                this.balances.dai = await this.tokens.dai.contract.balanceOf(this.wallet.account);
                this.balances.cashDaiLp = await this.tokens.cashDaiLp.contract.balanceOf(this.wallet.account);
                this.balances.shareDaiLp = await this.tokens.shareDaiLp.contract.balanceOf(this.wallet.account);
                this.balances.stakedCashDaiLp = await this.staking.cashDaiLpStaking.contract.balanceOf(this.wallet.account);
                this.balances.unclaimedCashDaiLpReward = await this.staking.cashDaiLpStaking.contract.earned(this.wallet.account);
                this.balances.stakedShareDaiLp = await this.staking.shareDaiLpStaking.contract.balanceOf(this.wallet.account);
                this.balances.unclaimedShareDaiLpReward = await this.staking.shareDaiLpStaking.contract.earned(this.wallet.account);
                if (updateSlowerChange || isNaN(this.tokens.cash.totalSupply)) {
                    this.tokens.cash.totalSupply = await this.tokens.cash.contract.totalSupply();
                }
                if (updateSlowerChange || isNaN(this.tokens.share.totalSupply)) {
                    this.tokens.share.totalSupply = await this.tokens.share.contract.totalSupply();
                }
                if (updateSlowerChange || isNaN(this.tokens.dai.reserves)) {
                    this.tokens.dai.reserves = await this.tokens.dai.contract.balanceOf(this.getContractAddress('Controller'));
                    this.tokens.dai.investment = await controller.getReserved();
                }
                if (updateSlowerChange || isNaN(this.tokens.cash.price)) {
                    let pt = await getPriceAndTvlByLP(this.tokens.cashDaiLp, this.tokens.dai, 'cash');
                    this.tokens.cash.price = pt[0];
                    this.tokens.cashDaiLp.tvl = pt[1];
                }
                if (updateSlowerChange || isNaN(this.tokens.share.price)) {
                    let pt = await getPriceAndTvlByLP(this.tokens.shareDaiLp, this.tokens.dai, 'share');
                    this.tokens.share.price = pt[0];
                    this.tokens.shareDaiLp.tvl = pt[1];
                }
                if (updateSlowerChange || isNaN(this.staking.cashDaiLpStaking.totalSupply)) {
                    this.staking.cashDaiLpStaking.totalSupply = await this.staking.cashDaiLpStaking.contract.totalSupply();
                    this.tokens.share.holdByCashDaiLpStaking = await this.tokens.share.contract.balanceOf(this.staking.cashDaiLpStaking.address);
                }
                if (updateSlowerChange || isNaN(this.staking.shareDaiLpStaking.totalSupply)) {
                    this.staking.shareDaiLpStaking.totalSupply = await this.staking.shareDaiLpStaking.contract.totalSupply();
                    this.tokens.share.holdByShareDaiLpStaking = await this.tokens.share.contract.balanceOf(this.staking.shareDaiLpStaking.address);
                }
                if (isNaN(this.priceOracle.period)) {
                    this.priceOracle.period = parseInt((await this.priceOracle.contract.PERIOD()).toHexString(), 16);
                }
                if (updateSlowerChange || isNaN(this.priceOracle.blockTimestampLast)) {
                    this.priceOracle.blockTimestampLast = await this.priceOracle.contract.blockTimestampLast();
                }
            },
            /**
             * Invoke wallet to do async action. asyncAction is a async function that has signature:
             *
             * async function action(setMessage, setError) {
             *     setMessage('Begin', 'Please confirm in metamask...');
             *     try {
             *         let tx = await contract.approve(...);
             *         await tx.wait(0);
             *     } catch (err) {
             *         setError('Error', err.message);
             *         return false;
             *     }
             *     setMessage('Done', 'Transaction ok.');
             *     return true;
             * }
             */
            invokeWallet(asyncAction) {
                // 1. prepare modal:
                let m = $('#walletModal'),
                    close = m.find('.wallet-close'),
                    loadingIcon = m.find('.wallet-loading-icon'),
                    successIcon = m.find('.wallet-success-icon'),
                    errorIcon = m.find('.wallet-error-icon'),
                    setMessage = (title, message) => {
                        m.find('.wallet-title').text(title);
                        m.find('.wallet-message').text(message);
                        m.find('.wallet-error').text('');
                    },
                    setError = (title, message) => {
                        m.find('.wallet-title').text(title);
                        m.find('.wallet-message').text('');
                        m.find('.wallet-error').text(message);
                        loadingIcon.hide();
                        errorIcon.show();
                    };
                close.click(function () {
                    console.log('wallet dismissed.');
                    close.off('click');
                    m.modal('hide');
                });
                loadingIcon.show();
                errorIcon.hide();
                successIcon.hide();
                close.attr('disabled', 'disabled');
                m.modal({ backdrop: 'static' });
                asyncAction(setMessage, setError)
                    .then((result) => {
                        console.log('async wallet action return ' + result);
                        if (result) {
                            loadingIcon.hide();
                            successIcon.show();
                        } else {
                            loadingIcon.hide();
                            errorIcon.show();
                        }
                        close.removeAttr('disabled');
                    })
                    .catch((err) => {
                        // unexpected error:
                        console.error(err);
                        setError('Wallet Action Failed', err.message || err.code);
                        close.removeAttr('disabled');
                    });
            },
            // get contract address by name. All addresses are stored at window.addresses.<network>.
            getContractAddress(name) {
                let addrs = window.addresses[this.network.name],
                    addr = addrs[name];
                if (!addr) {
                    console.error('Contract address not found by name: ' + name);
                    throw new Error('Contract address not found by name: ' + name);
                }
                return addr;
            },
            // load contract by name and an optional address. If address is not present, try getContractAddress(name).
            loadContract(name, address) {
                if (!address) {
                    address = this.getContractAddress(name);
                }
                let abis = window.abis,
                    key = '_cached_' + name + '_' + address,
                    contract = abis[key];
                if (!contract) {
                    console.log('first time to load contract ' + name + ': ' + address);
                    let abi = abis[name];
                    if (!abi) {
                        console.error('Contract name found: ' + name);
                        throw new Error('Contract not found: ' + name);
                    }
                    contract = new ethers.Contract(
                        address,
                        abi,
                        this.provider.getSigner()
                    );
                    abis[key] = contract;
                    console.log('Contract ' + name + ' loaded ok: ' + address);
                }
                return contract;
            },
            openUrl(url) {
                console.log('open url: ' + url);
                window.open(url);
            },
            /**
             * Display an alert dialog. Callback is optional which is called after alert dismissed.
             */
            showAlert(title, msg, callback) {
                console.log('show alert...');
                let m = $('#alertModal');
                m.find('.alert-title').text(title);
                m.find('.alert-message').text(msg);
                m.find('.alert-close').click(function () {
                    console.log('alert dismissed.');
                    m.find('.alert-close').off('click');
                    m.modal('hide');
                    callback && callback();
                });
                m.modal({ backdrop: 'static' });
            },
            /**
             * Convert full address to abbr-address like '0x1A2B...5f6E'.
             */
            toAbbrAddress(addr) {
                try {
                    let s = ethers.utils.getAddress(addr);
                    return s.substring(0, 6) + '...' + s.substring(s.length - 4);
                } catch (err) {
                    return addr;
                }
            },
            /**
             * Invoke metamask.
             */
            async connectWallet() {
                try {
                    let accounts = await window.ethereum.request({
                        method: 'eth_requestAccounts',
                    });
                    this._onAccountChanged(accounts);
                    let chainId = await window.ethereum.request({ method: 'eth_chainId' });
                    this._onChainChanged(chainId);
                    window.ethereum.on('disconnect', this._onDisconnected);
                    window.ethereum.on('accountsChanged', this._onAccountChanged);
                    window.ethereum.on('chainChanged', this._onChainChanged);

                    this._triggerTimer();
                } catch (err) {
                    console.error(err);
                    this.showAlert('Could Not Connect Wallet', err.message || err.code);
                }
            },
            /**
             * Triggered when wallet disconnect the website.
             */
            _onDisconnected() {
                this.wallet.account = null;
                this.wallet.chainId = "";
                this._clearBalances();
            },
            /**
             * Triggered when wallet account changed.
             */
            _onAccountChanged(accounts) {
                console.log("wallet account changed.");
                console.log(accounts);
                if (accounts.length === 0) {
                    this._onDisconnected();
                } else {
                    this.wallet.account = accounts[0];
                    this._clearBalances();
                }
            },
            /**
             * Triggered when wallet chainId changed.
             */
            _onChainChanged(chainId) {
                console.log("wallet chainId changed: ", chainId);
                this.wallet.chainId = chainId;
                this._clearBalances();
            },
            /**
             * Timer trigger function that execute at a fixed delay of 30s.
             */
            _triggerTimer() {
                if (!window._triggerTimerCount) {
                    window._triggerTimerCount = 0;
                }
                window._triggerTimerCount++;
                let afn = this.onTimer(window._triggerTimerCount % 5 === 1);
                afn.then(() => {
                    console.log("timer ok, set next...");
                    setTimeout(() => this._triggerTimer(), 30000);
                })
                    .catch((err) => {
                        console.error(err);
                        setTimeout(() => this._triggerTimer(), 30000);
                    });
            },
            /**
             * Clear all balances of current account.
             */
            _clearBalances() {
                this.balances.eth = NaN;
                this.balances.cash = NaN;
                this.balances.share = NaN;
                this.balances.dai = NaN;
                this.balances.cashDaiLp = NaN;
                this.balances.shareDaiLp = NaN;
                this.balances.stakedCashDaiLp = NaN;
                this.balances.stakedShareDaiLp = NaN;
                this.balances.unclaimedCashDaiLpReward = NaN;
                this.balances.unclaimedShareDaiLpReward = NaN;
            },
            async syncTimestamp() {
                // @TODO sync timestamp
                return Math.floor(Date.now() / 1000);
            },
        },
        mounted: async function () {
            console.log("vue mounted ok.");
            $("[data-toggle=tooltip]").tooltip();
            // attach ERC20 contract:
            this.tokens.cash.contract = this.loadContract('IERC20', this.tokens.cash.address);
            this.tokens.share.contract = this.loadContract('IERC20', this.tokens.share.address);
            this.tokens.dai.contract = this.loadContract('IERC20', this.tokens.dai.address);
            this.tokens.cashDaiLp.contract = this.loadContract("IUniswapV2Pair", this.tokens.cashDaiLp.address);
            this.tokens.shareDaiLp.contract = this.loadContract('IUniswapV2Pair', this.tokens.shareDaiLp.address);
            this.staking.cashDaiLpStaking.contract = this.loadContract('StakingRewards', this.staking.cashDaiLpStaking.address);
            this.staking.shareDaiLpStaking.contract = this.loadContract('StakingRewards', this.staking.shareDaiLpStaking.address);
            // load price oracle:
            this.priceOracle.contract = this.loadContract('PriceOracle');
            if (this.wallet.installed) {
                this.connectWallet();
            }
        },
    });
}

$(initApp);
