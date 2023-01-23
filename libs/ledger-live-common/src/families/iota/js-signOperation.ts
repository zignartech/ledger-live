// Copyright 2020 IOTA Stiftung
// SPDX-License-Identifier: Apache-2.0

import { WriteStream } from "@iota/util.js";
import {
  serializeTransactionEssence,
  ED25519_ADDRESS_TYPE,
  ED25519_SIGNATURE_TYPE,
  IBasicOutput,
  ITransactionEssence,
  TRANSACTION_ESSENCE_TYPE,
  ITransactionPayload,
  TRANSACTION_PAYLOAD_TYPE,
  BASIC_OUTPUT_TYPE,
  ADDRESS_UNLOCK_CONDITION_TYPE,
  UnlockTypes,
  REFERENCE_UNLOCK_TYPE,
  SIGNATURE_UNLOCK_TYPE,
  IndexerPluginClient,
  SingleNodeClient,
  DEFAULT_PROTOCOL_VERSION,
  IBlock,
  IOutputsResponse,
  TransactionHelper,
  IUTXOInput,
  OutputTypes,
} from "@iota/iota.js";

import Iota from "./hw-app-iota";
import {
  addressToPubKeyHash,
  arrayToHex,
  deviceResponseToUint8Array,
} from "./utils";
import { Transaction } from "./types";

import {
  Account,
  SignOperationEvent,
  DeviceId,
  Operation,
} from "@ledgerhq/types-live";
import { withDevice } from "../../hw/deviceAccess";
import { Observable } from "rxjs";
import BigNumber from "bignumber.js";
import Transport from "@ledgerhq/hw-transport";
import { log } from "@ledgerhq/logs";
import { getUrl } from "./api";
import {
  ED25519_PUBLIC_KEY_LENGTH,
  ED25519_SIGNATURE_LENGTH,
} from "./hw-app-iota/constants";
import { WasmPowProvider } from "@iota/pow-wasm.js";
// import { NodePowProvider } from "@iota/pow-node.js";

async function buildOptimisticOperation({
  account,
  value,
  recipients,
  senders,
}: {
  account: Account;
  value: BigNumber;
  recipients: string[];
  senders: string[];
}): Promise<Operation> {
  const operation: Operation = {
    id: `${account.id}--OUT`,
    hash: "",
    type: "OUT",
    value: value,
    fee: new BigNumber(0),
    blockHash: null,
    blockHeight: null,
    senders: senders,
    recipients: recipients,
    accountId: account.id,
    date: new Date(),
    extra: {},
  };

  return operation;
}

/**
 * Build a transaction payload.
 * @param inputsAndSignatureKeyPairs The inputs with the signature key pairs needed to sign transfers.
 * @param outputs The outputs to send.
 * @param indexation Optional indexation data to associate with the transaction.
 * @param indexation.key Indexation key.
 * @param indexation.data Optional index data.
 * @returns The transaction payload.
 */
