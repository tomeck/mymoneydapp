const anchor = require( '@project-serum/anchor');
const {LAMPORTS_PER_SOL, PublicKey, AccountInfo, Keypair, Transaction, SystemProgram, Connection, clusterApiUrl} = require('@solana/web3.js');
const serumCmn = require("@project-serum/common");
const TokenInstructions = require("@project-serum/serum").TokenInstructions;
import { closeAccount } from '@project-serum/serum/lib/token-instructions';
// import { token } from '@project-serum/anchor/dist/cjs/utils';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from '@solana/spl-token';
//import { PublicKey } from '@solana/web3.js';

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
  // let merchantATA = null;
  // let merchantAccount = null;
  // let merchantBaseAccount = null;

  let depositAcctPK = null
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


  it("Creates deposit account for receiving payment", async () => {

    console.log("Creating deposit account for receiving payment preauth");
  
    try {

      depositAcctPK = await createTokenAccount(provider, mint, provider.wallet.publicKey);
 
      console.log("Created deposit account at", depositAcctPK.toBase58());
    } catch (error) {
      console.log("Error creating deposit account", error)
    }
  });

  it("Transfers tokens from deposit account to merchant master account", async () => {

    
    try {

      // Fetch deposit account so can get its balance
      console.log("Getting deposit account at", depositAcctPK.toBase58());
      const depositAcct = await getTokenAccount(provider, depositAcctPK);
      const tokenBalance = depositAcct.amount;
      console.log("Got account, token balance is", tokenBalance)

      console.log("Transferring all", tokenBalance, " tokens from", depositAcctPK.toBase58(), "to", merchantATATokenAcct.publicKey.toBase58());
      // Transfer all tokens from the deposit account
      await program.rpc.proxyTransfer(new anchor.BN(tokenBalance), {
        accounts: {
          authority: provider.wallet.publicKey,
          to: merchantATATokenAcct.publicKey,
          from: depositAcctPK,
          tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
        },
      });
      console.log("Transfer is complete")

      // Close the deposit account
      const resp = await closeTokenAccount(provider, depositAcctPK);
      console.log("Account closed with response", resp)

    } catch (error) {
      console.log("Error transferring tokens from deposit account to merchant master account", error)
    }
  });

  it("Invokes preauth()", async () => {

    console.log("Invoking preauth");
  
    // amount, provider, consumerPK, merchantPK, mintPK
    try {
      const consumerAta: PublicKey = await preauth(1 /*amount*/, provider, consumerPK, merchantPK, mint);
      console.log("Preauth successful, ATA is", consumerAta.toBase58());
    } catch (error) {
      console.log("Error invoking preauth()", error)
    }
  });
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

// Close the specified token account
export async function closeTokenAccount(provider, closingAcctPK) {

  console.log("Closing token account", closingAcctPK.toBase58());

  let tx = new Transaction();
  tx.add(
    Token.createCloseAccountInstruction(
      new PublicKey(TOKEN_PROGRAM_ID), // fixed
      new PublicKey(closingAcctPK), // to be closed token account
      new PublicKey(provider.wallet.publicKey), // rent's destination
      new PublicKey(provider.wallet.publicKey), // account owner
      [] // multisig
    )
  );
  tx.feePayer = provider.wallet.publicKey;

  const sig = await provider.connection.sendTransaction(tx, [provider.wallet.payer]);

  console.log("Closed token account", closingAcctPK.toBase58(), "signature is", sig);
}


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


export async function preauth(amount, provider, consumerPK, merchantPK, mintPK
  ) : Promise<PublicKey> {

    // 1. Get token account for consumer
    const lConsumerATATokenAcct: TokenAccount = await getTokenAccountFromWalletPK(provider, consumerPK, mintPK);

    if( lConsumerATATokenAcct == null ) {
      throw Error("Cannot locate consumer token account for consumerPK " + consumerPK.toBase58());
    }

    // 2. Check that consumer has sufficient funds for transaction
    if( lConsumerATATokenAcct.accountInfo.amount < amount ) {
      throw Error("Consumer has insufficient funds for this transaction");
    }

    // 3. Get token account for merchant
    const lMerchantATATokenAcct: TokenAccount = await getTokenAccountFromWalletPK(provider, merchantPK, mintPK);

    if( lMerchantATATokenAcct == null ) {
      throw Error("Cannot located merchant token account for merchantPK " + merchantPK.toBase58());
    }

    // 4. return address to which consumer should transfer coin(s)
    return lMerchantATATokenAcct.publicKey;

      /*
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

      /*
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
    */
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
