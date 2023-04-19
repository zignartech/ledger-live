import type {
  TransactionCommon,
  TransactionCommonRaw,
  TransactionStatusCommon,
  TransactionStatusCommonRaw,
} from "@ledgerhq/types-live";
import type { BigNumber } from "bignumber.js";
export interface ClaimedActivity {
  isClaiming?: boolean;
  claimTransactionId?: string;
  unixTime?: number;
}

export type Transaction = TransactionCommon & {
  family: "iota";
  amount: BigNumber;
  useAllAmount?: boolean;
  recipient: string;
  claimedActivity?: ClaimedActivity;
};
export type TransactionRaw = TransactionCommonRaw & {
  family: "iota";
  amount: string;
  useAllAmount?: boolean;
  recipient: string;
  claimedActivity?: ClaimedActivity;
};
export type TransactionStatus = TransactionStatusCommon;
export type TransactionStatusRaw = TransactionStatusCommonRaw;
