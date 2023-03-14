import BigNumber from "bignumber.js";
import { getEnv } from "../../../env";
import network from "../../../network";
import type { Operation } from "@ledgerhq/types-live";
import { Block, OutputResponse, TransactionPayload } from "./types";
import { decimalToHex, uint8ArrayToAddress } from "../utils";
import { IOutputsResponse } from "@iota/iota.js";

const getIotaUrl = (route): string =>
  `${getEnv("API_IOTA_NODE")}${route || ""}`;
const getShimmerUrl = (route): string =>
  `${getEnv("API_SHIMMER_NODE")}${route || ""}`;
const getShimmerTestnetUrl = (route): string =>
  `${getEnv("API_SHIMMER_TESTNET_NODE")}${route || ""}`;

export const getUrl = (currencyId: string, route: string): string => {
  let url = "";
  switch (currencyId) {
    case "iota":
      url = getIotaUrl(route);
      break;
    case "shimmer":
      url = getShimmerUrl(route);
      break;
    case "shimmer_testnet":
      url = getShimmerTestnetUrl(route);
      break;
    default:
      throw new Error(`currency ID error: "${currencyId}" is not a valid ID`);
  }
  return url;
};

export const getAccountBalance = async (
  currencyId: string,
  address: string
): Promise<BigNumber> => {
  const balance = await fetchBalance(currencyId, address);
  return balance;
};

export const fetchBalance = async (
  currencyId: string,
  address: string
): Promise<BigNumber> => {
  const outputs = await fetchAllOutputs(currencyId, address, false);
  let balance = new BigNumber(0);
  for (let i = 0; i < outputs.items.length; i++) {
    const output = await fetchSingleOutput(currencyId, outputs.items[i]);
    if (!output.metadata.isSpent) {
      balance = balance.plus(new BigNumber(output.output.amount));
    }
  }
  return balance;
};

const fetchAllOutputs = async (
  currencyId: string,
  address: string,
  hasExpiration?: boolean,
  latestOperationTimestamp?: number
) => {
  const baseRoute = `/api/indexer/v1/outputs/basic?address=${address}`;
  if (hasExpiration != undefined)
    baseRoute.concat(`&hasExpiration=${hasExpiration}`);
  if (latestOperationTimestamp != undefined)
    baseRoute.concat(`&createdAfter=${latestOperationTimestamp}`);
  const {
    data,
  }: {
    data;
  } = await network({
    method: "GET",
    url: getUrl(currencyId, baseRoute),
  });
  return data as IOutputsResponse;
};

export const fetchSingleOutput = async (
  currencyId: string,
  outputId: string
): Promise<OutputResponse> => {
  const {
    data,
  }: {
    data;
  } = await network({
    method: "GET",
    url: getUrl(currencyId, `/api/core/v2/outputs/${outputId}`),
  });
  return data as OutputResponse;
};

const fetchSingleTransaction = async (
  currencyId: string,
  transactionId: string
) => {
  const {
    data,
  }: {
    data;
  } = await network({
    method: "GET",
    url: getUrl(
      currencyId,
      `/api/core/v2/transactions/${transactionId}/included-block`
    ),
  });
  return data as Block;
};

const fetchAllTransactions = async (
  currencyId: string,
  address: string,
  latestOperationTimestamp: number
) => {
  const transactions: Block[] = [];
  const timestamps: number[] = [];
  const transactionIds: string[] = [];

  const outputs = await fetchAllOutputs(
    currencyId,
    address,
    undefined,
    latestOperationTimestamp
  );
  for (let i = 0; i < outputs.items.length; i++) {
    try {
      const output = await fetchSingleOutput(currencyId, outputs.items[i]);
      const transactionId = output.metadata.transactionId;
      transactions.push(
        await fetchSingleTransaction(currencyId, transactionId)
      );
      timestamps.push(output.metadata.milestoneTimestampBooked);
      transactionIds.push(transactionId);
    } catch (error) {
      ("f");
    }
  }
  return { transactions, timestamps, transactionIds };
};

