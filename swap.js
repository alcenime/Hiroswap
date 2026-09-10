/* =========================================================
   HIRO SWAP — swap.js
   Robinhood Chain
   Real Uniswap V3 SwapRouter02 integration
   ========================================================= */

(() => {
  'use strict';

  /* =======================================================
     REQUIREMENTS
     ======================================================= */

  if (!window.ethers) {
    console.error(
      '[HIRO SWAP] ethers.js is required.'
    );
    return;
  }

  if (!window.HiroWallet) {
    console.error(
      '[HIRO SWAP] wallet.js must load before swap.js.'
    );
    return;
  }

  if (!window.HiroABI) {
    console.error(
      '[HIRO SWAP] abi.js must load before swap.js.'
    );
    return;
  }

  const {
    ERC20_ABI,
    QUOTER_V2_ABI,
    SWAP_ROUTER_ABI,
    WETH_ABI,
    CONTRACTS,
    DECIMALS
  } = window.HiroABI;

  /* =======================================================
     CONSTANTS
     ======================================================= */

  const CHAIN_ID = 4663;

  const WETH =
    CONTRACTS.WETH;

  const ROUTER =
    CONTRACTS.SWAP_ROUTER;

  const QUOTER =
    CONTRACTS.QUOTER_V2;

  const RPC =
    CONTRACTS.RPC;

  /*
   * Known Uniswap V3 fee tiers.
   *
   * Robinhood Chain / PONS commonly uses
   * 10000 = 1%.
   *
   * We also test lower tiers so other pairs
   * can work if their pool exists there.
   */

  const FEE_TIERS = [
    10000,
    3000,
    500,
    100
  ];

  /*
   * Default slippage.
   *
   * 50 = 0.50%
   */

  const DEFAULT_SLIPPAGE_BPS = 50;

  /*
   * Quote cache lifetime.
   */

  const QUOTE_CACHE_MS = 5000;

  /* =======================================================
     TOKEN CONFIG
     ======================================================= */

  const TOKENS = {
    ETH: {
      symbol: 'ETH',
      address: WETH,
      decimals: 18,
      native: true
    },

    PONS: {
      symbol: 'PONS',
      address:
        CONTRACTS.PONS,
      decimals: 18,
      native: false
    },

    USDG: {
      symbol: 'USDG',
      address:
        CONTRACTS.USDG,
      decimals: 6,
      native: false
    },

    CASHCAT: {
      symbol: 'CASHCAT',
      address:
        CONTRACTS.CASHCAT,
      decimals: 18,
      native: false
    }
  };

  /* =======================================================
     STATE
     ======================================================= */

  const state = {

    signer: null,

    provider: null,

    account: null,

    quote: null,

    quoteTimestamp: 0,

    swapping: false,

    slippageBps:
      DEFAULT_SLIPPAGE_BPS

  };

  /* =======================================================
     PROVIDER
     ======================================================= */

  async function getProvider() {

    const walletProvider =
      window.HiroWallet.getProvider();

    if (!walletProvider) {
      throw new Error(
        'Wallet provider not available.'
      );
    }

    /*
     * Ethers v6 BrowserProvider
     */

    const provider =
      new ethers.BrowserProvider(
        walletProvider
      );

    const network =
      await provider.getNetwork();

    const chainId =
      Number(
        network.chainId
      );

    if (
      chainId !== CHAIN_ID
    ) {
      throw new Error(
        'Please connect to Robinhood Chain.'
      );
    }

    state.provider =
      provider;

    return provider;
  }

  async function getSigner() {

    const provider =
      await getProvider();

    const signer =
      await provider.getSigner();

    const account =
      await signer.getAddress();

    state.signer =
      signer;

    state.account =
      account;

    return signer;
  }

  /* =======================================================
     TOKEN HELPERS
     ======================================================= */

  function getToken(
    symbol
  ) {

    const key =
      String(symbol)
        .toUpperCase();

    const token =
      TOKENS[key];

    if (!token) {
      throw new Error(
        `Unsupported token: ${symbol}`
      );
    }

    return token;
  }

  function normalizeAddress(
    address
  ) {
    return ethers
      .getAddress(address);
  }

  function isSameToken(
    a,
    b
  ) {
    return (
      normalizeAddress(a) ===
      normalizeAddress(b)
    );
  }

  /* =======================================================
     DECIMAL HELPERS
     ======================================================= */

  function tokenDecimals(
    token
  ) {

    if (
      token.native
    ) {
      return 18;
    }

    return (
      token.decimals ??
      18
    );
  }

  function parseAmount(
    amount,
    token
  ) {

    if (
      amount === null ||
      amount === undefined ||
      amount === ''
    ) {
      throw new Error(
        'Enter an amount.'
      );
    }

    const value =
      String(amount).trim();

    if (
      !/^\d*\.?\d+$/.test(value)
    ) {
      throw new Error(
        'Invalid amount.'
      );
    }

    const parsed =
      ethers.parseUnits(
        value,
        tokenDecimals(token)
      );

    if (
      parsed <= 0n
    ) {
      throw new Error(
        'Amount must be greater than zero.'
      );
    }

    return parsed;
  }

  function formatAmount(
    amount,
    token
  ) {

    try {

      return ethers.formatUnits(
        amount,
        tokenDecimals(token)
      );

    } catch {
      return '0';
    }
  }

  /* =======================================================
     CONTRACT FACTORIES
     ======================================================= */

  function getERC20(
    address,
    signerOrProvider
  ) {

    return new ethers.Contract(
      address,
      ERC20_ABI,
      signerOrProvider
    );
  }

  function getQuoter(
    provider
  ) {

    return new ethers.Contract(
      QUOTER,
      QUOTER_V2_ABI,
      provider
    );
  }

  function getRouter(
    signer
  ) {

    return new ethers.Contract(
      ROUTER,
      SWAP_ROUTER_ABI,
      signer
    );
  }

  function getWETH(
    signerOrProvider
  ) {

    return new ethers.Contract(
      WETH,
      WETH_ABI,
      signerOrProvider
    );
  }

  /* =======================================================
     BALANCE
     ======================================================= */

  async function getNativeBalance(
    address
  ) {

    const provider =
      await getProvider();

    return provider.getBalance(
      address
    );
  }

  async function getTokenBalance(
    token,
    address
  ) {

    if (
      token.native
    ) {
      return getNativeBalance(
        address
      );
    }

    const contract =
      getERC20(
        token.address,
        await getProvider()
      );

    return contract.balanceOf(
      address
    );
  }

  /* =======================================================
     ALLOWANCE
     ======================================================= */

  async function getAllowance(
    token,
    owner
  ) {

    if (
      token.native
    ) {
      return ethers.MaxUint256;
    }

    const contract =
      getERC20(
        token.address,
        await getProvider()
      );

    return contract.allowance(
      owner,
      ROUTER
    );
  }

  /* =======================================================
     APPROVAL
     ======================================================= */

  async function approve(
    token,
    amount
  ) {

    if (
      token.native
    ) {
      return null;
    }

    const signer =
      await getSigner();

    const tokenContract =
      getERC20(
        token.address,
        signer
      );

    const owner =
      await signer.getAddress();

    const allowance =
      await tokenContract.allowance(
        owner,
        ROUTER
      );

    if (
      allowance >= amount
    ) {

      console.log(
        `[HIRO] ${token.symbol} already approved.`
      );

      return null;
    }

    console.log(
      `[HIRO] Approving ${token.symbol}...`
    );

    /*
     * Use exact amount rather than
     * infinite approval.
     */

    const tx =
      await tokenContract.approve(
        ROUTER,
        amount
      );

    console.log(
      '[HIRO] Approval TX:',
      tx.hash
    );

    await tx.wait();

    console.log(
      `[HIRO] ${token.symbol} approved.`
    );

    return tx;
  }

  /* =======================================================
     PATH ENCODING
     ======================================================= */

  function encodePath(
    tokens,
    fees
  ) {

    if (
      tokens.length !==
      fees.length + 1
    ) {
      throw new Error(
        'Invalid swap path.'
      );
    }

    let path =
      '0x';

    for (
      let i = 0;
      i < fees.length;
      i++
    ) {

      path +=
        tokens[i]
          .replace(
            /^0x/,
            ''
          );

      path +=
        Number(fees[i])
          .toString(16)
          .padStart(
            6,
            '0'
          );
    }

    path +=
      tokens[tokens.length - 1]
        .replace(
          /^0x/,
          ''
        );

    return path;
  }

  /* =======================================================
     QUOTE SINGLE
     ======================================================= */

  async function quoteSingle(
    tokenIn,
    tokenOut,
    amountIn,
    fee
  ) {

    const provider =
      await getProvider();

    const quoter =
      getQuoter(
        provider
      );

    try {

      const result =
        await quoter
          .quoteExactInputSingle
          .staticCall({
            tokenIn:
              tokenIn.address,

            tokenOut:
              tokenOut.address,

            amountIn,

            fee,

            sqrtPriceLimitX96:
              0
          });

      return {
        amountOut:
          result.amountOut,

        fee,

        path: [
          tokenIn.address,
          tokenOut.address
        ],

        fees: [
          fee
        ],

        route: 'DIRECT',

        gasEstimate:
          result.gasEstimate
      };

    } catch (error) {

      return null;
    }
  }

  /* =======================================================
     QUOTE MULTI-HOP
     ======================================================= */

  async function quoteMultiHop(
    tokenIn,
    tokenOut,
    amountIn,
    fee1,
    fee2
  ) {

    const provider =
      await getProvider();

    const quoter =
      getQuoter(
        provider
      );

    const path =
      encodePath(
        [
          tokenIn.address,
          WETH,
          tokenOut.address
        ],
        [
          fee1,
          fee2
        ]
      );

    try {

      const result =
        await quoter
          .quoteExactInput
          .staticCall(
            path,
            amountIn
          );

      return {
        amountOut:
          result.amountOut,

        path: [
          tokenIn.address,
          WETH,
          tokenOut.address
        ],

        fees: [
          fee1,
          fee2
        ],

        route: 'VIA_WETH',

        gasEstimate:
          result.gasEstimate
      };

    } catch {
      return null;
    }
  }

  /* =======================================================
     FIND BEST QUOTE
     ======================================================= */

  async function findBestQuote(
    fromSymbol,
    toSymbol,
    amount
  ) {

    const tokenIn =
      getToken(
        fromSymbol
      );

    const tokenOut =
      getToken(
        toSymbol
      );

    if (
      fromSymbol.toUpperCase() ===
      toSymbol.toUpperCase()
    ) {
      throw new Error(
        'From and To tokens must be different.'
      );
    }

    const amountIn =
      parseAmount(
        amount,
        tokenIn
      );

    /*
     * ETH is represented by WETH
     * inside V3 pools.
     */

    const results = [];

    /*
     * Direct pools
     */

    for (
      const fee of FEE_TIERS
    ) {

      const quote =
        await quoteSingle(
          tokenIn,
          tokenOut,
          amountIn,
          fee
        );

      if (quote) {
        results.push(
          quote
        );
      }
    }

    /*
     * Via WETH
     *
     * Don't create WETH -> WETH.
     */

    if (
      !isSameToken(
        tokenIn.address,
        WETH
      ) &&
      !isSameToken(
        tokenOut.address,
        WETH
      )
    ) {

      for (
        const fee1 of FEE_TIERS
      ) {

        for (
          const fee2 of FEE_TIERS
        ) {

          const quote =
            await quoteMultiHop(
              tokenIn,
              tokenOut,
              amountIn,
              fee1,
              fee2
            );

          if (quote) {
            results.push(
              quote
            );
          }
        }
      }
    }

    if (
      !results.length
    ) {
      throw new Error(
        `No liquidity route found for ${fromSymbol} → ${toSymbol}.`
      );
    }

    /*
     * Highest amountOut wins.
     */

    results.sort(
      (a, b) =>
        a.amountOut >
        b.amountOut
          ? -1
          : a.amountOut <
            b.amountOut
            ? 1
            : 0
    );

    const best =
      results[0];

    const outputText =
      formatAmount(
        best.amountOut,
        tokenOut
      );

    const rate =
      Number(
        outputText
      ) /
      Number(
        amount
      );

    const quoteData = {

      from:
        tokenIn.symbol,

      to:
        tokenOut.symbol,

      amountIn,

      amountInFormatted:
        String(amount),

      amountOut:
        best.amountOut,

      amountOutFormatted:
        outputText,

      rate,

      path:
        best.path,

      fees:
        best.fees,

      route:
        best.route,

      gasEstimate:
        best.gasEstimate,

      timestamp:
        Date.now()
    };

    state.quote =
      quoteData;

    state.quoteTimestamp =
      Date.now();

    console.log(
      '[HIRO] Best quote:',
      quoteData
    );

    return quoteData;
  }

  /* =======================================================
     SLIPPAGE
     ======================================================= */

  function getMinimumAmountOut(
    amountOut,
    slippageBps =
      state.slippageBps
  ) {

    const bps =
      BigInt(
        Math.max(
          0,
          Math.floor(
            slippageBps
          )
        )
      );

    const denominator =
      10000n;

    return (
      amountOut *
      (
        denominator -
        bps
      )
    ) /
    denominator;
  }

  /* =======================================================
     SET SLIPPAGE
     ======================================================= */

  function setSlippage(
    percent
  ) {

    const value =
      Number(percent);

    if (
      !Number.isFinite(value) ||
      value < 0 ||
      value > 50
    ) {
      throw new Error(
        'Slippage must be between 0% and 50%.'
      );
    }

    state.slippageBps =
      Math.round(
        value * 100
      );

    return (
      state.slippageBps /
      100
    );
  }

  /* =======================================================
     ENSURE NATIVE ETH -> WETH
     ======================================================= */

  async function wrapETH(
    amount
  ) {

    const signer =
      await getSigner();

    const weth =
      getWETH(
        signer
      );

    console.log(
      '[HIRO] Wrapping ETH → WETH...'
    );

    const tx =
      await weth.deposit({
        value:
          amount
      });

    console.log(
      '[HIRO] WETH deposit TX:',
      tx.hash
    );

    await tx.wait();

    return tx;
  }

  /* =======================================================
     UNWRAP WETH -> ETH
     ======================================================= */

  async function unwrapWETH(
    amount
  ) {

    const signer =
      await getSigner();

    const weth =
      getWETH(
        signer
      );

    console.log(
      '[HIRO] Unwrapping WETH → ETH...'
    );

    const tx =
      await weth.withdraw(
        amount
      );

    console.log(
      '[HIRO] WETH withdraw TX:',
      tx.hash
    );

    await tx.wait();

    return tx;
  }

  /* =======================================================
     EXECUTE SINGLE-HOP
     ======================================================= */

  async function executeSingle(
    quote,
    tokenIn,
    tokenOut,
    amountIn,
    amountOutMinimum
  ) {

    const signer =
      await getSigner();

    const router =
      getRouter(
        signer
      );

    const deadline =
      BigInt(
        Math.floor(
          Date.now() / 1000
        ) + 1200
      );

    const params = {

      tokenIn:
        tokenIn.address,

      tokenOut:
        tokenOut.address,

      fee:
        quote.fees[0],

      recipient:
        state.account,

      amountIn,

      amountOutMinimum,

      sqrtPriceLimitX96:
        0
    };

    console.log(
      '[HIRO] Executing direct swap:',
      params
    );

    /*
     * Important:
     *
     * Router works with WETH.
     * Native ETH is wrapped before
     * calling the router.
     */

    const tx =
      await router.exactInputSingle(
        params
      );

    return tx;
  }

  /* =======================================================
     EXECUTE MULTI-HOP
     ======================================================= */

  async function executeMultiHop(
    quote,
    tokenIn,
    tokenOut,
    amountIn,
    amountOutMinimum
  ) {

    const signer =
      await getSigner();

    const router =
      getRouter(
        signer
      );

    const path =
      encodePath(
        quote.path,
        quote.fees
      );

    const params = {

      path,

      recipient:
        state.account,

      amountIn,

      amountOutMinimum
    };

    console.log(
      '[HIRO] Executing multi-hop swap:',
      params
    );

    const tx =
      await router.exactInput(
        params
      );

    return tx;
  }

  /* =======================================================
     EXECUTE SWAP
     ======================================================= */

  async function executeSwap(
    fromSymbol,
    toSymbol,
    amount,
    options = {}
  ) {

    if (
      state.swapping
    ) {
      throw new Error(
        'A swap is already in progress.'
      );
    }

    if (
      !window.HiroWallet.isConnected()
    ) {
      throw new Error(
        'Connect your wallet first.'
      );
    }

    const tokenIn =
      getToken(
        fromSymbol
      );

    const tokenOut =
      getToken(
        toSymbol
      );

    const amountIn =
      parseAmount(
        amount,
        tokenIn
      );

    state.swapping =
      true;

    try {

      /* =================================
         Check wallet balance
         ================================= */

      const balance =
        await getTokenBalance(
          tokenIn,
          state.account ||
          window.HiroWallet
            .getAddress()
        );

      if (
        balance <
        amountIn
      ) {

        throw new Error(
          `Insufficient ${tokenIn.symbol} balance.`
        );
      }

      /* =================================
         Get fresh quote
         ================================= */

      let quote =
        state.quote;

      const quoteFresh =
        quote &&
        Date.now() -
          state.quoteTimestamp <
          QUOTE_CACHE_MS &&
        quote.from ===
          tokenIn.symbol &&
        quote.to ===
          tokenOut.symbol &&
        String(
          quote.amountInFormatted
        ) ===
          String(amount);

      if (
        !quoteFresh
      ) {

        quote =
          await findBestQuote(
            fromSymbol,
            toSymbol,
            amount
          );
      }

      if (!quote) {
        throw new Error(
          'Unable to get swap quote.'
        );
      }

      /* =================================
         Slippage
         ================================= */

      const amountOutMinimum =
        getMinimumAmountOut(
          quote.amountOut,
          options.slippageBps ??
            state.slippageBps
        );

      console.log(
        '[HIRO] Amount out:',
        quote.amountOut
      );

      console.log(
        '[HIRO] Minimum out:',
        amountOutMinimum
      );

      /* =================================
         Native ETH
         ================================= */

      if (
        tokenIn.native
      ) {

        /*
         * V3 SwapRouter02 consumes WETH.
         *
         * Wrap ETH first.
         */

        await wrapETH(
          amountIn
        );

        /*
         * Approve WETH.
         */

        await approve(
          {
            ...tokenIn,
            native: false
          },
          amountIn
        );
      }

      /* =================================
         ERC20 approval
         ================================= */

      else {

        await approve(
          tokenIn,
          amountIn
        );
      }

      /* =================================
         Execute swap
         ================================= */

      let tx;

      const routerTokenIn =
        tokenIn.native
          ? {
              ...tokenIn,
              native: false
            }
          : tokenIn;

      const routerTokenOut =
        tokenOut.native
          ? {
              ...tokenOut,
              native: false
            }
          : tokenOut;

      /*
       * Swap uses WETH address whenever
       * ETH is involved.
       */

      if (
        quote.route ===
        'DIRECT'
      ) {

        const fixedQuote = {
          ...quote,

          path:
            quote.path.map(
              (address, index) => {

                /*
                 * quote already uses WETH
                 * for ETH.
                 */

                return address;
              }
            )
        };

        tx =
          await executeSingle(
            fixedQuote,
            routerTokenIn,
            routerTokenOut,
            amountIn,
            amountOutMinimum
          );

      } else {

        tx =
          await executeMultiHop(
            quote,
            routerTokenIn,
            routerTokenOut,
            amountIn,
            amountOutMinimum
          );
      }

      console.log(
        '[HIRO] Swap TX:',
        tx.hash
      );

      /* =================================
         Wait confirmation
         ================================= */

      const receipt =
        await tx.wait();

      console.log(
        '[HIRO] Swap confirmed:',
        receipt.hash
      );

      /* =================================
         Unwrap WETH -> ETH
         ================================= */

      if (
        tokenOut.native
      ) {

        /*
         * Router sends WETH to the wallet.
         *
         * Read resulting WETH balance,
         * then unwrap it.
         */

        const weth =
          getWETH(
            await getProvider()
          );

        const wethBalance =
          await weth.balanceOf(
            state.account
          );

        if (
          wethBalance > 0n
        ) {

          await unwrapWETH(
            wethBalance
          );
        }
      }

      /* =================================
         Refresh wallet balance
         ================================= */

      if (
        window.HiroWallet
          .refreshBalances
      ) {

        await window.HiroWallet
          .refreshBalances();
      }

      state.quote =
        null;

      state.quoteTimestamp =
        0;

      return {

        success:
          true,

        txHash:
          receipt.hash,

        receipt,

        quote,

        amountIn:
          amountIn.toString(),

        amountOut:
          quote.amountOut.toString(),

        amountOutFormatted:
          quote.amountOutFormatted,

        from:
          tokenIn.symbol,

        to:
          tokenOut.symbol
      };

    } finally {

      state.swapping =
        false;
    }
  }

  /* =======================================================
     QUOTE PUBLIC API
     ======================================================= */

  async function quote(
    fromSymbol,
    toSymbol,
    amount
  ) {

    return findBestQuote(
      fromSymbol,
      toSymbol,
      amount
    );
  }

  /* =======================================================
     PUBLIC API
     ======================================================= */

  window.HiroSwap = {

    quote,

    findBestQuote,

    executeSwap,

    approve,

    getAllowance,

    getTokenBalance,

    getNativeBalance,

    setSlippage,

    getSlippage() {
      return (
        state.slippageBps /
        100
      );
    },

    getQuote() {
      return state.quote;
    },

    isSwapping() {
      return state.swapping;
    },

    getContracts() {
      return {
        router:
          ROUTER,

        quoter:
          QUOTER,

        weth:
          WETH
      };
    },

    getTokens() {
      return {
        ...TOKENS
      };
    }
  };

  console.log(
    '[HIRO SWAP] swap.js loaded.'
  );

})();
