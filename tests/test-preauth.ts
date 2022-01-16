
const anchor = require( '@project-serum/anchor');
const {LAMPORTS_PER_SOL, PublicKey, SystemProgram, Connection, clusterApiUrl} = require('@solana/web3.js');
const assert = require('assert');
const serumCmn = require("@project-serum/common");
const TokenInstructions = require("@project-serum/serum").TokenInstructions;
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from '@solana/spl-token';
import fs from 'mz/fs';
import {Keypair} from '@solana/web3.js';

const {
  createMint,
  createTokenAccount,
  getTokenAccount,
} = require('./utils');

// Read the generated IDL.
const idl = JSON.parse(
  require("fs").readFileSync("./target/idl/mymoneydapp.json", "utf8")
);


let merchantATA = null;
let merchantAccount = null;
let merchantBaseAccount = null;

describe('test-preauth', () => {

  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

  // Address of the deployed program.
  const programId = "3vyAh7j33TXxNsx4GFfpbJJihwrPkQ8dz6YrqyDcuJN1";

  // The token mint address
  const mint = new PublicKey("BriQC6NkjrYRSXpoUqoW8cWJtESrtwUufJbAoLMkkCme");

  // The account representing the merchant
  // This hardcode PK is for the Phantom Wallet named `BuyerV2`
  let merchant = new PublicKey("5rhu31NibGKvgiGZkNxJgkDZdE8eACJozrDk8mGtiPEM");
  
  // The vault where the tokens are held
  const vault = new PublicKey("mL7fT2kDHxhecEmQ25vSuFuy3LyuEuPFHmz5MaGsYB9");

  // Generate the program client from IDL.
  // const program = new anchor.Program(idl, programId);

  
  it("Retrieves merchant base account", async () => {

    console.log("Getting merchant base account for", merchant.toBase58());
  
    merchantBaseAccount = await provider.connection.getAccountInfo(merchant);
    assert(merchantBaseAccount != null);

    console.log(`Merchant account balance: ${merchantBaseAccount.lamports/LAMPORTS_PER_SOL} SOL`);
  });

  it("Checks balance for ATA", async () => {

    console.log("Deriving ATA for merchant", merchant.toBase58());
  
    // calculate ATA
    merchantATA = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID, // always ASSOCIATED_TOKEN_PROGRAM_ID
      TOKEN_PROGRAM_ID, // always TOKEN_PROGRAM_ID
      mint, // mint
      merchant // owner
    );
    console.log(`Got ATA for merchant: ${merchantATA.toBase58()}`);
    // Returns "2cBgknSvSgcYu1bLXFE1qfaPTtDEycS4vLMp6TUChHP7" for account associated
    // with Phantom wallet 'RecipientWallet'
    
    // Validate that the tokens are there
    try {
      // Throws exception if specified tolen account not fouund
      const ataAccount = await getTokenAccount(provider, merchantATA);
      console.log(`ATA account balance: ${ataAccount.amount} for account ${merchantATA}`);

    } catch (error) {

      console.log("Merchant account not found", merchantATA.toBase58());
      
      createTokenAssociatedAccount(provider,merchant, mint);


    }
  });
});

export async function createTokenAssociatedAccount(provider, publicKey, mintPK ) {

  //Load Keypair of local wallet as signer (TODO JTE ??????)
  const kpSigner = await createKeypairFromFile('/Users/teck/.config/solana/id.json');

  try {
    // const PK = new PublicKey(publicKey);

    const mintToken = new Token(
      provider.connection,
      mintPK,
      TOKEN_PROGRAM_ID,
      kpSigner 
    );
  
    const fromTokenAccount = await mintToken.getOrCreateAssociatedAccountInfo(
      publicKey
    );
  
    console.log(`New account balance: ${fromTokenAccount.amount} for public key ${publicKey.toBase58()}`);
 
  } catch (error) {
    console.log("Error", error)
  }


  /*
      //Load Keypair of local wallet as signer (TODO JTE ??????)
      const kp = await createKeypairFromFile('/Users/teck/.config/solana/id.json');

      await myCreateTokenAccount(provider, merchantATA, merchant, mint, merchant, kp);
      merchantAccount = await getTokenAccount(provider, merchantATA);
      console.log(`Merchant account balance: ${merchantAccount.amount}`);
  */
}










async function myCreateTokenAccount(provider, newPubKey, fromPubkey, mint, owner, signer) {
  // const LAMPORTS = 100000000; // TODO determine this in a better way
  // const vault = anchor.web3.Keypair.generate();
  const tx = new anchor.web3.Transaction();
  tx.add(
    ...(await myCreateTokenAccountInstrs(provider, newPubKey, fromPubkey, mint, owner, undefined))
  );
  console.log("About to create account for:", newPubKey.toBase58());
  const resp = await provider.send(tx, [newPubKey]);
  console.log("Got response to createAccount:", resp);
}

async function myCreateTokenAccountInstrs(
  provider,
  newAccountPubkey,
  fromPubkey,
  mint,
  owner,
  lamports
) {
  const space = 165;
  if (lamports === undefined) {
    // JTE TODO the `size` param shouldn't be hardcoded below
    lamports = await provider.connection.getMinimumBalanceForRentExemption(space);
  }
  return [
    anchor.web3.SystemProgram.createAccount({
      fromPubkey: fromPubkey, //provider.wallet.publicKey,
      newAccountPubkey,
      space: space,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    TokenInstructions.initializeAccount({
      account: newAccountPubkey,
      mint,
      owner,
    }),
  ];
}

/**
 * Create a Keypair from a secret key stored in file as bytes' array
 */
 async function createKeypairFromFile(
  filePath: string,
): Promise<Keypair> {
  const secretKeyString = await fs.readFile(filePath, {encoding: 'utf8'});
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  return Keypair.fromSecretKey(secretKey);
}
