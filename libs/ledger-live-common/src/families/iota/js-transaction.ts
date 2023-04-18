import BigNumber from "bignumber.js";
import type { Account } from "@ledgerhq/types-live";
import type { Transaction } from "./types";
import { calculateAmount } from "./utils";

/**
 * Creates an empty transaction.
 *
 * @returns {Transaction}
 */
export function createTransaction(_account: Account): Transaction {
  console.log("createTransaction");

  return {
    family: "iota",
    amount: new BigNumber(0),
    recipient: "",
    useAllAmount: false,
    claimedActivity: undefined,
  };
}

/**
 * Update a base property of the transaction.
 *
 * @returns  {Transaction}
 */
export function updateTransaction(
  transaction: Transaction,
  patch: Partial<Transaction>
): Transaction {
  console.log("updateTransaction", transaction)
  return { ...transaction, ...patch };
}

/**
 * Gather any more neccessary information for a transaction,
 * potentially from a network.
 *
 * Hedera has fully client-side transactions and the fee
 * is not possible to estimate ahead-of-time.
 *
 * @returns  {Transaction}
 */
export async function prepareTransaction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  account: Account,
  transaction: Transaction
): Promise<Transaction> {
  console.log("prepareTransaction", transaction);
  // explicitly calculate transaction amount to account for `useAllAmount` flag (send max flow)
  // i.e. if `useAllAmount` has been toggled to true, this is where it will update the transaction to reflect that action
  //throw new Error(JSON.stringify(transaction));
  const amount = await calculateAmount({ account, transaction });
  //throw new Error(amount.toString());
  transaction.amount = amount;

  return transaction;
}
