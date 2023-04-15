import type {
  TransactionCommon,
  TransactionCommonRaw,
  TransactionStatusCommon,
  TransactionStatusCommonRaw,
} from "@ledgerhq/types-live";
import type { BigNumber } from "bignumber.js";
interface ClaimedActivity {
  isClaimed: boolean;
  claimingTransactionId: string;
  claimedTimestamp: number;
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
