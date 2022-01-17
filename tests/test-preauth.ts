const anchor = require( '@project-serum/anchor');
const {LAMPORTS_PER_SOL, PublicKey, AccountInfo, Keypair, SystemProgram, Connection, clusterApiUrl} = require('@solana/web3.js');
const serumCmn = require("@project-serum/common");
const TokenInstructions = require("@project-serum/serum").TokenInstructions;
// import { token } from '@project-serum/anchor/dist/cjs/utils';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from '@solana/spl-token';

const assert = require('assert');
import fs from 'mz/fs';

const {
  createMint,
  createTokenAccount,
  getTokenAccount,
} = require('./utils');



describe('test-preauth', () => {

  // Read the generated IDL.
  const idl = JSON.parse(
    require("fs").readFileSync("./target/idl/mymoneydapp.json", "utf8")
  );

  // Globals
  let merchantATA = null;
  let merchantAccount = null;
  let merchantBaseAccount = null;
  let consumerATATokenAcct: TokenAccount = null;
  let merchantATATokenAcct: TokenAccount = null;

  // Setup provider
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

  // The token mint address
  const mint = new PublicKey("BriQC6NkjrYRSXpoUqoW8cWJtESrtwUufJbAoLMkkCme");

  // The vault where the tokens are held
  const vault = new PublicKey("mL7fT2kDHxhecEmQ25vSuFuy3LyuEuPFHmz5MaGsYB9");

  // Address of the deployed program.
  const programId = "3vyAh7j33TXxNsx4GFfpbJJihwrPkQ8dz6YrqyDcuJN1";

  // The account representing the consumer
  // This hardcode PK is for the Phantom Wallet named `Consumer`
  let consumerPK = new PublicKey("5svtgSJUtLyd4DTUNzRctx7sZSN8nsc5HjjkiwbugSUG");
  
  // The account representing the merchant
  // This hardcode PK is for the Phantom Wallet named `Merchant`
  let merchantPK = new PublicKey("GSrFHZeDsTrSZtnusFEpG8xbBeiz4MScQHw6FvfAnGjw");

  // Generate the program client from IDL.
  const program = new anchor.Program(idl, programId);

  it("Gets consumer derived token account", async () => {

    console.log("Invoking getTokenAccountFromWalletPK for consumer wallet PK", consumerPK.toBase58());
    consumerATATokenAcct = await getTokenAccountFromWalletPK(provider, consumerPK, mint);

    if( consumerATATokenAcct != null) {
      console.log(`consumer token account balance: ${consumerATATokenAcct.accountInfo.amount} ECK at ATA ${consumerATATokenAcct.publicKey.toBase58()}`);
    }
    else {
      console.log("Could not load ATA for consumer walletPK", consumerPK.toBase58());
    }
  });

  it("Gets merchant derived token account", async () => {

    console.log("Invoking getTokenAccountFromWalletPK for merchant wallet PK", merchantPK.toBase58());
    merchantATATokenAcct = await getTokenAccountFromWalletPK(provider, merchantPK, mint);

    if( merchantATATokenAcct != null) {
      console.log(`merchant token account balance: ${merchantATATokenAcct.accountInfo.amount} ECK at ATA ${merchantATATokenAcct.publicKey.toBase58()}`);
    }
    else {
      console.log("Could not load ATA for merchant walletPK", consumerPK.toBase58());
    }
  });

  it("Create consumer derived token account", async () => {

    // Create consumer ATA if not already exists from above test
    if( consumerATATokenAcct == null) {
      consumerATATokenAcct = await createTokenAssociatedAccount(provider, consumerPK, mint); 

      if( consumerATATokenAcct != null) {
        console.log("Consumer ATA created at", consumerATATokenAcct.publicKey.toBase58());
      }
      else {
        console.log("Error creating consumer ATA")
      }
    }

    assert(consumerATATokenAcct != null);
  });

  it("Create merchant derived token account", async () => {

    // Create merchant ATA if not already exists from above test
    if( merchantATATokenAcct == null) {
      merchantATATokenAcct = await createTokenAssociatedAccount(provider, merchantPK, mint); 
    }

    assert(merchantATATokenAcct != null);
  });

  it("Funds consumer account", async () => {
   
    console.log("Transferring from", vault.toBase58(), "to", consumerATATokenAcct.publicKey.toBase58());
    await program.rpc.proxyTransfer(new anchor.BN(1), {
      accounts: {
        authority: provider.wallet.publicKey,
        to: consumerATATokenAcct.publicKey,
        from: vault,
        tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
      },
    });
    console.log("Transfer is complete")
  });

  it("Invokes preauth()", async () => {

    console.log("Invoking preauth");
  
    try {
      const consumerAta = await preauth(1 /*amount*/, provider, consumerPK, mint);
      console.log("Preauth successful, ATA is", consumerAta);
    } catch (error) {
      console.log("Error invoking preauth()", error)
    }
  });

  /*
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
  */
});

