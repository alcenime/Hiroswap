/* =========================================================
   HIRO SWAP — abi.js
   Robinhood Chain
   ========================================================= */

/*
 * =========================================================
 * ERC20 ABI
 * =========================================================
 */

const ERC20_ABI = [
  {
    "name": "name",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string"
      }
    ]
  },

  {
    "name": "symbol",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string"
      }
    ]
  },

  {
    "name": "decimals",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8"
      }
    ]
  },

  {
    "name": "balanceOf",
    "type": "function",
    "stateMutability": "view",
    "inputs": [
      {
        "name": "account",
        "type": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ]
  },

  {
    "name": "allowance",
    "type": "function",
    "stateMutability": "view",
    "inputs": [
      {
        "name": "owner",
        "type": "address"
      },
      {
        "name": "spender",
        "type": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ]
  },

  {
    "name": "approve",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [
      {
        "name": "spender",
        "type": "address"
      },
      {
        "name": "amount",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ]
  },

  {
    "name": "transfer",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [
      {
        "name": "to",
        "type": "address"
      },
      {
        "name": "amount",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ]
  }
];


/*
 * =========================================================
 * UNISWAP V3 QUOTER V2 ABI
 * =========================================================
 */

const QUOTER_V2_ABI = [

  {
    "name": "quoteExactInputSingle",
    "type": "function",
    "stateMutability": "nonpayable",

    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "components": [
          {
            "name": "tokenIn",
            "type": "address"
          },
          {
            "name": "tokenOut",
            "type": "address"
          },
          {
            "name": "amountIn",
            "type": "uint256"
          },
          {
            "name": "fee",
            "type": "uint24"
          },
          {
            "name": "sqrtPriceLimitX96",
            "type": "uint160"
          }
        ]
      }
    ],

    "outputs": [
      {
        "name": "amountOut",
        "type": "uint256"
      },
      {
        "name": "sqrtPriceX96After",
        "type": "uint160"
      },
      {
        "name": "initializedTicksCrossed",
        "type": "uint32"
      },
      {
        "name": "gasEstimate",
        "type": "uint256"
      }
    ]
  },

  {
    "name": "quoteExactInput",
    "type": "function",
    "stateMutability": "nonpayable",

    "inputs": [
      {
        "name": "path",
        "type": "bytes"
      },
      {
        "name": "amountIn",
        "type": "uint256"
      }
    ],

    "outputs": [
      {
        "name": "amountOut",
        "type": "uint256"
      },
      {
        "name": "sqrtPriceX96AfterList",
        "type": "uint160[]"
      },
      {
        "name": "initializedTicksCrossedList",
        "type": "uint32[]"
      },
      {
        "name": "gasEstimate",
        "type": "uint256"
      }
    ]
  }
];


/*
 * =========================================================
 * UNISWAP V3 SWAP ROUTER ABI
 * =========================================================
 */

const SWAP_ROUTER_ABI = [

  {
    "name": "exactInputSingle",
    "type": "function",
    "stateMutability": "payable",

    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "components": [
          {
            "name": "tokenIn",
            "type": "address"
          },
          {
            "name": "tokenOut",
            "type": "address"
          },
          {
            "name": "fee",
            "type": "uint24"
          },
          {
            "name": "recipient",
            "type": "address"
          },
          {
            "name": "deadline",
            "type": "uint256"
          },
          {
            "name": "amountIn",
            "type": "uint256"
          },
          {
            "name": "amountOutMinimum",
            "type": "uint256"
          },
          {
            "name": "sqrtPriceLimitX96",
            "type": "uint160"
          }
        ]
      }
    ],

    "outputs": [
      {
        "name": "amountOut",
        "type": "uint256"
      }
    ]
  },

  {
    "name": "exactInput",
    "type": "function",
    "stateMutability": "payable",

    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "components": [
          {
            "name": "path",
            "type": "bytes"
          },
          {
            "name": "recipient",
            "type": "address"
          },
          {
            "name": "deadline",
            "type": "uint256"
          },
          {
            "name": "amountIn",
            "type": "uint256"
          },
          {
            "name": "amountOutMinimum",
            "type": "uint256"
          }
        ]
      }
    ],

    "outputs": [
      {
        "name": "amountOut",
        "type": "uint256"
      }
    ]
  },

  {
    "name": "refundETH",
    "type": "function",
    "stateMutability": "payable",
    "inputs": [],
    "outputs": []
  },

  {
    "name": "unwrapWETH9",
    "type": "function",
    "stateMutability": "payable",

    "inputs": [
      {
        "name": "amountMinimum",
        "type": "uint256"
      },
      {
        "name": "recipient",
        "type": "address"
      }
    ],

    "outputs": []
  },

  {
    "name": "WETH9",
    "type": "function",
    "stateMutability": "view",

    "inputs": [],

    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ]
  }
];


/*
 * =========================================================
 * WETH9 ABI
 * =========================================================
 */

const WETH_ABI = [

  {
    "name": "deposit",
    "type": "function",
    "stateMutability": "payable",

    "inputs": [],

    "outputs": []
  },

  {
    "name": "withdraw",
    "type": "function",
    "stateMutability": "nonpayable",

    "inputs": [
      {
        "name": "wad",
        "type": "uint256"
      }
    ],

    "outputs": []
  },

  {
    "name": "balanceOf",
    "type": "function",
    "stateMutability": "view",

    "inputs": [
      {
        "name": "account",
        "type": "address"
      }
    ],

    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ]
  },

  {
    "name": "approve",
    "type": "function",
    "stateMutability": "nonpayable",

    "inputs": [
      {
        "name": "spender",
        "type": "address"
      },
      {
        "name": "amount",
        "type": "uint256"
      }
    ],

    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ]
  }
];


/*
 * =========================================================
 * HIRO SWAP CONTRACT ADDRESSES
 * =========================================================
 */

const HIRO_CONTRACTS = {

  CHAIN_ID: 4663,

  RPC:
    'https://rpc.mainnet.chain.robinhood.com',

  WETH:
    '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',

  PONS:
    '0x39dBED3a2bd333467115dE45665cC57F813C4571',

  USDG:
    '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',

  CASHCAT:
    '0x020bfc650a365f8bb26819deaabf3e21291018b4',

  QUOTER_V2:
    '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7',

  SWAP_ROUTER:
    '0xCaf681a66D020601342297493863E78C959E5cb2',

  FACTORY:
    '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA',

  POSITION_MANAGER:
    '0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3',

  /*
   * PONS V3 pool fee
   */
  POOL_FEE:
    10000
};


/*
 * =========================================================
 * TOKEN DECIMALS
 * =========================================================
 */

const HIRO_TOKEN_DECIMALS = {

  ETH: 18,

  PONS: 18,

  USDG: 6,

  CASHCAT: 18

};


/*
 * =========================================================
 * EXPORT
 * =========================================================
 */

window.HiroABI = {

  ERC20_ABI,

  QUOTER_V2_ABI,

  SWAP_ROUTER_ABI,

  WETH_ABI,

  CONTRACTS:
    HIRO_CONTRACTS,

  DECIMALS:
    HIRO_TOKEN_DECIMALS

};