export async function buildTransactionPayload(
  account: Account,
  transport: Transport,
  transaction: Transaction
): Promise<ITransactionPayload> {
  // Instance client local pow and iota transport
  const iota = new Iota(transport);
  const api_endpoint = getUrl(account.currency.id, "");
  const client = new SingleNodeClient(api_endpoint, {
    powProvider: new WasmPowProvider(),
  });

  // Fetch node info
  const protocolInfo = await client.protocolInfo();

  // Address owner
  const genesisWalletAddressBech32 = account.freshAddress;

  // Because we are using the genesis address we must use send advanced as the input address is
  // not calculated from a Bip32 path, if you were doing a wallet to wallet transfer you can just use send
  // which calculates all the inputs/outputs for you
  const indexerPlugin = new IndexerPluginClient(client);

  /*******************************
   ** Prepare Transaction
   *******************************/

  // 1. Fetch outputId with funds to be used as input
  // Indexer returns outputIds of matching outputs.
  const genesisAddressOutputs = await fetchAndWaitForBasicOutputs(
    genesisWalletAddressBech32,
    indexerPlugin
  );

  let totalFunds: BigNumber = new BigNumber(0);
  const amountToSend: BigNumber = new BigNumber(transaction.amount);

  // 2. Prepare Inputs for the transaction
  const inputs: IUTXOInput[] = [];
  const consumingOutputs: OutputTypes[] = [];
  let hasRemainder = false;

  for (let i = 0; i < genesisAddressOutputs.items.length; i++) {
    // Fetch the output itself
    const output = await client.output(genesisAddressOutputs.items[i]);
    if (!output.metadata.isSpent && output.output.type === BASIC_OUTPUT_TYPE)
      totalFunds = totalFunds.plus((output.output as IBasicOutput).amount);
  }

  if (amountToSend.isGreaterThan(totalFunds)) {
    throw new Error("Not enough funds to send");
  }

  if (totalFunds.isEqualTo(amountToSend)) {
    for (let i = 0; i < genesisAddressOutputs.items.length; i++) {
      // Fetch the all outputs itself
      const output = await client.output(genesisAddressOutputs.items[i]);
      if (
        !output.metadata.isSpent &&
        output.output.type === BASIC_OUTPUT_TYPE
      ) {
        inputs.push(
          TransactionHelper.inputFromOutputId(genesisAddressOutputs.items[i])
        );
        consumingOutputs.push(output.output);
      }
    }
  }

  let match = false;

  if (totalFunds.isGreaterThan(amountToSend)) {
    for (let i = 0; i < genesisAddressOutputs.items.length; i++) {
      // Fetch the output itself match with amount to send
      const output = await client.output(genesisAddressOutputs.items[i]);
      if (
        !output.metadata.isSpent &&
        output.output.type === BASIC_OUTPUT_TYPE
      ) {
        if (
          new BigNumber((output.output as IBasicOutput).amount).isEqualTo(
            amountToSend
          )
        ) {
          inputs.push(
            TransactionHelper.inputFromOutputId(genesisAddressOutputs.items[i])
          );
          consumingOutputs.push(output.output);
          match = true;
          break;
        }
      }
    }
  }

  if (totalFunds.isGreaterThan(amountToSend) && !match) {
    let consumedBalance: BigNumber = new BigNumber(0);
    for (let i = 0; i < genesisAddressOutputs.items.length; i++) {
      const output = await client.output(genesisAddressOutputs.items[i]);
      if (
        !output.metadata.isSpent &&
        output.output.type === BASIC_OUTPUT_TYPE
      ) {
        consumedBalance = consumedBalance.plus(
          (output.output as IBasicOutput).amount
        );
        inputs.push(
          TransactionHelper.inputFromOutputId(genesisAddressOutputs.items[i])
        );
        consumingOutputs.push(output.output);
        if (consumedBalance.isEqualTo(amountToSend)) {
          break;
        }
        // Fetch the outputs itself with remainder
        if (consumedBalance.isGreaterThan(amountToSend)) {
          totalFunds = consumedBalance;
          hasRemainder = true;
          break;
        }
      }
    }
  }

  // Start with finding the outputs. They need to have
  // a specific structure

  const pubKeyHash = addressToPubKeyHash(transaction.recipient);

  // 3. Create outputs
  const outputs: IBasicOutput[] = [];
  outputs.push({
    type: BASIC_OUTPUT_TYPE,
    amount: amountToSend.toString(),
    nativeTokens: [],
    unlockConditions: [
      {
        type: ADDRESS_UNLOCK_CONDITION_TYPE,
        address: {
          type: ED25519_ADDRESS_TYPE,
          pubKeyHash: pubKeyHash,
        },
      },
    ],
    features: [],
  });

  if (hasRemainder) {
    outputs.push({
      type: BASIC_OUTPUT_TYPE,
      amount: totalFunds.minus(amountToSend).toString(),
      nativeTokens: [],
      unlockConditions: [
        {
          type: ADDRESS_UNLOCK_CONDITION_TYPE,
          address: {
            type: ED25519_ADDRESS_TYPE,
            pubKeyHash: addressToPubKeyHash(account.freshAddress),
          },
        },
      ],
      features: [],
    });
  }

  // 4. Get inputs commitment
  const inputsCommitment =
    TransactionHelper.getInputsCommitment(consumingOutputs);

  // 5.Create transaction essence
  const transactionEssence: ITransactionEssence = {
    type: TRANSACTION_ESSENCE_TYPE,
    networkId: TransactionHelper.networkIdFromNetworkName(
      protocolInfo.networkName
    ),
    inputs,
    inputsCommitment,
    outputs,
    payload: undefined,
  };

  const wsTsxEssence = new WriteStream();
  serializeTransactionEssence(wsTsxEssence, transactionEssence);
  const path = account.freshAddresses[0].derivationPath; // for stardust, only the first address is used (change = 0)
  const pathArray = Iota._validatePath(path);

  // we have to add the key indices for each input after the essence
  for (let i = 0; i < inputs.length; i++) {
    wsTsxEssence.writeUInt32("bip32_index", pathArray[3]);
    wsTsxEssence.writeUInt32("bip32_change", pathArray[4]);
  }

  const essenceFinal = Buffer.from(wsTsxEssence.finalBytes());

  // write essence to the Ledger device data buffer and let the user confirm it.
  await iota._writeDataBuffer(essenceFinal);

  // If hasRemainder is true, remainder exists
  // and the ledger device must know what output index it is.
  if (hasRemainder) {
    await iota._prepareSigning(1, 1, 0x80000000, 0x80000000);
  } else {
    await iota._prepareSigning(0, 0, 0x80000000, 0x80000000);
  }

  // let the user confirm the transaction.
  await iota._showSigningFlow();
  await iota._userConfirmEssence();
  await iota._showSignedSuccessfullyFlow();
  await new Promise((resolve) => setTimeout(resolve, 2000)); // wait 1 second
  await iota._showMainFlow();

  // 6. Create the unlocks
  const unlocks: UnlockTypes[] = [];

  for (let index = 0; index < inputs.length; index++) {
    const response = await iota._signSingle(index);
    if (response.fields.signature_type) {
      unlocks.push({
        type: REFERENCE_UNLOCK_TYPE,
        reference: response.reference,
      });
    } else {
      // parse device response to a hexadecimal string
      const publicKey = deviceResponseToUint8Array(
        response.fields.ed25519_public_key,
        ED25519_PUBLIC_KEY_LENGTH
      );
      const signature = deviceResponseToUint8Array(
        response.fields.ed25519_signature,
        ED25519_SIGNATURE_LENGTH
      );
      unlocks.push({
        type: SIGNATURE_UNLOCK_TYPE,
        signature: {
          type: ED25519_SIGNATURE_TYPE,
          publicKey: arrayToHex(publicKey),
          signature: arrayToHex(signature),
        },
      });
    }
  }

  // 7. Create transaction payload
  const transactionPayload: ITransactionPayload = {
    type: TRANSACTION_PAYLOAD_TYPE,
    essence: transactionEssence,
    unlocks,
  };

  return transactionPayload;
}

