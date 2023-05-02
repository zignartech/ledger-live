import { Operation } from "@ledgerhq/types-live";
import {
  fetchAllOutputs,
  fetchSingleOutput,
  fetchSingleTransaction,
  getUrl,
} from ".";
import BigNumber from "bignumber.js";
import { IBlock, SingleNodeClient } from "@iota/iota.js";
import { log } from "@ledgerhq/logs";
import { TransactionsHelper } from "./helpers";

const fetchAllTransactions = async (
  currencyId: string,
  address: string,
  latestOperationTimestamp: number
) => {
  const transactions: IBlock[] = [];
  const timestamps: number[] = [];
  const transactionIds: string[] = [];
  const outputIndexIds: number[] = [];

  const outputs = await fetchAllOutputs(
    currencyId,
    address,
    undefined,
    latestOperationTimestamp
  );
  for (const element of outputs.items) {
    try {
      const output = await fetchSingleOutput(currencyId, element);
      const transactionId = output.metadata.transactionId;
      const outputIndex = output.metadata.outputIndex;
      transactions.push(
        await fetchSingleTransaction(currencyId, transactionId)
      );
      timestamps.push(output.metadata.milestoneTimestampBooked);
      transactionIds.push(transactionId);
      outputIndexIds.push(outputIndex);
    } catch (error) {
      log("No transactions found");
    }
  }
  return { transactions, timestamps, transactionIds, outputIndexIds };
};

export const getOperations = async (
  id: string,
  currencyId: string,
  address: string,
  latestOperationTimestamp: number
): Promise<Operation[]> => {
  const operations: Operation[] = [];
  const { transactions, timestamps, transactionIds, outputIndexIds } =
    await fetchAllTransactions(currencyId, address, latestOperationTimestamp);

  const apiEndpoint = getUrl(currencyId, "");
  const client = new SingleNodeClient(apiEndpoint);

  for (let i = 0; i < transactions.length; i++) {
    const operation: Operation = await txToOp(
      client,
      transactions[i],
      currencyId,
      id,
      address,
      timestamps[i],
      transactionIds[i],
      outputIndexIds[i]
    );
    if (operation && !operation.value.isZero()) {
      operations.push(operation);
    }
  }
  return operations;
};

const txToOp = async (
  client: SingleNodeClient,
  transaction: IBlock,
  currencyId: string,
  id: string,
  address: string,
  timestamp: number,
  transactionId: string,
  outputIndex: number
): Promise<any> => {
  const data = transaction ? transaction : null;
  if (!data || !data.payload || data.payload?.type != 6) {
    return null;
  }

  // define the outputs and inputs of the transaction / block
  const payload = data.payload;
  let type: "IN" | "OUT" = "IN"; // default is IN. If the address is found in an input, it will be changed to "OUT"
  let senders: any[] = [];
  let recipients: any[] = [];

  const { inputs, outputs, transferTotal } =
    await TransactionsHelper.getInputsAndOutputs(transaction, "smr", client);

  const isInput = inputs.some((input) => input.address.bech32 === address);
  const IsOutput = outputs.some(
    (output) =>
      output.address?.bech32 === address && output.isRemainder === false
  );

  if (isInput) {
    type = "OUT";
    recipients = inputs.map((input) => input.address.bech32);
    senders = outputs.map((output) => output.address?.bech32);
  }
  if (IsOutput) {
    type = "IN";
    senders = inputs.map((input) => input.address.bech32);
    recipients = outputs.map((output) => output.address?.bech32);
  }

  const op: Operation = {
    id: `${transactionId}-${type}`,
    hash: transactionId,
    type,
    value: new BigNumber(transferTotal),
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
  op.extra.claimTransactionId = transactionId;
  op.extra.outputIndex = outputIndex;

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
