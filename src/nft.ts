import { PublicKey } from "@hashgraph/cryptography";
import {
  AccountId,
  CustomRoyaltyFee,
  Key,
  PrivateKey,
  Status,
  Timestamp,
  TokenBurnTransaction,
  TokenCreateTransaction,
  TokenId,
  TokenInfoQuery,
  TokenMintTransaction,
  TokenSupplyType,
  TokenType,
  TransferTransaction,
  Hbar,
  ScheduleCreateTransaction,
  ScheduleSignTransaction,
  TopicCreateTransaction,
  TopicId,
  TopicMessageSubmitTransaction,
  TopicMessageQuery,
  FileCreateTransaction,
  FileId,
  FileContentsQuery,
} from "@hashgraph/sdk";
import { BigNumber } from "@hashgraph/sdk/lib/Transfer";
import axios from "axios";
import { Base64 } from "js-base64";
import { client, mirror } from "./client";

const DEFAULT_INITIAL_SUPPLY = 0;
const NFT_DECIMALS = 0;

export interface CreateNftOptions {
  freezeKey?: Key;
  admin?: {
    adminPublicKey: Key;
    adminPrivateKey: PrivateKey;
  };
  kycKey?: Key;
  wipeKey?: Key;
  supplyKey?: Key;
  freezeDefault?: boolean;
  expirationTime?: Timestamp | Date;
  feeScheduleKey?: Key;
  maxSupply?: number | Long.Long;
  royalties?: CustomRoyaltyFee[];

  firstSaleRoyalties?: RoyaltyFee[];
  usageRoyalties?: RoyaltyFee[];
  description?: string;
}

export interface RoyaltyFee {
  receiver: string;
  percentage: number;
}

export interface TokenClassMetadata {
  name: string;
  description: string;
  firstSaleRoyalties: RoyaltyFee[];
  usageRoyalties: RoyaltyFee[];
}

export interface TokenClassMemo {
  topicId: string;
  sequenceNumber: number;
}

export async function createNft(
  name: string,
  symbol: string,
  treasury: { accountId: string | AccountId; privateKey: PrivateKey },
  options?: CreateNftOptions
): Promise<TokenId | null> {
  const {
    freezeKey,
    admin,
    kycKey,
    wipeKey,
    supplyKey,
    freezeDefault,
    expirationTime,
    feeScheduleKey,
    maxSupply,
    royalties,
    firstSaleRoyalties,
    usageRoyalties,
    description,
  } = options ?? {};

  let msg: TokenClassMetadata = {
    name,
    description: description ?? "",
    firstSaleRoyalties: firstSaleRoyalties ?? [],
    usageRoyalties: usageRoyalties ?? [],
  };
  const topic = await createTopic();
  if (!topic) {
    console.error("Couldn't create topic.");
    return null;
  }

  const sequenceNumber = await storeMsgInTopic(topic, JSON.stringify(msg));
  if (!sequenceNumber) throw new Error("Sequence number returned null.");

  const memo: TokenClassMemo = {
    topicId: topic.toString(),
    sequenceNumber,
  };

  let tx = new TokenCreateTransaction()
    .setTokenName(name)
    .setTokenSymbol(symbol)
    .setTreasuryAccountId(treasury.accountId)
    .setTokenType(TokenType.NonFungibleUnique)
    .setDecimals(NFT_DECIMALS)
    .setInitialSupply(DEFAULT_INITIAL_SUPPLY)
    .setSupplyKey(supplyKey ?? treasury.privateKey)
    .setTokenMemo(JSON.stringify(memo));

  if (admin != undefined) tx = tx.setAdminKey(admin.adminPublicKey);
  if (kycKey != undefined) tx = tx.setKycKey(kycKey);
  if (freezeKey != undefined) tx = tx.setFreezeKey(freezeKey);
  if (wipeKey != undefined) tx = tx.setWipeKey(wipeKey);
  if (freezeDefault != undefined) tx = tx.setFreezeDefault(freezeDefault);
  if (expirationTime != undefined) tx = tx.setExpirationTime(expirationTime);
  if (feeScheduleKey != undefined) tx = tx.setFeeScheduleKey(feeScheduleKey);
  if (maxSupply != undefined)
    tx = tx.setSupplyType(TokenSupplyType.Finite).setMaxSupply(maxSupply);
  if (royalties != undefined) tx = tx.setCustomFees(royalties);

  const frozenTx = tx.freezeWith(client);

  const signTx = await (admin != undefined
    ? await frozenTx.sign(admin.adminPrivateKey)
    : frozenTx
  ).sign(treasury.privateKey);

  const txResponse = await signTx.execute(client);

  const receipt = await txResponse.getReceipt(client);

  return receipt.tokenId;
}

