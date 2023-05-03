import { Account, Operation, SignedOperation } from "@ledgerhq/types-live";
import { IBlock, SingleNodeClient } from "@iota/iota.js";
// import { WasmPowProvider } from "@iota/pow-wasm.js";
import { getUrl } from "./api";
import { NeonPowProvider } from "@iota/pow-neon.js";

export default async function broadcast({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  account,
  signedOperation,
}: {
  account: Account;
  signedOperation: SignedOperation;
}): Promise<Operation> {
  const { signature, operation } = signedOperation;
  const block: IBlock = JSON.parse(signature);
  const API_ENDPOINT = getUrl(account.currency.id, "");
  const client = new SingleNodeClient(API_ENDPOINT, {
    powProvider: new NeonPowProvider(),
  });
  const messageId = await client.blockSubmit(block, 240, 1);
  operation.id = `${messageId}-OUT`;
  operation.hash = messageId;
  return operation;
}
