let BITBOX = require("bitbox-sdk").BITBOX;
let bitbox = new BITBOX();

let langs = [
  "english",
  "chinese_simplified",
  "chinese_traditional",
  "korean",
  "japanese",
  "french",
  "italian",
  "spanish"
];

let lang = langs[Math.floor(Math.random() * langs.length)];

// create 256 bit BIP39 mnemonic
let mnemonic = bitbox.Mnemonic.generate(256, bitbox.Mnemonic.wordLists()[lang]);
console.log("BIP44 $BCH Wallet");
console.log(`256 bit ${lang} BIP39 Mnemonic: `, mnemonic);

// root seed buffer
let rootSeed = bitbox.Mnemonic.toSeed(mnemonic);

// master HDNode
let masterHDNode = bitbox.HDNode.fromSeed(rootSeed, "mainnet");

// HDNode of BIP44 account
let account = bitbox.HDNode.derivePath(masterHDNode, "m/44'/145'/0'");
console.log(`BIP44 Account: "m/44'/145'/0'"`);

for (let i = 0; i < 10; i++) {
  let childNode = masterHDNode.derivePath(`m/44'/145'/0'/0/${i}`);
  console.log(
    `m/44'/145'/0'/0/${i}: ${bitbox.HDNode.toCashAddress(childNode)}`
  );
}

// derive the first external change address HDNode which is going to spend utxo
let change = bitbox.HDNode.derivePath(account, "0/0");

// get the cash address
let cashAddress = bitbox.HDNode.toCashAddress(change);

let hex;

bitbox.Address.utxo(cashAddress).then(
  result => {
    if (!result.utxos[0]) {
      return;
    }

    // instance of transaction builder
    let transactionBuilder = new bitbox.TransactionBuilder("mainnet");
    // original amount of satoshis in vin
    let originalAmount = result.utxos[0].satoshis;

    // index of vout
    let vout = result.utxos[0].vout;

    // txid of vout
    let txid = result.utxos[0].txid;

    // add input with txid and index of vout
    transactionBuilder.addInput(txid, vout);

    // get byte count to calculate fee. paying 1 sat/byte
    let byteCount = bitbox.BitcoinCash.getByteCount({ P2PKH: 1 }, { P2PKH: 1 });
    // 192
    // amount to send to receiver. It's the original amount - 1 sat/byte for tx size
    let sendAmount = originalAmount - byteCount;

    // add output w/ address and amount to send
    transactionBuilder.addOutput(cashAddress, sendAmount);

    // keypair
    let keyPair = bitbox.HDNode.toKeyPair(change);

    // sign w/ HDNode
    let redeemScript;
    transactionBuilder.sign(
      0,
      keyPair,
      redeemScript,
      transactionBuilder.hashTypes.SIGHASH_ALL,
      originalAmount
    );

    // build tx
    let tx = transactionBuilder.build();
    // output rawhex
    let hex = tx.toHex();
    console.log(`Transaction raw hex: ${hex}`);

    // sendRawTransaction to running BCH node
    bitbox.RawTransactions.sendRawTransaction(hex).then(
      result => {
        console.log(`Transaction ID: ${result}`);
      },
      err => {
        console.log(err);
      }
    );
  },
  err => {
    console.log(err);
  }
);
