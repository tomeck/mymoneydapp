import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { Mymoneydapp } from '../target/types/mymoneydapp';
const assert = require('assert');

// const { SystemProgram, PublicKey, Connection, Transaction, Keypair, sendAndConfirmTransaction } = anchor.web3;

const serumCmn = require("@project-serum/common");
const TokenInstructions = require("@project-serum/serum").TokenInstructions;

// Read the generated IDL.
const idl = JSON.parse(
  require("fs").readFileSync("./target/idl/mymoneydapp.json", "utf8")
);

describe('mymoneydapp', () => {

  // *** ORIG
  // const provider = anchor.Provider.local();
  // anchor.setProvider(provider);
  // const program = anchor.workspace.Mymoneydapp;

  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

  // Address of the deployed program.
  const programId = "3vyAh7j33TXxNsx4GFfpbJJihwrPkQ8dz6YrqyDcuJN1";

  // Generate the program client from IDL.
  const program = new anchor.Program(idl, programId);
 
  let mint = null;
  let from = null;
  let to = null;

  it("Initializes test state", async () => {
    mint = await createMint(provider,undefined);
    from = await createTokenAccount(provider, mint, provider.wallet.publicKey);
    to = await createTokenAccount(provider, mint, provider.wallet.publicKey);
    console.log("mint:", mint.toBase58());
    console.log("from:", from.toBase58());
    console.log("to:", to.toBase58());
  });

  it("Mints a token", async () => {
    // Mint 1000 of our tokens to our FROM account
    await program.rpc.proxyMintTo(new anchor.BN(1000), {
      accounts: {
        authority: provider.wallet.publicKey,
        mint,
        to: from,
        tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
      },
    });

    // Validate that the tokens are there
    const fromAccount = await getTokenAccount(provider, from);

    assert.ok(fromAccount.amount.eq(new anchor.BN(1000)));
  });

  it("Transfers a token", async () => {
    console.log("Transferring from", from.toBase58(), "to", to.toBase58());
    await program.rpc.proxyTransfer(new anchor.BN(400), {
      accounts: {
        authority: provider.wallet.publicKey,
        to,
        from,
        tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
      },
    });

    const fromAccount = await getTokenAccount(provider, from);
    const toAccount = await getTokenAccount(provider, to);

    assert.ok(fromAccount.amount.eq(new anchor.BN(600)));
    assert.ok(toAccount.amount.eq(new anchor.BN(400)));
  });

  it("Burns a token", async () => {
    await program.rpc.proxyBurn(new anchor.BN(350), {
      accounts: {
        authority: provider.wallet.publicKey,
        mint,
        to,
        tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
      },
    });

    const toAccount = await getTokenAccount(provider, to);
    assert.ok(toAccount.amount.eq(new anchor.BN(50)));
  });

  it("Set new mint authority", async () => {
    const newMintAuthority = anchor.web3.Keypair.generate();
    await program.rpc.proxySetAuthority(
      { mintTokens: {} },
      newMintAuthority.publicKey,
      {
        accounts: {
          accountOrMint: mint,
          currentAuthority: provider.wallet.publicKey,
          tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
        },
      }
    );

    const mintInfo = await getMintInfo(provider, mint);
    assert.ok(mintInfo.mintAuthority.equals(newMintAuthority.publicKey));
  });
});

const TOKEN_PROGRAM_ID = new anchor.web3.PublicKey(
  TokenInstructions.TOKEN_PROGRAM_ID.toString()
);

async function getTokenAccount(provider, addr) {
  return await serumCmn.getTokenAccount(provider, addr);
}

async function getMintInfo(provider, mintAddr) {
  return await serumCmn.getMintInfo(provider, mintAddr);
}

async function createMint(provider, authority) {
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

async function createTokenAccount(provider, mint, owner) {
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