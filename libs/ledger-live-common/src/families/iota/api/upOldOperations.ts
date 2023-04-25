import { Operation } from "@ledgerhq/types-live";
import { fetchSingleOutputMetadata } from ".";
import { decimalToHex } from "../utils";
export const upOldOperations = async (
  currencyId: string,
  oldOperations: Operation[]
): Promise<Operation[]> => {
  if (oldOperations.length === 0) return oldOperations;

  for (const operation of oldOperations) {
    if (operation.extra.isClaiming === true) {
      const outputId =
        operation.extra.claimTransactionId +
        decimalToHex(operation.extra.outputIndex);
      const upOperation = await fetchSingleOutputMetadata(currencyId, outputId);
      operation.extra.isClaiming = !upOperation.isSpent;
    }
  }

  return oldOperations;
};
