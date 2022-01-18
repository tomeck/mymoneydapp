const anchor = require( '@project-serum/anchor');
const {Keypair, SystemProgram, Connection, clusterApiUrl} = require('@solana/web3.js');
const assert = require('assert');
const serumCmn = require("@project-serum/common");
const TokenInstructions = require("@project-serum/serum").TokenInstructions;

const {
  createMint,
  createTokenAccount,
  getTokenAccount,
} = require('./utils');

// Read the generated IDL.
const idl = JSON.parse(
  require("fs").readFileSync("./target/idl/mymoneydapp.json", "utf8")
);


describe('mint-test', () => {

  // const connection=new Connection(clusterApiUrl("devnet"),"confirmed");
  // console.log(connection);
  
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);
  //const program = anchor.workspace.Mymoneydapp;


  // Address of the deployed program.
  // !!! TODO For some reason the program address isn't in the IDL
  // const programId = new anchor.web3.PublicKey(idl.metadata.address);
  // console.log("ProgramID is", programId.toBase58());

  // Address of the deployed program.
  const programId = "3vyAh7j33TXxNsx4GFfpbJJihwrPkQ8dz6YrqyDcuJN1";

  // Generate the program client from IDL.
  const program = new anchor.Program(idl, programId);



  let mint = null;
  let from = null;

  it("Initializes test state", async () => {
    mint = await createMint(provider,undefined);
    from = await createTokenAccount(provider, mint, provider.wallet.publicKey);
    console.log("mint:", mint.toBase58());
    console.log("from:", from.toBase58());
    console.log("owner:", provider.wallet.publicKey.toBase58());
  });

  it("Mints a token", async () => {
    const numTokens = 1000000;
    // Mint 1000 of our tokens to our FROM account
    let signature = await program.rpc.proxyMintTo(new anchor.BN(numTokens), {
      accounts: {
        authority: provider.wallet.publicKey,
        mint,
        to: from,
        tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
      },
    });

    console.log("Minting mint", mint.toBase58());
    
    // Validate that the tokens are there
    const fromAccount = await getTokenAccount(provider, from);

    assert.ok(fromAccount.amount.eq(new anchor.BN(numTokens)));
  });

});

