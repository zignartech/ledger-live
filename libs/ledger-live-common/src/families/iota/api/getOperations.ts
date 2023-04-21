import { Operation } from "@ledgerhq/types-live";
import { fetchAllOutputs, fetchSingleOutput, fetchSingleTransaction } from ".";
import { decimalToHex, uint8ArrayToAddress } from "../utils";
import BigNumber from "bignumber.js";
import { IBasicOutput, IBlock } from "@iota/iota.js";
import { log } from "@ledgerhq/logs";

const fetchAllTransactions = async (currencyId: string, address: string) => {
  const transactions: IBlock[] = [];
  const timestamps: number[] = [];
  const transactionIds: string[] = [];

  const outputs = await fetchAllOutputs(
    currencyId,
    address,
    undefined,
    undefined
  );
  for (const element of outputs.items) {
    try {
      const output = await fetchSingleOutput(currencyId, element);
      const transactionId = output.metadata.transactionId;
      transactions.push(
        await fetchSingleTransaction(currencyId, transactionId)
      );
      timestamps.push(output.metadata.milestoneTimestampBooked);
      transactionIds.push(transactionId);
    } catch (error) {
      log("No transactions found");
    }
  }
  return { transactions, timestamps, transactionIds };
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
    const operation: Operation = await txToOp(
      transactions[i],
      currencyId,
      id,
      address,
      timestamps[i],
      transactionIds[i]
    );
    if (operation && !operation.value.isZero()) {
      operations.push(operation);
    }
  }
  console.log("operations123", operations);
  return operations;
};

const txToOp = async (
  transaction: IBlock,
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
  const payload = data.payload;
  const essence = payload.essence;
  const outputs = essence.outputs;
  const inputs = essence.inputs;

  const recipients: string[] = [];
  const senders: string[] = [];
  let value = 0;
  let type: "IN" | "OUT" = "IN"; // default is IN. If the address is found in an input, it will be changed to "OUT"

  // senders logic
  for (const input of inputs) {
    const transactionId = input.transactionId;
    const outputIndex = decimalToHex(input.transactionOutputIndex);
    const { output } = await fetchSingleOutput(
      currencyId,
      transactionId + outputIndex
    );
    const basicOuput = output as IBasicOutput;

    const senderUnlockCondition: any = basicOuput.unlockConditions[0];
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
  for (const output of outputs) {
    // if (outputCheck(output)) {
    const basicOuput = output as IBasicOutput;

    const recipientUnlockCondition: any = basicOuput.unlockConditions[0];
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
    const amount: number = +output.amount;
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
  op.extra.claimTransactionId = transactionId;

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
