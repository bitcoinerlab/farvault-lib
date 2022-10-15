import { REGTEST } from '../../src/constants';
import { networks } from '../../src/networks';

export const fixtures = {
  discovery: {
    mnemonic:
      'battle give peanut warfare power correct door bar sleep member thunder turn',
    network: networks.regtest,
    networkIds: [REGTEST],
    //Use the paths below to create a regtest blockchain that we can query later
    paths: {
      //external: 0, change: 1
      "84'/1'/0'/0/0": [
        { balance: 50000 },
        { balance: 5000 },
        { balance: 500 }
      ], //first address funded with 3 utxos
      "84'/1'/0'/1/0": { balance: 1000 },

      "84'/1'/1'/0/11": { balance: 1000 },
      "84'/1'/1'/1/10": { balance: 5000 },
      "84'/1'/1'/1/11": { balance: 1000 },

      "84'/1'/2'/0/19": { balance: 1000 },
      "84'/1'/2'/1/11": { balance: 1000 },
      "84'/1'/2'/1/31": { balance: 1000 },
      "84'/1'/2'/1/32": { balance: 1000 },
      "84'/1'/2'/1/40": { balance: 1000 },
      //forceFetchChange & gapAccountLimit 2 & gapLimit 101 will be able to find this one:
      //forceFetchChange=true & gapAccountLimit 2 & gapLimit 100 will NOT able to find this one:
      //forceFetchChange=false & gapAccountLimit 2 & gapLimit 101 will NOT able to find this one:
      //forceFetchChange=true & gapAccountLimit 1 & gapLimit 101 will NOT able to find this one:
      "84'/1'/4'/1/100": { balance: 1000 },

      "44'/1'/0'/0/0": { balance: 1000 },
      "44'/1'/50'/0/0": { balance: 1000 }
    },
    valid: [
      {
        description:
          'Will get externals and change (if there were externals) with default limits',
        gapLimit: 20,
        gapAccountLimit: 1,
        forceFetchChange: false,
        //iancoleman
        accounts: [
          {
            extPub:
              'vpub5YGC1YqMSADvpyiDSUGwxkAAAWswSVVJSb5eB2zvZdV3g9A3i4cbJEyPz9Z5Q7QHvPT7FbAGfLWvoR7FRx2jvs2Le5ZVxXmwvso2oRkDCua',
            balance: 56500,
            usedPaths: ["84'/1'/0'/0/0", "84'/1'/0'/1/0"]
          }, //84/0
          {
            extPub:
              'vpub5YGC1YqMSADvsCS8FKuNJCqzDXRZzjME7Rns246j8M42DeKy7UqmZJhCNdvAe3upMCo3KBz3t7PtqSMqLCZuodKUeJHNAPxjPiiUD5fXshc',
            balance: 7000,
            usedPaths: ["84'/1'/1'/0/11", "84'/1'/1'/1/10", "84'/1'/1'/1/11"]
          }, //84/1
          {
            extPub:
              'vpub5YGC1YqMSADvuRPytTXwLCLpRobdcTfcZtnAkzhwNig4zHPUn2QrihungpJvzgDVjQSSpPjdvJr491MwngXuYsqupN7tCZbsK5kWFqxRhK1',
            balance: 5000,
            usedPaths: [
              "84'/1'/2'/0/19",
              "84'/1'/2'/1/11",
              "84'/1'/2'/1/31",
              "84'/1'/2'/1/32",
              "84'/1'/2'/1/40"
            ]
          }, //84/2
          {
            extPub:
              'tpubDDkrAd9qXaGuErZ9ZTRHUAdswmezHxinhHReWK86NhT4BAqxfQ7rpt8pL1cFgGVTYFcZS2tydv26gQwX1aytfriPWdGBktbUhMerx6MJWrw',
            balance: 1000,
            usedPaths: ["44'/1'/0'/0/0"]
          } //44/0
        ],
        usedPaths: [
          "84'/1'/0'/0/0",
          "84'/1'/0'/1/0",

          "84'/1'/1'/0/11",
          "84'/1'/1'/1/10",
          "84'/1'/1'/1/11",

          "84'/1'/2'/0/19",
          "84'/1'/2'/1/11",
          "84'/1'/2'/1/31",
          "84'/1'/2'/1/32",
          "84'/1'/2'/1/40",

          "44'/1'/0'/0/0"
        ]
      },
      {
        description:
          "Get distant 84'/1'/4'/1/100 change address with large gapLimit, gapAccountLimit and forceFetchChange",
        forceFetchChange: true,
        gapLimit: 101,
        gapAccountLimit: 2,
        //iancoleman
        accounts: [
          {
            extPub:
              'vpub5YGC1YqMSADvpyiDSUGwxkAAAWswSVVJSb5eB2zvZdV3g9A3i4cbJEyPz9Z5Q7QHvPT7FbAGfLWvoR7FRx2jvs2Le5ZVxXmwvso2oRkDCua',
            balance: 56500,
            usedPaths: ["84'/1'/0'/0/0", "84'/1'/0'/1/0"]
          }, //84/0
          {
            extPub:
              'vpub5YGC1YqMSADvsCS8FKuNJCqzDXRZzjME7Rns246j8M42DeKy7UqmZJhCNdvAe3upMCo3KBz3t7PtqSMqLCZuodKUeJHNAPxjPiiUD5fXshc',
            balance: 7000,
            usedPaths: ["84'/1'/1'/0/11", "84'/1'/1'/1/10", "84'/1'/1'/1/11"]
          }, //84/1
          {
            extPub:
              'vpub5YGC1YqMSADvuRPytTXwLCLpRobdcTfcZtnAkzhwNig4zHPUn2QrihungpJvzgDVjQSSpPjdvJr491MwngXuYsqupN7tCZbsK5kWFqxRhK1',
            balance: 5000,
            usedPaths: [
              "84'/1'/2'/0/19",
              "84'/1'/2'/1/11",
              "84'/1'/2'/1/31",
              "84'/1'/2'/1/32",
              "84'/1'/2'/1/40"
            ]
          }, //84/2
          {
            extPub:
              'vpub5YGC1YqMSADvzvSedzE9iDg6FzFAXT3ijCZYTQrTdK6jHUqV4vRyAfKg16pQyemKHgEajoWLZYK6yFu4uxAC71Q3K35N9xHJ4Tdg4ggpSDd',
            balance: 1000,
            usedPaths: ["84'/1'/4'/1/100"]
          }, //84/4
          {
            extPub:
              'tpubDDkrAd9qXaGuErZ9ZTRHUAdswmezHxinhHReWK86NhT4BAqxfQ7rpt8pL1cFgGVTYFcZS2tydv26gQwX1aytfriPWdGBktbUhMerx6MJWrw',
            balance: 1000,
            usedPaths: ["44'/1'/0'/0/0"]
          } //44/0
        ],
        usedPaths: [
          "84'/1'/0'/0/0",
          "84'/1'/0'/1/0",

          "84'/1'/1'/0/11",
          "84'/1'/1'/1/10",
          "84'/1'/1'/1/11",

          "84'/1'/2'/0/19",
          "84'/1'/2'/1/11",
          "84'/1'/2'/1/31",
          "84'/1'/2'/1/32",
          "84'/1'/2'/1/40",

          "84'/1'/4'/1/100",

          "44'/1'/0'/0/0"
        ]
      },
      {
        description:
          "Do NOT get distant 84'/1'/4'/1/100 change address because not forceFetchChange",
        forceFetchChange: false,
        gapLimit: 101,
        gapAccountLimit: 2,
        //iancoleman
        accounts: [
          {
            extPub:
              'vpub5YGC1YqMSADvpyiDSUGwxkAAAWswSVVJSb5eB2zvZdV3g9A3i4cbJEyPz9Z5Q7QHvPT7FbAGfLWvoR7FRx2jvs2Le5ZVxXmwvso2oRkDCua',
            balance: 56500,
            usedPaths: ["84'/1'/0'/0/0", "84'/1'/0'/1/0"]
          }, //84/0
          {
            extPub:
              'vpub5YGC1YqMSADvsCS8FKuNJCqzDXRZzjME7Rns246j8M42DeKy7UqmZJhCNdvAe3upMCo3KBz3t7PtqSMqLCZuodKUeJHNAPxjPiiUD5fXshc',
            balance: 7000,
            usedPaths: ["84'/1'/1'/0/11", "84'/1'/1'/1/10", "84'/1'/1'/1/11"]
          }, //84/1
          {
            extPub:
              'vpub5YGC1YqMSADvuRPytTXwLCLpRobdcTfcZtnAkzhwNig4zHPUn2QrihungpJvzgDVjQSSpPjdvJr491MwngXuYsqupN7tCZbsK5kWFqxRhK1',
            balance: 5000,
            usedPaths: [
              "84'/1'/2'/0/19",
              "84'/1'/2'/1/11",
              "84'/1'/2'/1/31",
              "84'/1'/2'/1/32",
              "84'/1'/2'/1/40"
            ]
          }, //84/2
          {
            extPub:
              'tpubDDkrAd9qXaGuErZ9ZTRHUAdswmezHxinhHReWK86NhT4BAqxfQ7rpt8pL1cFgGVTYFcZS2tydv26gQwX1aytfriPWdGBktbUhMerx6MJWrw',
            balance: 1000,
            usedPaths: ["44'/1'/0'/0/0"]
          } //44/0
        ],
        usedPaths: [
          "84'/1'/0'/0/0",
          "84'/1'/0'/1/0",

          "84'/1'/1'/0/11",
          "84'/1'/1'/1/10",
          "84'/1'/1'/1/11",

          "84'/1'/2'/0/19",
          "84'/1'/2'/1/11",
          "84'/1'/2'/1/31",
          "84'/1'/2'/1/32",
          "84'/1'/2'/1/40",

          "44'/1'/0'/0/0"
        ]
      },
      {
        description:
          "Do NOT get distant 84'/1'/4'/1/100 change address because not enough gapLimit",
        forceFetchChange: true,
        gapLimit: 100,
        gapAccountLimit: 2,
        //iancoleman
        accounts: [
          {
            extPub:
              'vpub5YGC1YqMSADvpyiDSUGwxkAAAWswSVVJSb5eB2zvZdV3g9A3i4cbJEyPz9Z5Q7QHvPT7FbAGfLWvoR7FRx2jvs2Le5ZVxXmwvso2oRkDCua',
            balance: 56500,
            usedPaths: ["84'/1'/0'/0/0", "84'/1'/0'/1/0"]
          }, //84/0
          {
            extPub:
              'vpub5YGC1YqMSADvsCS8FKuNJCqzDXRZzjME7Rns246j8M42DeKy7UqmZJhCNdvAe3upMCo3KBz3t7PtqSMqLCZuodKUeJHNAPxjPiiUD5fXshc',
            balance: 7000,
            usedPaths: ["84'/1'/1'/0/11", "84'/1'/1'/1/10", "84'/1'/1'/1/11"]
          }, //84/1
          {
            extPub:
              'vpub5YGC1YqMSADvuRPytTXwLCLpRobdcTfcZtnAkzhwNig4zHPUn2QrihungpJvzgDVjQSSpPjdvJr491MwngXuYsqupN7tCZbsK5kWFqxRhK1',
            balance: 5000,
            usedPaths: [
              "84'/1'/2'/0/19",
              "84'/1'/2'/1/11",
              "84'/1'/2'/1/31",
              "84'/1'/2'/1/32",
              "84'/1'/2'/1/40"
            ]
          }, //84/2
          {
            extPub:
              'tpubDDkrAd9qXaGuErZ9ZTRHUAdswmezHxinhHReWK86NhT4BAqxfQ7rpt8pL1cFgGVTYFcZS2tydv26gQwX1aytfriPWdGBktbUhMerx6MJWrw',
            balance: 1000,
            usedPaths: ["44'/1'/0'/0/0"]
          } //44/0
        ],
        usedPaths: [
          "84'/1'/0'/0/0",
          "84'/1'/0'/1/0",

          "84'/1'/1'/0/11",
          "84'/1'/1'/1/10",
          "84'/1'/1'/1/11",

          "84'/1'/2'/0/19",
          "84'/1'/2'/1/11",
          "84'/1'/2'/1/31",
          "84'/1'/2'/1/32",
          "84'/1'/2'/1/40",

          "44'/1'/0'/0/0"
        ]
      },
      {
        description:
          "Do NOT get distant 84'/1'/4'/1/100 change address because not enough gapAccountLimit",
        forceFetchChange: true,
        gapLimit: 101,
        gapAccountLimit: 1,
        //iancoleman
        accounts: [
          {
            extPub:
              'vpub5YGC1YqMSADvpyiDSUGwxkAAAWswSVVJSb5eB2zvZdV3g9A3i4cbJEyPz9Z5Q7QHvPT7FbAGfLWvoR7FRx2jvs2Le5ZVxXmwvso2oRkDCua',
            balance: 56500,
            usedPaths: ["84'/1'/0'/0/0", "84'/1'/0'/1/0"]
          }, //84/0
          {
            extPub:
              'vpub5YGC1YqMSADvsCS8FKuNJCqzDXRZzjME7Rns246j8M42DeKy7UqmZJhCNdvAe3upMCo3KBz3t7PtqSMqLCZuodKUeJHNAPxjPiiUD5fXshc',
            balance: 7000,
            usedPaths: ["84'/1'/1'/0/11", "84'/1'/1'/1/10", "84'/1'/1'/1/11"]
          }, //84/1
          {
            extPub:
              'vpub5YGC1YqMSADvuRPytTXwLCLpRobdcTfcZtnAkzhwNig4zHPUn2QrihungpJvzgDVjQSSpPjdvJr491MwngXuYsqupN7tCZbsK5kWFqxRhK1',
            balance: 5000,
            usedPaths: [
              "84'/1'/2'/0/19",
              "84'/1'/2'/1/11",
              "84'/1'/2'/1/31",
              "84'/1'/2'/1/32",
              "84'/1'/2'/1/40"
            ]
          }, //84/2
          {
            extPub:
              'tpubDDkrAd9qXaGuErZ9ZTRHUAdswmezHxinhHReWK86NhT4BAqxfQ7rpt8pL1cFgGVTYFcZS2tydv26gQwX1aytfriPWdGBktbUhMerx6MJWrw',
            balance: 1000,
            usedPaths: ["44'/1'/0'/0/0"]
          } //44/0
        ],
        usedPaths: [
          "84'/1'/0'/0/0",
          "84'/1'/0'/1/0",

          "84'/1'/1'/0/11",
          "84'/1'/1'/1/10",
          "84'/1'/1'/1/11",

          "84'/1'/2'/0/19",
          "84'/1'/2'/1/11",
          "84'/1'/2'/1/31",
          "84'/1'/2'/1/32",
          "84'/1'/2'/1/40",

          "44'/1'/0'/0/0"
        ]
      }
    ]
  }
};
