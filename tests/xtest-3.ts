import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { Mymoneydapp } from '../target/types/mymoneydapp';
const assert = require('assert');
import { PublicKey } from "@solana/web3.js";

const serumCmn = require("@project-serum/common");
const TokenInstructions = require("@project-serum/serum").TokenInstructions;

// Read the generated IDL.
const idl = JSON.parse(
  require("fs").readFileSync("./target/idl/mymoneydapp.json", "utf8")
);

describe('test-3', () => {

  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

  // Address of the deployed program.
  const programId = "3vyAh7j33TXxNsx4GFfpbJJihwrPkQ8dz6YrqyDcuJN1";

  // The token mint address
  const mint = new PublicKey("BriQC6NkjrYRSXpoUqoW8cWJtESrtwUufJbAoLMkkCme");

  // The vault where the tokens are held
  const vault = new PublicKey("mL7fT2kDHxhecEmQ25vSuFuy3LyuEuPFHmz5MaGsYB9");

  // The recipient of a PDA and a token
  //const recipient = 

  // Generate the program client from IDL.
  const program = new anchor.Program(idl, programId);

  // let recipient = provider.wallet.publicKey;
  let recipient = new PublicKey("86RktQHEp34vbgpj5LnDzctzZurKTAhfJae94c8vLThY");
  let recipientTokenAccount = new PublicKey("FEwV9yzLChYKLV4QdHyGZReKAyiU5Xbc1UyCGWMB1rhQ");
 

  it("Creates a PDA token account", async () => {
    // mint = await createMint(provider,undefined);
    // from = await createTokenAccount(provider, mint, provider.wallet.publicKey);
    // to = await createTokenAccount(provider, mint, provider.wallet.publicKey);
    // to = new PublicKey("F9Y5FCg3z5tQKkeScg3NpaHNUz5sAN4XocRbn25LZNMV");
    // console.log("mint:", mint.toBase58());
    // console.log("from:", from.toBase58());
    // console.log("to:", to.toBase58());

    // JTE TODO Uncomment this to derive a new token account for recipient
    //***recipientTokenAccount = await createTokenAccount(provider, mint, recipient);
  });

  /*
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
  */

  it("Transfers a token", async () => {
    console.log("Transferring from", vault.toBase58(), "to", recipientTokenAccount.toBase58());
    await program.rpc.proxyTransfer(new anchor.BN(1), {
      accounts: {
        authority: provider.wallet.publicKey,
        to: recipientTokenAccount,
        from: vault,
        tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
      },
    });
    console.log("Transfer is complete")
    /*
    const fromAccount = await getTokenAccount(provider, from);
    const toAccount = await getTokenAccount(provider, to);

    assert.ok(fromAccount.amount.eq(new anchor.BN(600)));
    assert.ok(toAccount.amount.eq(new anchor.BN(400)));
    */
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