import {
  AccountBalanceQuery,
  AccountCreateTransaction,
  AccountId,
  AccountUpdateTransaction,
  Hbar,
  PrivateKey,
  PublicKey,
  Status,
  TokenId,
} from "@hashgraph/sdk";
import { client } from "./client";

export async function createAccount(): Promise<{
  accountId: AccountId;
  publicKey: PublicKey;
  privateKey: PrivateKey;
} | null> {
  const privateKey = PrivateKey.generateED25519();
  const publicKey = privateKey.publicKey;

  const tx = new AccountCreateTransaction()
    .setKey(publicKey)
    .setInitialBalance(10)
    .freezeWith(client);

  const txResponse = await tx.execute(client);
  const { accountId } = await txResponse.getReceipt(client);

  if (accountId == null) return null;

  return {
    accountId,
    privateKey,
    publicKey,
  };
}

export async function getAccountBalance(
  accountId: string | AccountId,
  tokenId: TokenId
): Promise<[Long.Long | undefined, Hbar]> {
  const query = new AccountBalanceQuery().setAccountId(accountId);
  const response = await query.execute(client);
  return [response.tokens?._map.get(tokenId.toString()), response.hbars];
}

export async function autoAssociateAccount(
  accountId: AccountId | string,
  privateKey: PrivateKey
): Promise<Status> {
  let tx = await new AccountUpdateTransaction()
    .setAccountId(accountId)
    .setMaxAutomaticTokenAssociations(100)
    .freezeWith(client)
    .sign(privateKey);
  let txResponse = await tx.execute(client);
  let txReceipt = await txResponse.getReceipt(client);
  return txReceipt.status;
}

export async function balanceChecker(
  treasuryAccountId: string | AccountId,
  firstBuyerAccountId: string | AccountId,
  secondBuyerAccountId: string | AccountId,
  tokenId: TokenId
) {
  const [b1, b11] = await getAccountBalance(treasuryAccountId, tokenId);
  const [b2, b22] = await getAccountBalance(firstBuyerAccountId, tokenId);
  const [b3, b33] = await getAccountBalance(secondBuyerAccountId, tokenId);
  console.log(
    `Nft count for treasury: ${b1?.toString()}; Hbar balance: ${b11.toString()}.`
  );
  console.log(
    `Nft count for firstBuyer: ${b2?.toString()}; Hbar balance: ${b22.toString()}.`
  );
  console.log(
    `Nft count for secondBuyer: ${b3?.toString()}; Hbar balance: ${b33.toString()}.`
  );
}