//
// Structures
//
export class TokenAccount {
  public publicKey: PublicKey;
  public accountInfo: AccountInfo<any>;
}

//
// Functions
//

// Returns TokenAccount for the ATA of supplied walletPK
// Return value is null if not found
export async function getTokenAccountFromWalletPK(provider, walletPK, mintPK 
  ) : Promise<TokenAccount> {

    // Return value
    let tokenAcct = null;

    try {
      // 1. Generate address of derived token account for specified walletPK
      // console.log("Attempting to derive ATA for base address", walletPK.toBase58());
      const walletATA = await Token.getAssociatedTokenAddress(
        ASSOCIATED_TOKEN_PROGRAM_ID, // always ASSOCIATED_TOKEN_PROGRAM_ID
        TOKEN_PROGRAM_ID, // always TOKEN_PROGRAM_ID
        mintPK, // mint
        walletPK // owner
      );
      // console.log("Got ATA", walletPK.toBase58(), "for base address", walletPK.toBase58());

      // 2. Attempt to fetch token derived account for walletPK
      // Throws exception if specified token account not found
      // console.log("Fetching token ATA account at", walletATA.toBase58());
      const ataAccount = await getTokenAccount(provider, walletATA);
      // console.log(`ATA account balance: ${ataAccount.amount} for account ${walletATA}`);

      // 3. Load up a custom TokenAccount structure and return it
      tokenAcct = new TokenAccount();
      tokenAcct.accountInfo = ataAccount;
      tokenAcct.publicKey = walletATA;
    }
    catch(error) {
      console.log("Error in getTokenAccountFromWalletPK", error)
    }
   
    return tokenAcct;
  }


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
  ) : Promise<TokenAccount> {

  //Load Keypair of local wallet as signer (TODO JTE ??????)
  const kpSigner = await createKeypairFromFile('/Users/teck/.config/solana/id.json');
  console.log("Warning: function createTokenAssociatedAccount is using local Wallet to sign");

  // Return value
  let tokenAcct: TokenAccount = null;

  try {

    const mintToken = new Token(
      provider.connection,
      mintPK,
      TOKEN_PROGRAM_ID,
      kpSigner 
    );
  
    // !!!! Implicit RETURN <------------------!
    const newAcctInfo: AccountInfo<any> = await mintToken.getOrCreateAssociatedAccountInfo(
      publicKey
    );

    const ata = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID, // always ASSOCIATED_TOKEN_PROGRAM_ID
      TOKEN_PROGRAM_ID, // always TOKEN_PROGRAM_ID
      mintPK, // mint
      publicKey // owner
    );

    // Load up return value
    tokenAcct = new TokenAccount();
    tokenAcct.accountInfo = newAcctInfo;
    tokenAcct.publicKey = ata;

  } catch (error) {
    console.log("Error", error)
  }

  return tokenAcct;
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