export const getOperations = async (
  id: string,
  currencyId: string,
  address: string,
  latestOperationTimestamp: number
): Promise<Operation[]> => {
  const operations: Operation[] = [];
  const { transactions, timestamps, transactionIds } =
    await fetchAllTransactions(currencyId, address, latestOperationTimestamp);
  for (let i = 0; i < transactions.length; i++) {
    const operation = await txToOp(
      transactions[i],
      currencyId,
      id,
      address,
      timestamps[i],
      transactionIds[i]
    );
    if (operation) {
      operations.push(operation);
    }
  }
  return operations;
};

const txToOp = async (
  transaction: Block,
  currencyId: string,
  id: string,
  address: string,
  timestamp: number,
  transactionId: string
): Promise<any> => {
  const data = transaction ? transaction : null;
  if (!data || !data.payload || data.payload?.type != 6) {
    return null;
  }

  // define the outputs and inputs of the transaction / block
  const payload = data.payload as TransactionPayload;
  const essence = payload.essence;
  const outputs = essence.outputs;
  const inputs = essence.inputs;

  const recipients: string[] = [];
  const senders: string[] = [];
  let value = 0;
  let type: "IN" | "OUT" = "IN"; // default is IN. If the address is found in an input, it will be changed to "OUT"

  // senders logic
  for (let i = 0; i < inputs.length; i++) {
    const transactionId = inputs[i].transactionId;
    const outputIndex = decimalToHex(inputs[i].transactionOutputIndex);
    const senderOutput = (
      await fetchSingleOutput(currencyId, transactionId + outputIndex)
    ).output;
    const senderUnlockCondition: any = senderOutput.unlockConditions[0];
    const senderPubKeyHash: any = senderUnlockCondition.address.pubKeyHash;
    const senderUint8Array = Uint8Array.from(
      senderPubKeyHash
        .match(/.{1,2}/g) // magic
        .map((byte: string) => parseInt(byte, 16))
    );
    // the address of the sender
    const sender = uint8ArrayToAddress(currencyId, senderUint8Array);
    senders.push(sender);
    if (sender == address) type = "OUT";
  }

  // receivers logic
  for (let o = 0; o < outputs.length; o++) {
    if (outputCheck(outputs[o])) {
      const recipientUnlockCondition: any = outputs[o].unlockConditions[0];
      const recipientPubKeyHash: any =
        recipientUnlockCondition.address.pubKeyHash;
      const recipientUint8Array = Uint8Array.from(
        recipientPubKeyHash
          .match(/.{1,2}/g) // magic
          .map((byte: string) => parseInt(byte, 16))
      );
      // the address of the recipient
      const recipient = uint8ArrayToAddress(currencyId, recipientUint8Array);

      // In case the transaction is incoming:
      // add to the value all amount coming into the address.
      // If the transaction is outgoing:
      // add to the value all amount going to other addresses.
      const amount: number = +outputs[o].amount;
      if (type == "IN" && recipient == address) value += amount;
      else if (type == "OUT" && recipient != address) value += amount; // otherwise, it means that it's a remainder and doesn't count into the value

      recipients.push(recipient);
    }
  }

  const op: Operation = {
    id: `${transactionId}-${type}`,
    hash: transactionId,
    type,
    value: new BigNumber(value),
    fee: new BigNumber(0),
    blockHash: "",
    blockHeight: 10, // so it's considered a confirmed transaction
    senders,
    recipients,
    accountId: id,
    date: new Date(timestamp * 1000),
    extra: {},
  };

  return op;
};

// Only outputs that have one o
const outputCheck = (output: any): boolean => {
  if (
    output.type == 3 && // it's a BasicOutput
    output.unlockConditions.length == 1 && // no other unlockConditions
    output.unlockConditions[0].type == 0 // it's an AddressUnlockCondition
  ) {
    return true;
  } else return false;
};
