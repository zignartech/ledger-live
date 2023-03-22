import { IOutputsResponse } from "@iota/iota.js";
import network from "../../../network";
import { getUrl } from "./getNetwork";

export const fetchAllOutputs = async (
  currencyId: string,
  address: string,
  hasExpiration?: boolean,
  latestOperationTimestamp?: number
): Promise<IOutputsResponse> => {
  let baseRoute = `/api/indexer/v1/outputs/basic?address=${address}`;
  if (hasExpiration != undefined)
    baseRoute += `&hasExpiration=${hasExpiration}`;
  if (latestOperationTimestamp != undefined)
    baseRoute += `&createdAfter=${latestOperationTimestamp}`;
  const {
    data,
  }: {
    data;
  } = await network({
    method: "GET",
    url: getUrl(currencyId, baseRoute),
  });
  return data as IOutputsResponse;
};
