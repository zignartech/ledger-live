import { getEnv } from "../../../env";

const getIotaUrl = (route): string =>
  `${getEnv("API_IOTA_NODE")}${route || ""}`;
const getShimmerUrl = (route): string =>
  `${getEnv("API_SHIMMER_NODE")}${route || ""}`;
const getShimmerTestnetUrl = (route): string =>
  `${getEnv("API_SHIMMER_TESTNET_NODE")}${route || ""}`;

export const getUrl = (currencyId: string, route: string): string => {
  let url = "";
  switch (currencyId) {
    case "iota":
      url = getIotaUrl(route);
      break;
    case "shimmer":
      url = getShimmerUrl(route);
      break;
    case "shimmer_testnet":
      url = getShimmerTestnetUrl(route);
      break;
    default:
      throw new Error(`currency ID error: "${currencyId}" is not a valid ID`);
  }
  return url;
};
