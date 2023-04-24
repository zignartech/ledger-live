import { IOutputMetadataResponse } from "@iota/iota.js";
import network from "../../../network";
import { getUrl } from "./getNetwork";

export const fetchSingleOutputMetadata = async (
  currencyId: string,
  outputId: string
): Promise<IOutputMetadataResponse> => {
  const {
    data,
  }: {
    data;
  } = await network({
    method: "GET",
    url: getUrl(currencyId, `/api/core/v2/outputs/${outputId}/metadata`),
  });
  return data as IOutputMetadataResponse;
};
