import * as anchor from '@project-serum/anchor';
const assert = require('assert');

const serumCmn = require("@project-serum/common");
const TokenInstructions = require("@project-serum/serum").TokenInstructions;

export const MINT_ACCOUNT_PUBKEY = "7SJhB3KueZYG2EeNJDcVvR1sw3stLPixQPVqNUikCKdy";
export const MINT_AUTHORITY = "6731csE9cua4k8bum6JsrTeFyG1njm3fZEFHc7yziCbn";
export const LOCAL_WALLET_PUBKEY = "6731csE9cua4k8bum6JsrTeFyG1njm3fZEFHc7yziCbn";

const TOKEN_PROGRAM_ID = new anchor.web3.PublicKey(
    TokenInstructions.TOKEN_PROGRAM_ID.toString()
  );
  
  export async function getTokenAccount(provider, addr) {
    return await serumCmn.getTokenAccount(provider, addr);
  }
  
  export async function getMintInfo(provider, mintAddr) {
    return await serumCmn.getMintInfo(provider, mintAddr);
  }
  
  export async function createMint(provider, authority) {
    if (authority === undefined) {
      authority = provider.wallet.publicKey;
    }
    const mint = anchor.web3.Keypair.generate();
    const instructions = await createMintInstructions(
      provider,
      authority,
      mint.publicKey
    );
  
    const tx = new anchor.web3.Transaction();
    tx.add(...instructions);
  
    await provider.send(tx, [mint]);
  
    return mint.publicKey;
  }
  
  async function createMintInstructions(provider, authority, mint) {
    return[
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: provider.wallet.publicKey,
        newAccountPubkey: mint,
        space: 82,
        lamports: await provider.connection.getMinimumBalanceForRentExemption(82),
        programId: TOKEN_PROGRAM_ID,
      }),
      TokenInstructions.initializeMint({
        mint,
        decimals: 0,
        mintAuthority: authority,
      }),
    ];
  }
  
  export async function createTokenAccount(provider, mint, owner) {
    const LAMPORTS = 100000000; // TODO determine this in a better way
    const vault = anchor.web3.Keypair.generate();
    const tx = new anchor.web3.Transaction();
    tx.add(
      ...(await createTokenAccountInstrs(provider, vault.publicKey, mint, owner, LAMPORTS))
    );
    await provider.send(tx, [vault]);
    return vault.publicKey;
  }
  
  async function createTokenAccountInstrs(
    provider,
    newAccountPubkey,
    mint,
    owner,
    lamports
  ) {
    if (lamports === undefined) {
      lamports = await provider.connection.getMinimumBalanceForRentExemption(165);
    }
    return [
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: provider.wallet.publicKey,
        newAccountPubkey,
        space: 165,
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

