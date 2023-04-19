import BigNumber from "bignumber.js";
import { fetchAllOutputs, fetchSingleOutput } from ".";

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
  await Promise.all(
    outputs.items.map(async (item) => {
      const output = await fetchSingleOutput(currencyId, item);
      if (!output.metadata.isSpent) {
        balance = balance.plus(new BigNumber(output.output.amount));
      }
    })
  );
  return balance;
};
