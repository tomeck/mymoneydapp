const anchor = require( '@project-serum/anchor');
const {LAMPORTS_PER_SOL, PublicKey, SystemProgram, Connection, clusterApiUrl} = require('@solana/web3.js');
const assert = require('assert');
const serumCmn = require("@project-serum/common");
const TokenInstructions = require("@project-serum/serum").TokenInstructions;
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from '@solana/spl-token';
import fs from 'mz/fs';
import {AccountInfo, Keypair} from '@solana/web3.js';

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

  // The token mint address
  const mint = new PublicKey("BriQC6NkjrYRSXpoUqoW8cWJtESrtwUufJbAoLMkkCme");

  // The account representing the merchant
  // This hardcode PK is for the Phantom Wallet named `Wallet7`
  let merchant = new PublicKey("5svtgSJUtLyd4DTUNzRctx7sZSN8nsc5HjjkiwbugSUG");
  
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
      // Throws exception if specified token account not fouund
      const ataAccount = await getTokenAccount(provider, merchantATA);
      console.log(`ATA account balance: ${ataAccount.amount} for account ${merchantATA}`);

    } catch (error) {

      console.log("Merchant account not found, creating token account for", merchantATA.toBase58());
      
      const newTokenAccount = await createTokenAssociatedAccount(provider,merchant, mint);

      console.log("New account created with owner", newTokenAccount.owner.toBase58())
    }
  });
});

export async function createTokenAssociatedAccount(provider, publicKey, mintPK 
  ) : Promise<any> {

  //Load Keypair of local wallet as signer (TODO JTE ??????)
  const kpSigner = await createKeypairFromFile('/Users/teck/.config/solana/id.json');

  try {

    const mintToken = new Token(
      provider.connection,
      mintPK,
      TOKEN_PROGRAM_ID,
      kpSigner 
    );
  
    const newTokenAccount = await mintToken.getOrCreateAssociatedAccountInfo(
      publicKey
    );
  
    console.log(`New account balance: ${newTokenAccount.amount} for public key ${publicKey.toBase58()}`);
    return newTokenAccount;
  } catch (error) {
    console.log("Error", error)
  }
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






/*
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
*/