/**
 *
 * @param receiver of the royalty
 * @param percentage max precision 10^-2
 * @returns a custom royalty fee object, ready to be put in a list and given to
 * createNft in params
 */
export function createRoyalty(
  receiver: string | AccountId,
  percentage: number
): CustomRoyaltyFee {
  return new CustomRoyaltyFee()
    .setNumerator(percentage * 100)
    .setDenominator(10_000)
    .setFeeCollectorAccountId(receiver);
}

export interface MintNftOptions {
  metadata?: Uint8Array;
  transferOptions?: {
    to: string | AccountId;
    treasury: { accountId: string | AccountId; privateKey: PrivateKey };
  };
}

export async function mintNft(
  tokenId: string | TokenId,
  supplyPrivateKey: PrivateKey,
  options?: MintNftOptions
): Promise<number> {
  const { metadata, transferOptions } = options ?? {};

  const tx = new TokenMintTransaction()
    .setTokenId(tokenId)
    .setMetadata(metadata != undefined ? [metadata] : [Buffer.from("")])
    .freezeWith(client);
  const signTx = await tx.sign(supplyPrivateKey);
  const txResponse = await signTx.execute(client);
  const txReceipt = await txResponse.getReceipt(client);
  const serial = txReceipt.serials[0].low;

  if (transferOptions == undefined) return serial;

  await transferNftWithoutFees(
    tokenId,
    serial,
    transferOptions.treasury,
    transferOptions.to
  );
  return serial;
}

export async function transferNftWithoutFees(
  tokenId: string | TokenId,
  serial: number,
  sender: { accountId: string | AccountId; privateKey: PrivateKey },
  recipient: string | AccountId
): Promise<Status> {
  const tx = new TransferTransaction()
    .addNftTransfer(tokenId, serial, sender.accountId, recipient)
    .freezeWith(client);
  const signTx = await tx.sign(sender.privateKey);
  const txResponse = await signTx.execute(client);
  const txReceipt = await txResponse.getReceipt(client);
  return txReceipt.status;
}

export async function burnNftFromTreasury(
  tokenId: string | TokenId,
  serial: number,
  supplyKey: PrivateKey
): Promise<Status> {
  const tx = new TokenBurnTransaction()
    .setTokenId(tokenId)
    .setSerials([serial])
    .freezeWith(client);

  const signTx = await tx.sign(supplyKey);
  const txResponse = await signTx.execute(client);
  const txReceipt = await txResponse.getReceipt(client);
  return txReceipt.status;
}

export async function burnNft(
  tokenId: string | TokenId,
  serial: number,
  supplyKey: PrivateKey,
  owner: { accountId: string | AccountId; privateKey: PrivateKey }
): Promise<Status> {
  const query = new TokenInfoQuery().setTokenId(tokenId);
  const treasury = (await query.execute(client)).treasuryAccountId;
  if (treasury == null) throw new Error("No treasury account id found.");

  await transferNftWithoutFees(tokenId, serial, owner, treasury);

  return burnNftFromTreasury(tokenId, serial, supplyKey);
}

export async function transferNft(
  tokenId: string | TokenId,
  serial: number,
  amount: string | number | Long.Long | BigNumber | Hbar,
  sender: { accountId: string | AccountId; privateKey: PrivateKey },
  recipient: { accountId: string | AccountId; privateKey: PrivateKey }
): Promise<Status> {
  const negAmount = (() => {
    if (typeof amount == "number" || typeof amount == "string") return -amount;
    if ("negate" in amount) return amount.negate();
    return amount.negated();
  })();

  const tx = await new TransferTransaction()
    .addNftTransfer(tokenId, serial, sender.accountId, recipient.accountId)
    .addHbarTransfer(sender.accountId, amount)
    .addHbarTransfer(recipient.accountId, negAmount)
    .freezeWith(client)
    .sign(recipient.privateKey);
  const signTx = await tx.sign(sender.privateKey);
  const txResponse = await signTx.execute(client);
  const txReceipt = await txResponse.getReceipt(client);
  return txReceipt.status;
}

