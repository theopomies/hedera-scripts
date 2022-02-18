import { AccountId, PrivateKey } from "@hashgraph/sdk";
import { createNft, mintNft } from "./nft";
import {
  associateTokenFromContract,
  createSmartContract,
  storeContractFile,
  transferNftFromContract,
} from "./smartContract";
import { balanceChecker, createAccount } from "./utils";

async function main() {
  /**
   * Setup everything before the use of the contract
   */
  const treasury = {
    accountId: process.env.ADMIN_ACCOUNT_ID!,
    publicKey: process.env.ADMIN_ACCOUNT_PUBLIC_KEY!,
    privateKey: PrivateKey.fromString(process.env.ADMIN_ACCOUNT_PRIVATE_KEY!),
  };
  const client = await createAccount();
  const client2 = await createAccount();
  if (!client || !client2 || !treasury) {
    console.error("No Account created.");
    return;
  }
  const tokenId = await createNft("Test Contract Nft", "TCN", treasury);
  if (!tokenId) {
    console.error("No Token created.");
    return;
  }
  const tokenSerial = await mintNft(tokenId, treasury.privateKey);
  await balanceChecker(
    tokenId,
    treasury.accountId,
    client.accountId,
    client2.accountId,
  );

  /**
   * Now we start using the contract (precompiled and hardcoded)
   */
  const fileId = await storeContractFile();
  if (!fileId) {
    console.error("No FileId.");
    return;
  }

  const contractId = await createSmartContract(fileId);
  if (!contractId) {
    console.error("No ContractId.");
    return;
  }

  await associateTokenFromContract(
    contractId,
    client.accountId,
    client.privateKey,
    tokenId
  );

  await associateTokenFromContract(
    contractId,
    client2.accountId,
    client2.privateKey,
    tokenId
  );

  await transferNftFromContract(
    contractId,
    tokenId,
    tokenSerial,
    AccountId.fromString(treasury.accountId),
    client.accountId,
    treasury.privateKey
  );

  await balanceChecker(
    tokenId,
    treasury.accountId,
    client.accountId,
    client2.accountId,
  );
}

main();
