import { PublicKey } from "@solana/web3.js";

const anchor = require( '@project-serum/anchor');
const {Keypair, SystemProgram, Connection, clusterApiUrl} = require('@solana/web3.js');
const assert = require('assert');
const serumCmn = require("@project-serum/common");
const TokenInstructions = require("@project-serum/serum").TokenInstructions;
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from '@solana/spl-token';


const {
  createMint,
  createTokenAccount,
  getTokenAccount,
} = require('./utils');

// Read the generated IDL.
const idl = JSON.parse(
  require("fs").readFileSync("./target/idl/mymoneydapp.json", "utf8")
);

let ata = null;

describe('getATA', () => {

  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

  // Address of the deployed program.
  const programId = "3vyAh7j33TXxNsx4GFfpbJJihwrPkQ8dz6YrqyDcuJN1";

  // The token mint address
  const mint = new PublicKey("BriQC6NkjrYRSXpoUqoW8cWJtESrtwUufJbAoLMkkCme");

  // The user account for which we'll derive an ATA (Associated Token Account)
  let recipient = new PublicKey("86RktQHEp34vbgpj5LnDzctzZurKTAhfJae94c8vLThY");
  
  // The vault where the tokens are held
  const vault = new PublicKey("mL7fT2kDHxhecEmQ25vSuFuy3LyuEuPFHmz5MaGsYB9");

  // Generate the program client from IDL.
  const program = new anchor.Program(idl, programId);
  
  it("Derives an ATA for specified recipient address", async () => {

    console.log("Deriving ATA for", recipient.toBase58());
  
    // calculate ATA
    ata = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID, // always ASSOCIATED_TOKEN_PROGRAM_ID
      TOKEN_PROGRAM_ID, // always TOKEN_PROGRAM_ID
      mint, // mint
      recipient // owner
    );
    console.log(`Got ATA: ${ata.toBase58()}`);
    // Returns "FEPeJcSkW7j4dVm7DY2zgFrX3G143dDgyjqEKGa9QTxx" for account associated
    // with Phantom wallet 'SolDevNetWallet'
    
    // Validate that the tokens are there
    const ataAccount = await getTokenAccount(provider, ata);
    console.log(`ATA account balance: ${ataAccount.amount}`);
  });

  it("Transfers tokens to ATA", async () => {

    console.log("Transfers tokens to ATA", ata.toBase58());
  
    console.log("Transferring from", vault.toBase58(), "to", ata.toBase58());
    await program.rpc.proxyTransfer(new anchor.BN(1), {
      accounts: {
        authority: provider.wallet.publicKey,
        to: ata,
        from: vault,
        tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
      },
    });
    console.log("Transfer is complete")
  });
});

