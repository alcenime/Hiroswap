/* =========================================================
   HIRO SWAP — wallet.js
   Robinhood Chain
   Real on-chain wallet + ERC20 balances
   ========================================================= */

(() => {
  'use strict';

  /* =========================
     CONFIG
     ========================= */

  const PROJECT_ID = '7b851f00cf694880d06da854743a7708';

  const CHAIN_ID = 4663;
  const CHAIN_HEX = '0x1237';

  const CHAIN = {
    chainId: CHAIN_HEX,
    chainName: 'Robinhood Chain',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrls: [
      'https://rpc.mainnet.chain.robinhood.com'
    ],
    blockExplorerUrls: [
      'https://explorer.mainnet.chain.robinhood.com'
    ]
  };

  const RPC_URL = 'https://rpc.mainnet.chain.robinhood.com';

  /* =========================
     TOKEN CONTRACTS
     ========================= */

  const TOKENS = {
    pons: {
      address: '0x39dBED3a2bd333467115dE45665cC57F813C4571',
      symbol: 'PONS',
      decimals: 18
    },

    usdg: {
      address: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
      symbol: 'USDG',
      decimals: 18
    },

    cashcat: {
      address: '0x020bfc650a365f8bb26819deaabf3e21291018b4',
      symbol: 'CASHCAT',
      decimals: 18
    }
  };

  /* =========================
     ERC20 SELECTORS
     ========================= */

  const BALANCE_OF_SELECTOR = '0x70a08231';
  const DECIMALS_SELECTOR = '0x313ce567';

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

    decimals: {
      pons: 18,
      usdg: 18,
      cashcat: 18
    },

    balanceRequestId: 0
  };

  /* =========================
     HELPERS
     ========================= */

  function normalizeAddress(address) {
    if (!address) return null;

    try {
      return String(address);
    } catch {
      return null;
    }
  }

  function padAddress(address) {
    return address
      .toLowerCase()
      .replace(/^0x/, '')
      .padStart(64, '0');
  }

  function formatUnits(value, decimals = 18, maxDecimals = 6) {
    try {
      if (value === null || value === undefined) return '0';

      const raw = BigInt(value);

      if (raw === 0n) return '0';

      const base = 10n ** BigInt(decimals);

      const whole = raw / base;
      const fraction = raw % base;

      if (fraction === 0n) {
        return whole.toString();
      }

      let fractionString = fraction
        .toString()
        .padStart(decimals, '0');

      fractionString = fractionString
        .slice(0, maxDecimals)
        .replace(/0+$/, '');

      return fractionString
        ? `${whole}.${fractionString}`
        : whole.toString();

    } catch {
      return '0';
    }
  }

  function fireChange() {
    try {
      if (typeof window.onWalletChange === 'function') {
        window.onWalletChange({
          address: state.address,
          chainId: state.chainId,
          connected: state.connected,
          balances: { ...state.balances }
        });
      }
    } catch (error) {
      console.error('[HIRO] onWalletChange error:', error);
    }
  }

  /* =========================
     RPC
     ========================= */

  async function rpc(method, params = []) {
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params
      })
    });

    if (!response.ok) {
      throw new Error(`RPC HTTP ${response.status}`);
    }

    const json = await response.json();

    if (json.error) {
      throw new Error(
        json.error.message || 'RPC request failed'
      );
    }

    return json.result;
  }

  async function ethCall(to, data) {
    return await rpc('eth_call', [
      {
        to,
        data
      },
      'latest'
    ]);
  }

  /* =========================
     READ ERC20 BALANCE
     ========================= */

  async function getTokenBalance(tokenAddress, walletAddress) {
    const data =
      BALANCE_OF_SELECTOR +
      padAddress(walletAddress);

    return await ethCall(tokenAddress, data);
  }

  /* =========================
     READ DECIMALS
     ========================= */

  async function getTokenDecimals(tokenKey) {
    if (state.decimals[tokenKey] !== undefined) {
      return state.decimals[tokenKey];
    }

    const token = TOKENS[tokenKey];

    if (!token) {
      return 18;
    }

    try {
      const result = await ethCall(
        token.address,
        DECIMALS_SELECTOR
      );

      const decimals = Number(
        BigInt(result)
      );

      state.decimals[tokenKey] = decimals;

      return decimals;

    } catch (error) {
      console.warn(
        `[HIRO] Failed to read ${tokenKey} decimals`,
        error
      );

      state.decimals[tokenKey] = 18;

      return 18;
    }
  }

  /* =========================
     REFRESH BALANCES
     ========================= */

  async function refreshBalances() {
    if (!state.address) {
      return state.balances;
    }

    const requestId = ++state.balanceRequestId;

    try {
      /* -------------------------
         Native ETH
         ------------------------- */

      const ethRaw = await rpc(
        'eth_getBalance',
        [
          state.address,
          'latest'
        ]
      );

      if (requestId !== state.balanceRequestId) {
        return state.balances;
      }

      state.balances.eth = formatUnits(
        ethRaw,
        18,
        8
      );

      /* -------------------------
         ERC20 tokens
         ------------------------- */

      const tokenKeys = [
        'pons',
        'usdg',
        'cashcat'
      ];

      await Promise.all(
        tokenKeys.map(async (key) => {
          const token = TOKENS[key];

          try {
            const [rawBalance, decimals] =
              await Promise.all([
                getTokenBalance(
                  token.address,
                  state.address
                ),
                getTokenDecimals(key)
              ]);

            if (
              requestId !==
              state.balanceRequestId
            ) {
              return;
            }

            state.balances[key] =
              formatUnits(
                rawBalance,
                decimals,
                8
              );

          } catch (error) {
            console.warn(
              `[HIRO] Failed to read ${token.symbol} balance`,
              error
            );

            if (
              requestId ===
              state.balanceRequestId
            ) {
              state.balances[key] = '0';
            }
          }
        })
      );

      if (requestId !== state.balanceRequestId) {
        return state.balances;
      }

      console.log(
        '[HIRO] Real wallet balances:',
        state.balances
      );

      fireChange();

      return {
        ...state.balances
      };

    } catch (error) {
      console.error(
        '[HIRO] Balance refresh failed:',
        error
      );

      return state.balances;
    }
  }

  /* =========================
     RESET
     ========================= */

  function resetBalances() {
    state.balanceRequestId++;

    state.balances = {
      eth: '0',
      pons: '0',
      usdg: '0',
      cashcat: '0'
    };

    fireChange();
  }

  /* =========================
     CHECK CHAIN
     ========================= */

  async function getCurrentChainId(provider) {
    try {
      const chainId = await provider.request({
        method: 'eth_chainId'
      });

      return parseInt(chainId, 16);

    } catch {
      return null;
    }
  }

  async function ensureRobinhoodChain(provider) {
    const currentChainId =
      await getCurrentChainId(provider);

    if (currentChainId === CHAIN_ID) {
      state.chainId = CHAIN_ID;
      return true;
    }

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [
          {
            chainId: CHAIN_HEX
          }
        ]
      });

    } catch (switchError) {

      /*
       * Chain not added
       */

      if (
        switchError?.code === 4902 ||
        String(switchError?.message || '')
          .toLowerCase()
          .includes('unrecognized chain')
      ) {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            CHAIN
          ]
        });
      } else {
        throw switchError;
      }
    }

    const verifiedChain =
      await getCurrentChainId(provider);

    if (verifiedChain !== CHAIN_ID) {
      throw new Error(
        'Wallet is not connected to Robinhood Chain.'
      );
    }

    state.chainId = CHAIN_ID;

    return true;
  }

  /* =========================
     CONNECT
     ========================= */

  async function connect() {
    /*
     * If an injected wallet exists,
     * use it directly.
     */

    let provider =
      window.ethereum || null;

    /*
     * Try AppKit / Reown provider first
     * when available.
     */

    if (
      !provider &&
      window.HiroAppKitProvider
    ) {
      provider =
        window.HiroAppKitProvider;
    }

    if (!provider) {
      throw new Error(
        'No wallet detected. Please install or enable a compatible wallet.'
      );
    }

    state.provider = provider;

    /*
     * Request accounts
     */

    const accounts =
      await provider.request({
        method: 'eth_requestAccounts'
      });

    if (
      !accounts ||
      !accounts.length
    ) {
      throw new Error(
        'No wallet account returned.'
      );
    }

    state.address =
      normalizeAddress(accounts[0]);

    /*
     * Force Robinhood Chain
     */

    await ensureRobinhoodChain(provider);

    state.connected = true;

    /*
     * Read real balances
     */

    await refreshBalances();

    fireChange();

    return {
      address: state.address,
      chainId: state.chainId,
      balances: {
        ...state.balances
      }
    };
  }

  /* =========================
     DISCONNECT
     ========================= */

  async function disconnect() {
    state.address = null;
    state.chainId = null;
    state.connected = false;
    state.provider = null;

    resetBalances();

    return true;
  }

  /* =========================
     FORMAT BALANCE
     ========================= */

  function formatBalance(
    value,
    decimals = 6
  ) {
    const number =
      Number(value || 0);

    if (!Number.isFinite(number)) {
      return '0';
    }

    if (number === 0) {
      return '0';
    }

    return number.toLocaleString(
      'en-US',
      {
        maximumFractionDigits: decimals
      }
    );
  }

  /* =========================
     EVENT HANDLERS
     ========================= */

  function setupProviderEvents(provider) {
    if (!provider?.on) {
      return;
    }

    /*
     * Account changed
     */

    provider.on(
      'accountsChanged',
      async (accounts) => {

        if (
          !accounts ||
          !accounts.length
        ) {
          await disconnect();
          return;
        }

        state.address =
          normalizeAddress(accounts[0]);

        state.connected = true;

        try {
          await ensureRobinhoodChain(
            provider
          );

          await refreshBalances();

        } catch (error) {
          console.error(
            '[HIRO] Account change error:',
            error
          );
        }

        fireChange();
      }
    );

    /*
     * Network changed
     */

    provider.on(
      'chainChanged',
      async (chainIdHex) => {

        const chainId =
          parseInt(
            chainIdHex,
            16
          );

        state.chainId = chainId;

        if (
          chainId !== CHAIN_ID
        ) {
          resetBalances();

          console.warn(
            '[HIRO] Wrong network. Please switch to Robinhood Chain.'
          );

          fireChange();

          return;
        }

        if (state.address) {
          await refreshBalances();
        }

        fireChange();
      }
    );
  }

  /* =========================
     SILENT RECONNECT
     ========================= */

  async function tryReconnect() {
    const provider =
      window.ethereum || null;

    if (!provider) {
      return false;
    }

    try {
      const accounts =
        await provider.request({
          method: 'eth_accounts'
        });

      if (
        !accounts ||
        !accounts.length
      ) {
        return false;
      }

      state.provider = provider;

      state.address =
        normalizeAddress(accounts[0]);

      const chainId =
        await getCurrentChainId(
          provider
        );

      state.chainId = chainId;

      if (
        chainId !== CHAIN_ID
      ) {
        state.connected = false;

        resetBalances();

        return false;
      }

      state.connected = true;

      setupProviderEvents(provider);

      await refreshBalances();

      fireChange();

      return true;

    } catch (error) {
      console.warn(
        '[HIRO] Silent reconnect failed:',
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

    isConnected() {
      return (
        state.connected === true &&
        !!state.address
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

    refreshBalances,

    formatBalance,

    getState() {
      return {
        address: state.address,
        chainId: state.chainId,
        connected: state.connected,
        balances: {
          ...state.balances
        }
      };
    }
  };

  /* =========================
     INITIALIZE
     ========================= */

  async function initialize() {
    const provider =
      window.ethereum || null;

    if (provider) {
      state.provider = provider;

      setupProviderEvents(
        provider
      );

      await tryReconnect();
    }
  }

  /*
   * Give index.html time to load
   * before initializing.
   */

  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      initialize,
      {
        once: true
      }
    );
  } else {
    initialize();
  }

})();
