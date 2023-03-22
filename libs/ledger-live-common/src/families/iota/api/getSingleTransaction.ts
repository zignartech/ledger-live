import { IBlock } from "@iota/iota.js";
import network from "../../../network";
import { getUrl } from "./getNetwork";

export const fetchSingleTransaction = async (
  currencyId: string,
  transactionId: string
): Promise<IBlock> => {
  const {
    data,
  }: {
    data;
  } = await network({
    method: "GET",
    url: getUrl(
      currencyId,
      `/api/core/v2/transactions/${transactionId}/included-block`
    ),
  });
  return data as IBlock;
};
