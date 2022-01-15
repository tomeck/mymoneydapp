import { PublicKey } from "@solana/web3.js";

const anchor = require( '@project-serum/anchor');
const {Keypair, SystemProgram, Connection, clusterApiUrl} = require('@solana/web3.js');
const assert = require('assert');
const serumCmn = require("@project-serum/common");
const TokenInstructions = require("@project-serum/serum").TokenInstructions;

const {
  createMint,
  createTokenAccount,
  getTokenAccount,
  getMintInfo
} = require('./utils');

// Read the generated IDL.
const idl = JSON.parse(
  require("fs").readFileSync("./target/idl/mymoneydapp.json", "utf8")
);

describe('test-token-transfer', () => {

  const provider = anchor.Provider.env();
  anchor.setProvider(provider);
  
  // Address of the deployed program.
  const programId = "3vyAh7j33TXxNsx4GFfpbJJihwrPkQ8dz6YrqyDcuJN1";

  // Generate the program client from IDL.
  const program = new anchor.Program(idl, programId);
  

  // The account to which 1000 ECK tokens were minted to
  const fromPK = new PublicKey("DnkzbynCrfVYEZVbKy81j8pWMGdFqY8i5bWX96FsmTf3");

  // The token mint address
  const mintPK = new PublicKey("BriQC6NkjrYRSXpoUqoW8cWJtESrtwUufJbAoLMkkCme");

  // My Phantom wallet account
  const toPK = new PublicKey("6731csE9cua4k8bum6JsrTeFyG1njm3fZEFHc7yziCbn");


  it("Transfers a token", async () => {
    console.log("Transferring from", fromPK.toBase58(), "to", toPK.toBase58());
  
   await program.rpc.proxyTransfer(new anchor.BN(4), {
      accounts: {
        authority: provider.wallet.publicKey,
        to: toPK,
        from: fromPK,
        tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
      },
    });

    const fromAccount = await getTokenAccount(provider, fromPK);
    const toAccount = await getTokenAccount(provider, toPK);

    assert.ok(fromAccount.amount.eq(new anchor.BN(600)));
    assert.ok(toAccount.amount.eq(new anchor.BN(400)));
  });
});

