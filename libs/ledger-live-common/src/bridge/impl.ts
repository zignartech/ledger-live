import { CurrencyNotSupported } from "@ledgerhq/errors";
import { decodeAccountId, getMainAccount } from "../account";
import { getEnv } from "../env";
import { checkAccountSupported } from "../account/support";
import jsBridges from "../generated/bridge/js";
import mockBridges from "../generated/bridge/mock";
import type { CryptoCurrency } from "@ledgerhq/types-cryptoassets";
import {
  Account,
  AccountBridge,
  AccountLike,
  CurrencyBridge,
} from "@ledgerhq/types-live";

export const getCurrencyBridge = (currency: CryptoCurrency): CurrencyBridge => {
  if (getEnv("MOCK")) {
    const mockBridge = mockBridges[currency.family];
    if (mockBridge) return mockBridge.currencyBridge;
    throw new CurrencyNotSupported(
      "no mock implementation available for currency " + currency.id,
      {
        currencyName: currency.name,
      }
    );
  }

  const jsBridge = jsBridges[currency.family];
  if (jsBridge) {
    return jsBridge.currencyBridge;
  }

  throw new CurrencyNotSupported(
    "no implementation available for currency " + currency.id,
    {
      currencyName: currency.name,
    }
  );
};
export const getAccountBridge = (
  account: AccountLike,
  parentAccount?: Account | null
): AccountBridge<any> => {
  console.log('IN ACCOUNT BRIDGE')
  console.log(account, parentAccount)
  const mainAccount = getMainAccount(account, parentAccount);
  console.log('IN ACCOUNT BRIDGE 1', mainAccount)
  const { currency } = mainAccount;
  const { family } = currency;
  const { type } = decodeAccountId(mainAccount.id);
  const supportedError = checkAccountSupported(mainAccount);

  if (supportedError) {
    throw supportedError;
  }

  if (type === "mock") {
    const mockBridge = mockBridges[currency.family];
    if (mockBridge) return mockBridge.accountBridge;
    throw new CurrencyNotSupported(
      "no mock implementation available for currency " + currency.id,
      {
        currencyName: currency.name,
      }
    );
  }
  console.log('IN ACCOUNT BRIDGE 2', jsBridges)
  console.log('family', family)
  console.log('IN ACCOUNT BRIDGE 3', jsBridges[family])
  const jsBridge = jsBridges[family];
  
  console.log('IN ACCOUNT BRIDGE 4', jsBridge.accountBridge)
  if (type === "libcore") {
    // migrate from libcore via JS
    if (jsBridge) {
      return jsBridge.accountBridge;
    }
    throw new CurrencyNotSupported(
      "no libcore implementation available for currency " + currency.id,
      {
        currencyName: currency.name,
      }
    );
  }
  if (jsBridge) return jsBridge.accountBridge;
  throw new CurrencyNotSupported("currency not supported " + currency.id, {
    currencyName: mainAccount.currency.name,
  });
};