async function fetchAndWaitForBasicOutputs(
  addressBech32: string,
  indexerPlugin: IndexerPluginClient
): Promise<IOutputsResponse> {
  let outputsResponse: IOutputsResponse = {
    ledgerIndex: 0,
    cursor: "",
    pageSize: "",
    items: [],
  };
  const maxTries = 10;
  let tries = 0;
  while (outputsResponse.items.length == 0) {
    if (tries > maxTries) {
      break;
    }
    tries++;
    outputsResponse = await indexerPlugin.basicOutputs({
      addressBech32: addressBech32,
      hasStorageDepositReturn: false,
      hasExpiration: false,
      hasTimelock: false,
      hasNativeTokens: false,
    });
    if (outputsResponse.items.length == 0) {
      await new Promise((f) => setTimeout(f, 1000));
    }
  }
  if (tries > maxTries) {
    throw new Error("Didn't find any outputs for address");
  }

  return outputsResponse;
}

/**
 * Send a transfer from the balance on the seed.
 * @param client The client or node endpoint to send the transfer with.
 * @param inputsAndSignatureKeyPairs The inputs with the signature key pairs needed to sign transfers.
 * @param outputs The outputs to send.
 * @param indexation Optional indexation data to associate with the transaction.
 * @param indexation.key Indexation key.
 * @param indexation.data Optional index data.
 * @returns The id of the message created and the remainder address if one was needed.
 */
const signOperation = ({
  account,
  transaction,
  deviceId,
}: {
  account: Account;
  transaction: Transaction;
  deviceId: DeviceId;
}): Observable<SignOperationEvent> =>
  withDevice(deviceId)((transport) => {
    return new Observable((o) => {
      void (async function () {
        try {
          o.next({
            type: "device-signature-requested",
          });
          log("building transaction payload...");

          const transactionPayload = await buildTransactionPayload(
            account,
            transport,
            transaction
          );

          o.next({
            type: "device-signature-granted",
          });

          const recipients: string[] = [transaction.recipient];
          const value = transaction.amount;
          const block: IBlock = {
            protocolVersion: DEFAULT_PROTOCOL_VERSION,
            parents: [],
            payload: transactionPayload,
            nonce: "0",
          };
          const operation = await buildOptimisticOperation({
            account: account,
            value: new BigNumber(value),
            recipients: recipients,
            senders: [account.freshAddress], // we are assuming one address per account.
          });

          o.next({
            type: "signed",
            signedOperation: {
              operation,
              signature: JSON.stringify(block),
              expirationDate: null,
            },
          });
          o.complete();
        } catch (err) {
          o.error(err);
        }
      })();
    });
  });

export default signOperation;
