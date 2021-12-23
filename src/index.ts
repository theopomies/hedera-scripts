import { PrivateKey } from "@hashgraph/sdk";
import { createNft, mintNft } from "./nft";

(async () => {
  const treasury = {
    privateKey: PrivateKey.fromString(process.env.ADMIN_ACCOUNT_PRIVATE_KEY!),
    accountId: process.env.ADMIN_ACCOUNT_ID!,
  };

  const tokenId = await createNft("TestNft", "TNFT", treasury);
  if (tokenId == null) {
    console.log("Token Id is null");
    return;
  }
  console.log("Token ID: ", tokenId.toString());

  const status = await mintNft(tokenId, treasury.privateKey, Buffer.from(""));
  console.log(status);
})();
