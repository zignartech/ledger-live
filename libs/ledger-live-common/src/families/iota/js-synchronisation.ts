import type { Account, CurrencyBridge } from "@ledgerhq/types-live";
import type { GetAccountShape } from "../../bridge/jsHelpers";
import { makeSync, makeScanAccounts, mergeOps } from "../../bridge/jsHelpers";

import { encodeAccountId } from "../../account";

import { getAccountBalance, getOperations } from "./api";

const getAccountShape: GetAccountShape = async (
  info
): Promise<Partial<Account>> => {
  const { address, currency, initialAccount, derivationMode } = info;

  const accountId = encodeAccountId({
    type: "js",
    version: "2",
    currencyId: currency.id,
    xpubOrAddress: address,
    derivationMode,
  });

  // get current account balance
  const accountBalance = await getAccountBalance(currency.id, address);

  // grab latest operation's consensus timestamp for incremental sync
  const oldOperations = initialAccount?.operations || [];

  // Merge new operations with the previously synced ones
  const newOperations = await getOperations(accountId, currency.id, address);

  const operations = mergeOps(oldOperations, newOperations);

  return {
    id: accountId,
    freshAddress: address,
    balance: accountBalance.balance,
    spendableBalance: accountBalance.balance,
    operationsCount: operations.length,
    operations,
    blockHeight: 10,
  };
};

const postSync = (initial: Account, parent: Account) => parent;

export const scanAccounts = makeScanAccounts({ getAccountShape });
export const sync = makeSync({ getAccountShape, postSync });

export const currencyBridge: CurrencyBridge = {
  preload: () => Promise.resolve({}),
  hydrate: () => {},
  scanAccounts,
};
