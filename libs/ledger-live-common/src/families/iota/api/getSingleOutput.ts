import { IOutputResponse } from "@iota/iota.js";
import network from "../../../network";
import { getUrl } from "./getNetwork";

export const fetchSingleOutput = async (
  currencyId: string,
  outputId: string
): Promise<IOutputResponse> => {
  const {
    data,
  }: {
    data;
  } = await network({
    method: "GET",
    url: getUrl(currencyId, `/api/core/v2/outputs/${outputId}`),
  });
  return data as IOutputResponse;
};