// TODO: Scheduled tx
export async function scheduleNftTransfer(
  tokenId: string | TokenId,
  serial: number,
  amount: string | number | Long.Long | BigNumber | Hbar,
  sender: string | AccountId,
  recipient: string | AccountId,
  signer: PrivateKey
): Promise<Status> {
  const negAmount = (() => {
    if (typeof amount == "number" || typeof amount == "string") return -amount;
    if ("negate" in amount) return amount.negate();
    return amount.negated();
  })();

  const tx = new TransferTransaction()
    .addNftTransfer(tokenId, serial, sender, recipient)
    .addHbarTransfer(sender, amount)
    .addHbarTransfer(recipient, negAmount);
  const scheduledTx = await new ScheduleCreateTransaction()
    .setScheduledTransaction(tx)
    .freezeWith(client)
    .sign(signer);
  const txResponse = await scheduledTx.execute(client);
  try {
    const txReceipt = await txResponse.getReceipt(client);
    return txReceipt.status;
  } catch (e: any) {
    if (e?.status != Status.IdenticalScheduleAlreadyCreated) throw e;
    const tx = await new ScheduleSignTransaction()
      .setScheduleId(e.transactionReceipt.scheduleId)
      .freezeWith(client)
      .sign(signer);
    const txResponse = await tx.execute(client);
    const txReceipt = await txResponse.getReceipt(client);
    return txReceipt.status;
  }
}

export async function createTopic(): Promise<TopicId | null> {
  const tx = new TopicCreateTransaction()
    .setSubmitKey(PrivateKey.fromString(process.env.ADMIN_ACCOUNT_PRIVATE_KEY!))
    .freezeWith(client);
  const txResponse = await tx.execute(client);
  const receipt = await txResponse.getReceipt(client);
  const topicId = receipt.topicId;
  return topicId;
}

export async function storeMsgInTopic(
  topicId: TopicId,
  msg: string
): Promise<number | null> {
  const tx = new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(msg)
    .freezeWith(client);
  const txResponse = await tx.execute(client);
  const txReceipt = await txResponse.getReceipt(client);
  return txReceipt.topicSequenceNumber?.toNumber() ?? null;
}

export async function readTopicMsg(
  topic: TopicId,
  sequenceNumber: number
): Promise<string> {
  return Base64.decode(
    (
      await axios.get(
        `${mirror}/topics/${topic.toString()}/messages/${sequenceNumber}`
      )
    ).data.message
  );
}

export async function storeMsgInFile(msg: string): Promise<FileId | null> {
  const key = PrivateKey.fromString(process.env.ADMIN_ACCOUNT_PRIVATE_KEY!);
  const tx = new FileCreateTransaction()
    .setKeys([key])
    .setContents(msg)
    .freezeWith(client);
  const signTx = await tx.sign(key);
  const submitTx = await signTx.execute(client);
  const receipt = await submitTx.getReceipt(client);
  return receipt.fileId;
}

export async function readMsgFromFile(file: FileId): Promise<string> {
  const key = PrivateKey.fromString(process.env.ADMIN_ACCOUNT_PRIVATE_KEY!);
  const query = new FileContentsQuery().setFileId(file);
  return (await query.execute(client)).toString();
}

export async function getTokenClassMetadata(
  tokenId: TokenId
): Promise<TokenClassMetadata> {
  // Retrieve TopicId / SequenceNumber from tokenId
  const query = new TokenInfoQuery().setTokenId(tokenId);
  const response = await query.execute(client);
  const { topicId, sequenceNumber } = JSON.parse(
    response.tokenMemo
  ) as TokenClassMemo;

  return JSON.parse(
    await readTopicMsg(TopicId.fromString(topicId), sequenceNumber)
  );
}
