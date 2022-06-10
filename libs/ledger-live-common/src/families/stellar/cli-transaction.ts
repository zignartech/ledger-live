import invariant from "invariant";
import { getAccountCurrency } from "../../account";
import type {
  Transaction,
  AccountLike,
  Account,
  AccountLikeArray,
} from "../../types";
import { getAssetIdFromTokenId } from "./tokens";

const options = [
  {
    name: "fee",
    type: String,
    desc: "how much fee",
  },
  {
    name: "memoType",
    type: String,
    desc: "stellar memo type",
  },
  {
    name: "memoValue",
    type: String,
    desc: "stellar memo value",
  },
  {
    name: "operationType",
    type: String,
    desc: "change operation type",
  },
  {
    name: "assetIssuer",
    type: String,
    desc: "Asset issuer",
  },
  {
    name: "assetCode",
    type: String,
    desc: "Same as token",
  },
];

function inferTransactions(
  transactions: Array<{
    account: AccountLike;
    transaction: Transaction;
  }>,
  opts: Record<string, any>
): Transaction[] {
  return transactions.map(({ transaction, account }) => {
    invariant(transaction.family === "stellar", "stellar family");

    return {
      ...transaction,
      subAccountId: account.type === "TokenAccount" ? account.id : null,
      memoType: opts.memoType,
      memoValue: opts.memoValue,
      operationType: opts.mode ?? opts.operationType ?? "payment",
      assetCode: opts.token,
      assetIssuer: opts.assetIssuer,
    };
  });
}

function inferAccounts(
  account: Account,
  opts: Record<string, any>
): AccountLikeArray {
  invariant(account.currency.family === "stellar", "stellar family");

  if (opts.subAccountId) {
    const assetSubAccount = account.subAccounts?.find(
      (a) => a.id === opts.subAccountId
    );

    if (!assetSubAccount) {
      throw new Error(`${opts.subAccountId} asset not found`);
    }

    return [assetSubAccount];
  }

  if (opts.assetCode) {
    const subAccounts = account.subAccounts || [];

    const subAccount = subAccounts.find((sa) => {
      const currency = getAccountCurrency(sa);
      return (
        opts.assetCode.toLowerCase() === currency.ticker.toLowerCase() ||
        opts.assetCode.toLowerCase() === getAssetIdFromTokenId(currency.id)
      );
    });

    if (!subAccount) {
      throw new Error(
        "token account '" +
          opts.assetCode +
          "' not found. Available: " +
          subAccounts.map((t) => getAccountCurrency(t).ticker).join(", ")
      );
    }

    return [subAccount];
  }

  return [account];
}

export default {
  options,
  inferAccounts,
  inferTransactions,
};
