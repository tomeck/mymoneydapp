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
  let consumerPK = new PublicKey("5svtgSJUtLyd4DTUNzRctx7sZSN8nsc5HjjkiwbugSUG");
  
  it("Invokes preauth()", async () => {

    console.log("Invoking preauth");
  
    try {
      const consumerAta = await preauth(1, provider, consumerPK, mint);
      console.log("Preauth successful, ATA is", consumerAta.toBase58());
    } catch (error) {
      console.log("Error invoking preauth()", error)
    }
    
  });

  it("Retrieves consumer base account", async () => {

    console.log("Getting consumer base account for", consumerPK.toBase58());
  
    merchantBaseAccount = await provider.connection.getAccountInfo(consumerPK);
    assert(merchantBaseAccount != null);

    console.log(`consumer account balance: ${merchantBaseAccount.lamports/LAMPORTS_PER_SOL} SOL`);
  });

  it("Checks balance for ATA", async () => {

    console.log("Deriving ATA for consumer", consumerPK.toBase58());
  
    // calculate ATA
    merchantATA = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID, // always ASSOCIATED_TOKEN_PROGRAM_ID
      TOKEN_PROGRAM_ID, // always TOKEN_PROGRAM_ID
      mint, // mint
      consumerPK // owner
    );
    console.log(`Got ATA for consumer: ${merchantATA.toBase58()}`);
    // Returns "2cBgknSvSgcYu1bLXFE1qfaPTtDEycS4vLMp6TUChHP7" for account associated
    // with Phantom wallet 'RecipientWallet'
    
    // Validate that the tokens are there
    try {
      // Throws exception if specified token account not fouund
      const ataAccount = await getTokenAccount(provider, merchantATA);
      console.log(`ATA account balance: ${ataAccount.amount} for account ${merchantATA}`);

    } catch (error) {

      console.log("Merchant account not found, creating token account for", merchantATA.toBase58());
      
      try {
        const newTokenAccount = await createTokenAssociatedAccount(provider, consumerPK, mint);
        console.log("New account created with owner", newTokenAccount.owner.toBase58())

      } catch (innerError) {
        console.log("Error creating token account", innerError);
      }

    }
  });
});

//
// Functions
//
export async function preauth(amount, provider, consumerPK, mintPK 
  ) : Promise<string> {

    let consumerATA = null;
    let ataAccount = null;

    try {
      // 1. Generate address of derived token account for specified PK
      console.log("Attempting to derive ATA for base address", consumerPK.toBase58());
      consumerATA = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID, // always ASSOCIATED_TOKEN_PROGRAM_ID
        TOKEN_PROGRAM_ID, // always TOKEN_PROGRAM_ID
        mintPK, // mint
        consumerPK // owner
      );
      console.log("Got ATA", consumerATA.toBase58(), "for base address", consumerPK.toBase58());

      // 2. Attempt to fetch token derived account for consumerPK
      // Throws exception if specified token account not found
      console.log("Fetching token ATA account at", consumerATA.toBase58());
      ataAccount = await getTokenAccount(provider, consumerATA);
      console.log(`ATA account balance: ${ataAccount.amount} for account ${consumerATA}`);

    } catch (error) {

      console.log("Consumer token account not found, creating token account for", consumerATA.toBase58());
      
      try {

        // 3. (optional) Create token associated account since doesn't exist
        ataAccount = await createTokenAssociatedAccount(provider, consumerPK, mintPK);
        console.log("New account created with owner", ataAccount.owner.toBase58())
      } catch (innerError) {
        console.log("Error creating token account", innerError);
        throw innerError;  // rethrow error
      }
    }

    // If we get here, either the token account existed or we just created it

    // 4. Check that account has sufficient funds for preauth
    if( ataAccount.balance < amount) {
      throw new Error("Insufficient balance for transaction");
    }

    return consumerATA;
}

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
  
    // !!!! Implicit RETURN <------------------!
    await mintToken.getOrCreateAssociatedAccountInfo(
      publicKey
    );
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

