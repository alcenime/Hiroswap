/* =========================================================
   HIRO SWAP — wallet.js
   Robinhood Chain
   Real On-Chain Wallet Balance
   ========================================================= */

(() => {
  'use strict';

  /* =========================
     CONFIG
     ========================= */

  const CHAIN_ID = 4663;
  const CHAIN_HEX = '0x1237';

  const RPC_URL =
    'https://rpc.mainnet.chain.robinhood.com';

  const CHAIN = {
    chainId: CHAIN_HEX,
    chainName: 'Robinhood Chain',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrls: [RPC_URL],
    blockExplorerUrls: [
      'https://explorer.mainnet.chain.robinhood.com'
    ]
  };

  /* =========================
     TOKEN CONTRACTS
     ========================= */

  const TOKENS = {
    pons: {
      address:
        '0x39dBED3a2bd333467115dE45665cC57F813C4571',
      symbol: 'PONS'
    },

    usdg: {
      address:
        '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
      symbol: 'USDG'
    },

    cashcat: {
      address:
        '0x020bfc650a365f8bb26819deaabf3e21291018b4',
      symbol: 'CASHCAT'
    }
  };

  /* =========================
     ERC20
     ========================= */

  const BALANCE_OF =
    '0x70a08231';

  const DECIMALS =
    '0x313ce567';

  /* =========================
     STATE
     ========================= */

  const state = {
    provider: null,
    address: null,
    chainId: null,
    connected: false,

    balances: {
      eth: '0',
      pons: '0',
      usdg: '0',
      cashcat: '0'
    },

    decimals: {},

    requestId: 0
  };

  /* =========================
     RPC
     ========================= */

  async function rpc(
    method,
    params = []
  ) {
    const response = await fetch(
      RPC_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params
        })
      }
    );

    if (!response.ok) {
      throw new Error(
        `RPC HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    if (data.error) {
      throw new Error(
        data.error.message ||
        'RPC error'
      );
    }

    return data.result;
  }

  async function ethCall(
    address,
    data
  ) {
    return rpc(
      'eth_call',
      [
        {
          to: address,
          data
        },
        'latest'
      ]
    );
  }

  /* =========================
     HELPERS
     ========================= */

  function addressData(address) {
    return address
      .toLowerCase()
      .replace(/^0x/, '')
      .padStart(64, '0');
  }

  function fromUnits(
    hexValue,
    decimals,
    maxDecimals = 8
  ) {
    try {
      const value =
        BigInt(hexValue);

      if (value === 0n) {
        return '0';
      }

      const base =
        10n ** BigInt(decimals);

      const whole =
        value / base;

      const fraction =
        value % base;

      if (fraction === 0n) {
        return whole.toString();
      }

      let fractionText =
        fraction
          .toString()
          .padStart(
            decimals,
            '0'
          );

      fractionText =
        fractionText
          .slice(
            0,
            maxDecimals
          )
          .replace(
            /0+$/,
            ''
          );

      return fractionText
        ? `${whole}.${fractionText}`
        : whole.toString();

    } catch {
      return '0';
    }
  }

  function notify() {
    try {
      if (
        typeof window.onWalletChange ===
        'function'
      ) {
        window.onWalletChange({
          address:
            state.address,

          chainId:
            state.chainId,

          connected:
            state.connected,

          balances: {
            ...state.balances
          }
        });
      }
    } catch (error) {
      console.error(
        '[HIRO] UI sync error:',
        error
      );
    }
  }

  /* =========================
     TOKEN DECIMALS
     ========================= */

  async function readDecimals(
    key
  ) {
    if (
      state.decimals[key] !==
      undefined
    ) {
      return state.decimals[key];
    }

    const token =
      TOKENS[key];

    try {
      const result =
        await ethCall(
          token.address,
          DECIMALS
        );

      const decimals =
        Number(
          BigInt(result)
        );

      state.decimals[key] =
        decimals;

      return decimals;

    } catch (error) {

      console.warn(
        `[HIRO] ${token.symbol} decimals read failed`,
        error
      );

      /*
       * Fallback only if the
       * contract doesn't respond.
       */

      state.decimals[key] =
        18;

      return 18;
    }
  }

  /* =========================
     TOKEN BALANCE
     ========================= */

  async function readTokenBalance(
    key
  ) {
    const token =
      TOKENS[key];

    const data =
      BALANCE_OF +
      addressData(
        state.address
      );

    const [
      rawBalance,
      decimals
    ] = await Promise.all([
      ethCall(
        token.address,
        data
      ),

      readDecimals(key)
    ]);

    return fromUnits(
      rawBalance,
      decimals,
      8
    );
  }

  /* =========================
     REFRESH ALL BALANCES
     ========================= */

  async function refreshBalances() {

    if (!state.address) {
      return {
        ...state.balances
      };
    }

    const request =
      ++state.requestId;

    console.log(
      '[HIRO] Reading real balances...',
      state.address
    );

    try {

      /* -------------------------
         ETH
         ------------------------- */

      const ethRaw =
        await rpc(
          'eth_getBalance',
          [
            state.address,
            'latest'
          ]
        );

      if (
        request !==
        state.requestId
      ) {
        return state.balances;
      }

      state.balances.eth =
        fromUnits(
          ethRaw,
          18,
          8
        );

      /* -------------------------
         ERC20
         ------------------------- */

      const results =
        await Promise.allSettled([
          readTokenBalance(
            'pons'
          ),

          readTokenBalance(
            'usdg'
          ),

          readTokenBalance(
            'cashcat'
          )
        ]);

      if (
        request !==
        state.requestId
      ) {
        return state.balances;
      }

      if (
        results[0].status ===
        'fulfilled'
      ) {
        state.balances.pons =
          results[0].value;
      } else {
        console.error(
          '[HIRO] PONS balance error:',
          results[0].reason
        );
      }

      if (
        results[1].status ===
        'fulfilled'
      ) {
        state.balances.usdg =
          results[1].value;
      } else {
        console.error(
          '[HIRO] USDG balance error:',
          results[1].reason
        );
      }

      if (
        results[2].status ===
        'fulfilled'
      ) {
        state.balances.cashcat =
          results[2].value;
      } else {
        console.error(
          '[HIRO] CASHCAT balance error:',
          results[2].reason
        );
      }

      console.log(
        '[HIRO] REAL BALANCES:',
        {
          ETH:
            state.balances.eth,

          PONS:
            state.balances.pons,

          USDG:
            state.balances.usdg,

          CASHCAT:
            state.balances.cashcat
        }
      );

      notify();

      return {
        ...state.balances
      };

    } catch (error) {

      console.error(
        '[HIRO] Balance refresh failed:',
        error
      );

      return {
        ...state.balances
      };
    }
  }

  /* =========================
     CHAIN
     ========================= */

  async function getChainId(
    provider
  ) {
    const hex =
      await provider.request({
        method:
          'eth_chainId'
      });

    return parseInt(
      hex,
      16
    );
  }

  async function ensureChain(
    provider
  ) {
    let chainId =
      await getChainId(
        provider
      );

    if (
      chainId === CHAIN_ID
    ) {
      state.chainId =
        CHAIN_ID;

      return true;
    }

    try {

      await provider.request({
        method:
          'wallet_switchEthereumChain',

        params: [
          {
            chainId:
              CHAIN_HEX
          }
        ]
      });

    } catch (error) {

      /*
       * Chain doesn't exist
       * in wallet yet.
       */

      if (
        error?.code === 4902
      ) {

        await provider.request({
          method:
            'wallet_addEthereumChain',

          params: [
            CHAIN
          ]
        });

      } else {
        throw error;
      }
    }

    chainId =
      await getChainId(
        provider
      );

    if (
      chainId !== CHAIN_ID
    ) {
      throw new Error(
        'Please switch to Robinhood Chain.'
      );
    }

    state.chainId =
      CHAIN_ID;

    return true;
  }

  /* =========================
     CONNECT
     ========================= */

  async function connect() {

    const provider =
      window.ethereum;

    if (!provider) {
      throw new Error(
        'No compatible wallet detected.'
      );
    }

    state.provider =
      provider;

    /*
     * Request wallet
     */

    const accounts =
      await provider.request({
        method:
          'eth_requestAccounts'
      });

    if (
      !accounts ||
      !accounts.length
    ) {
      throw new Error(
        'No wallet account found.'
      );
    }

    state.address =
      accounts[0];

    /*
     * Switch to Robinhood
     */

    await ensureChain(
      provider
    );

    state.connected =
      true;

    /*
     * READ REAL BALANCES
     */

    await refreshBalances();

    notify();

    return {
      address:
        state.address,

      chainId:
        state.chainId,

      balances: {
        ...state.balances
      }
    };
  }

  /* =========================
     DISCONNECT
     ========================= */

  async function disconnect() {

    state.requestId++;

    state.address =
      null;

    state.chainId =
      null;

    state.connected =
      false;

    state.provider =
      null;

    state.balances = {
      eth: '0',
      pons: '0',
      usdg: '0',
      cashcat: '0'
    };

    notify();

    return true;
  }

  /* =========================
     EVENTS
     ========================= */

  function setupEvents(
    provider
  ) {
    if (
      !provider ||
      !provider.on
    ) {
      return;
    }

    provider.on(
      'accountsChanged',
      async accounts => {

        if (
          !accounts ||
          !accounts.length
        ) {
          await disconnect();
          return;
        }

        state.address =
          accounts[0];

        try {

          await ensureChain(
            provider
          );

          state.connected =
            true;

          await refreshBalances();

        } catch (error) {

          console.error(
            '[HIRO] Account change error:',
            error
          );
        }

        notify();
      }
    );

    provider.on(
      'chainChanged',
      async chainHex => {

        const chainId =
          parseInt(
            chainHex,
            16
          );

        state.chainId =
          chainId;

        if (
          chainId !== CHAIN_ID
        ) {

          state.requestId++;

          state.balances = {
            eth: '0',
            pons: '0',
            usdg: '0',
            cashcat: '0'
          };

          notify();

          return;
        }

        if (
          state.address
        ) {

          state.connected =
            true;

          await refreshBalances();
        }

        notify();
      }
    );
  }

  /* =========================
     SILENT RECONNECT
     ========================= */

  async function reconnect() {

    const provider =
      window.ethereum;

    if (!provider) {
      return false;
    }

    try {

      const accounts =
        await provider.request({
          method:
            'eth_accounts'
        });

      if (
        !accounts ||
        !accounts.length
      ) {
        return false;
      }

      state.provider =
        provider;

      state.address =
        accounts[0];

      state.chainId =
        await getChainId(
          provider
        );

      if (
        state.chainId !==
        CHAIN_ID
      ) {

        state.connected =
          false;

        return false;
      }

      state.connected =
        true;

      setupEvents(
        provider
      );

      await refreshBalances();

      notify();

      return true;

    } catch (error) {

      console.warn(
        '[HIRO] Reconnect failed:',
        error
      );

      return false;
    }
  }

  /* =========================
     PUBLIC API
     ========================= */

  window.HiroWallet = {

    connect,

    disconnect,

    reconnect,

    refreshBalances,

    isConnected() {
      return (
        state.connected &&
        !!state.address &&
        state.chainId ===
          CHAIN_ID
      );
    },

    getAddress() {
      return state.address;
    },

    getChainId() {
      return state.chainId;
    },

    getProvider() {
      return state.provider;
    },

    getBalances() {
      return {
        ...state.balances
      };
    },

    getState() {
      return {
        address:
          state.address,

        chainId:
          state.chainId,

        connected:
          state.connected,

        balances: {
          ...state.balances
        }
      };
    },

    formatBalance(
      value,
      decimals = 6
    ) {
      const number =
        Number(value || 0);

      if (
        !Number.isFinite(number)
      ) {
        return '0';
      }

      return number.toLocaleString(
        'en-US',
        {
          maximumFractionDigits:
            decimals
        }
      );
    }
  };

  /* =========================
     INITIALIZE
     ========================= */

  async function init() {

    const provider =
      window.ethereum;

    if (!provider) {
      return;
    }

    state.provider =
      provider;

    setupEvents(
      provider
    );

    await reconnect();
  }

  if (
    document.readyState ===
    'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      init,
      {
        once: true
      }
    );

  } else {

    init();
  }

})();
