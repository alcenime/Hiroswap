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

    rpcUrls: [
      RPC_URL
    ],

    blockExplorerUrls: [
      'https://explorer.mainnet.chain.robinhood.com'
    ]
  };

  /* =========================
     TOKENS
     ========================= */

  const TOKENS = {
    pons: {
      address:
        '0x39dBED3a2bd333467115dE45665cC57F813C4571',
      symbol: 'PONS',
      decimals: 18
    },

    usdg: {
      address:
        '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
      symbol: 'USDG',
      decimals: 6
    },

    cashcat: {
      address:
        '0x020bfc650a365f8bb26819deaabf3e21291018b4',
      symbol: 'CASHCAT',
      decimals: 18
    }
  };

  /* =========================
     ERC20 SELECTOR
     ========================= */

  const BALANCE_OF =
    '0x70a08231';

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
     ADDRESS ENCODING
     ========================= */

  function addressData(address) {
    return address
      .toLowerCase()
      .replace(/^0x/, '')
      .padStart(64, '0');
  }

  /* =========================
     FORMAT UNITS
     ========================= */

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

    } catch (error) {
      console.error(
        '[HIRO] fromUnits error:',
        error
      );

      return '0';
    }
  }

  /* =========================
     UI CALLBACK
     ========================= */

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
     READ TOKEN BALANCE
     ========================= */

  async function readTokenBalance(
    key
  ) {
    const token =
      TOKENS[key];

    if (!token) {
      throw new Error(
        `Unknown token: ${key}`
      );
    }

    if (!state.address) {
      return '0';
    }

    /*
     * balanceOf(address)
     *
     * selector:
     * 0x70a08231
     */

    const data =
      BALANCE_OF +
      addressData(
        state.address
      );

    const rawBalance =
      await ethCall(
        token.address,
        data
      );

    return fromUnits(
      rawBalance,
      token.decimals,
      8
    );
  }

  /* =========================
     REFRESH BALANCES
     ========================= */

  async function refreshBalances() {

    if (!state.address) {
      return {
        ...state.balances
      };
    }

    const requestId =
      ++state.requestId;

    console.log(
      '[HIRO] Reading balances for:',
      state.address
    );

    try {

      /* =====================
         ETH
         ===================== */

      const ethRaw =
        await rpc(
          'eth_getBalance',
          [
            state.address,
            'latest'
          ]
        );

      if (
        requestId !==
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

      /* =====================
         PONS
         ===================== */

      try {

        state.balances.pons =
          await readTokenBalance(
            'pons'
          );

      } catch (error) {

        console.error(
          '[HIRO] PONS balance error:',
          error
        );

        state.balances.pons =
          '0';
      }

      /* =====================
         USDG
         ===================== */

      try {

        state.balances.usdg =
          await readTokenBalance(
            'usdg'
          );

      } catch (error) {

        console.error(
          '[HIRO] USDG balance error:',
          error
        );

        state.balances.usdg =
          '0';
      }

      /* =====================
         CASHCAT
         ===================== */

      try {

        state.balances.cashcat =
          await readTokenBalance(
            'cashcat'
          );

      } catch (error) {

        console.error(
          '[HIRO] CASHCAT balance error:',
          error
        );

        state.balances.cashcat =
          '0';
      }

      if (
        requestId !==
        state.requestId
      ) {
        return state.balances;
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
     CHAIN ID
     ========================= */

  async function getChainId(
    provider
  ) {
    const chainHex =
      await provider.request({
        method:
          'eth_chainId'
      });

    return parseInt(
      chainHex,
      16
    );
  }

  /* =========================
     ENSURE ROBINHOOD CHAIN
     ========================= */

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

    /* Request account */

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

    console.log(
      '[HIRO] Connected:',
      state.address
    );

    /* Switch chain */

    await ensureChain(
      provider
    );

    state.connected =
      true;

    /* Read REAL balance */

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
     PROVIDER EVENTS
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

    /* Account changed */

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

    /* Chain changed */

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
     RECONNECT
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
        state.connected === true &&
        !!state.address &&
        state.chainId === CHAIN_ID
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
      maxDecimals = 6
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
            maxDecimals
        }
      );
    }
  };

  /* =========================
     AUTO INIT
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
