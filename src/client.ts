import { AccountId, Client } from "@hashgraph/sdk";

export const client: Client = newClient();

function newClient(): Client {
  const nodes = {
    "0.testnet.hedera.com:50211": new AccountId(3),
    "1.testnet.hedera.com:50211": new AccountId(4),
    "2.testnet.hedera.com:50211": new AccountId(5),
    // "3.testnet.hedera.com:50211": new AccountId(6),
    // "4.testnet.hedera.com:50211": new AccountId(7),
    "5.testnet.hedera.com:50211": new AccountId(8),
    "6.testnet.hedera.com:50211": new AccountId(9),
  };
  const client = Client.forNetwork(nodes);
  client.setOperator(
    process.env.ADMIN_ACCOUNT_ID!,
    process.env.ADMIN_ACCOUNT_PRIVATE_KEY!
  );
  return client;
}
