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
} from "@hashgraph/sdk";
import { BigNumber } from "@hashgraph/sdk/lib/Transfer";
import { client } from "./client";

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
  memo?: string;
  royalties?: CustomRoyaltyFee[];
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
    memo,
    royalties,
  } = options ?? {};

  let tx = new TokenCreateTransaction()
    .setTokenName(name)
    .setTokenSymbol(symbol)
    .setTreasuryAccountId(treasury.accountId)
    .setTokenType(TokenType.NonFungibleUnique)
    .setDecimals(NFT_DECIMALS)
    .setInitialSupply(DEFAULT_INITIAL_SUPPLY)
    .setSupplyKey(supplyKey ?? treasury.privateKey);

  if (admin != undefined) tx = tx.setAdminKey(admin.adminPublicKey);
  if (kycKey != undefined) tx = tx.setKycKey(kycKey);
  if (freezeKey != undefined) tx = tx.setFreezeKey(freezeKey);
  if (wipeKey != undefined) tx = tx.setWipeKey(wipeKey);
  if (freezeDefault != undefined) tx = tx.setFreezeDefault(freezeDefault);
  if (expirationTime != undefined) tx = tx.setExpirationTime(expirationTime);
  if (feeScheduleKey != undefined) tx = tx.setFeeScheduleKey(feeScheduleKey);
  if (maxSupply != undefined)
    tx = tx.setSupplyType(TokenSupplyType.Finite).setMaxSupply(maxSupply);
  if (memo != undefined) tx = tx.setTokenMemo(memo);
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
