/* eslint-disable no-prototype-builtins */
import BigNumber from "bignumber.js";
import { getEnv } from "../../../env";
import network from "../../../network";
import type { Operation } from "@ledgerhq/types-live";
import { Block, OutputResponse, TransactionPayload } from "./types";
import { decimalToHex, uint8ArrayToAddress } from "../utils";
import {
  IBlock,
  IOutputsResponse,
  IndexerPluginClient,
  SingleNodeClient,
} from "@iota/iota.js";
import { WasmPowProvider } from "@iota/pow-wasm.js";

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

const fetchAllTransactions = async (currencyId: string, address: string) => {
  const transactions: IBlock[] = [];
  const timestamps: number[] = [];
  const transactionIds: string[] = [];

  const api_endpoint = getUrl(currencyId, "");
  const client = new SingleNodeClient(api_endpoint, {
    powProvider: new WasmPowProvider(),
  });
  const indexerPlugin = new IndexerPluginClient(client);
  const outputs = await fetchAndWaitForBasicOutputs(address, indexerPlugin);

  for (let i = 0; i < outputs.items.length; i++) {
    try {
      const output = await client.output(outputs.items[i]);
      transactions.push(
        await client.transactionIncludedBlock(output.metadata.transactionId)
      );
      timestamps.push(Number(output.metadata.milestoneTimestampBooked));
      transactionIds.push(output.metadata.transactionId);
    } catch (error) {
      ("f");
    }
  }
  return { transactions, timestamps, transactionIds };
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

export interface AccountBalance {
  balance: BigNumber;
}

export const getAccountBalance = async (
  currencyId: string,
  address: string
): Promise<AccountBalance> => {
  const api_endpoint = getUrl(currencyId, "");
  const client = new SingleNodeClient(api_endpoint, {
    powProvider: new WasmPowProvider(),
  });
  const indexerPlugin = new IndexerPluginClient(client);
  const outputs = await fetchAndWaitForBasicOutputs(
    address,
    indexerPlugin,
    false
  );
  let balance = new BigNumber(0);
  for (let i = 0; i < outputs.items.length; i++) {
    const output = await client.output(outputs.items[i]);
    if (!output.metadata.isSpent) {
      balance = balance.plus(new BigNumber(output.output.amount));
    }
  }

  return {
    balance,
  };
};

export const getOperations = async (
  id: string,
  currencyId: string,
  address: string
): Promise<Operation[]> => {
  const operations: Operation[] = [];
  const { transactions, timestamps, transactionIds } =
    await fetchAllTransactions(currencyId, address);
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
    // isClaiming = outputCheck(outputs[o]);
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
    // }
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

  const outputWithUnlockCondition = (
    payload.essence.outputs as OutputWithUnlockConditions[]
  ).find((output) => {
    const hasUnlockConditionWithType3 =
      output.unlockConditions &&
      output.unlockConditions.some((uc) => uc.type === 3 && uc.returnAddress);
    return hasUnlockConditionWithType3;
  });
  const umlockClaim = outputWithUnlockCondition?.unlockConditions.find(
    (unlock) => {
      if (unlock.type === 3 && unlock.returnAddress) return unlock;
    }
  );
  op.extra.isClaiming = !!umlockClaim;
  op.extra.unixTime = umlockClaim?.unixTime;
  return op;
};

interface OutputWithUnlockConditions {
  type: number;
  amount: string;
  unlockConditions: {
    type: number;
    returnAddress?: {
      type: number;
      pubKeyHash: string;
    };
    unixTime?: number;
  }[];
}

// Only outputs that have one o
// const outputCheck = (output: any): boolean => {
//   if (
//     output.type == 3 && // it's a BasicOutput
//     output.unlockConditions.length == 1 && // no other unlockConditions
//     output.unlockConditions[0].type == 0 // it's an AddressUnlockCondition
//   ) {
//     return true;
//   } else return false;
// };

export async function fetchAndWaitForBasicOutputs(
  addressBech32: string,
  indexerPlugin: IndexerPluginClient,
  hasExpiration?: boolean
): Promise<IOutputsResponse> {
  let outputsResponse: IOutputsResponse = {
    ledgerIndex: 0,
    cursor: "",
    pageSize: "",
    items: [],
  };
  const maxTries = 10;
  let tries = 0;
  while (outputsResponse.items.length == 0) {
    if (tries > maxTries) {
      break;
    }
    tries++;
    outputsResponse = await indexerPlugin.basicOutputs({
      addressBech32: addressBech32,
      hasStorageDepositReturn: false,
      hasExpiration,
      hasTimelock: false,
      hasNativeTokens: false,
    });
    if (outputsResponse.items.length == 0) {
      await new Promise((f) => setTimeout(f, 1000));
    }
  }
  // if (tries > maxTries) {
  //   throw new Error("Didn't find any outputs for address");
  // }

  return outputsResponse;
}
