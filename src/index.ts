import { AccountId, PrivateKey, TokenId } from "@hashgraph/sdk";
import { createNft, createRoyalty, mintNft, transferNft } from "./nft";
import {
  autoAssociateAccount,
  balanceChecker,
  createAccount,
  getAccountBalance,
} from "./utils";

(async () => {
  const treasury = {
    privateKey: PrivateKey.fromString(process.env.ADMIN_ACCOUNT_PRIVATE_KEY!),
    accountId: process.env.ADMIN_ACCOUNT_ID!,
  };

  const firstBuyer = await createAccount();
  if (firstBuyer == null) {
    console.log("New account is null.");
    return;
  }
  console.log("First buyer account id: ", firstBuyer.accountId.toString());
  const associateFirstStatus = await autoAssociateAccount(
    firstBuyer.accountId,
    firstBuyer.privateKey
  );
  console.log(
    "First buyer auto association: ",
    associateFirstStatus.toString()
  );

  const secondBuyer = await createAccount();
  if (secondBuyer == null) {
    console.log("New account is null.");
    return;
  }
  console.log("Second buyer account id: ", secondBuyer.accountId.toString());
  const associatesecondStatus = await autoAssociateAccount(
    secondBuyer.accountId,
    secondBuyer.privateKey
  );
  console.log(
    "Second buyer auto association: ",
    associatesecondStatus.toString()
  );

  const tokenId = await createNft("TestNft", "TNFT", treasury, {
    royalties: [createRoyalty(treasury.accountId, 50)],
  });
  if (tokenId == null) {
    console.log("Token Id is null");
    return;
  }
  console.log("Token ID: ", tokenId.toString());

  const serial = await mintNft(tokenId, treasury.privateKey, {
    transferOptions: {
      to: firstBuyer.accountId,
      treasury,
    },
  });
  console.log("Token Serial: ", serial);

  await balanceChecker(
    treasury.accountId,
    firstBuyer.accountId,
    secondBuyer.accountId,
    tokenId
  );

  const status = await transferNft(tokenId, serial, 5, firstBuyer, secondBuyer);
  console.log("Second purchase ", status.toString());

  await balanceChecker(
    treasury.accountId,
    firstBuyer.accountId,
    secondBuyer.accountId,
    tokenId
  );
})();
