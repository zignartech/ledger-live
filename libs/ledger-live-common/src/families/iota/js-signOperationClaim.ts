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
  SingleNodeClient,
  DEFAULT_PROTOCOL_VERSION,
  IBlock,
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
import { fetchAllOutputs, getUrl } from "./api";
import {
  ED25519_PUBLIC_KEY_LENGTH,
  ED25519_SIGNATURE_LENGTH,
} from "./hw-app-iota/constants";
// import { WasmPowProvider } from "@iota/pow-wasm.js";
// import { NodePowProvider } from "@iota/pow-node.js";

interface ClaimedActivity {
  isClaimed: boolean;
  claimingTransactionId: string;
  claimedTimestamp: number;
}

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
  claimedActivity?: ClaimedActivity
): Promise<ITransactionPayload> {
  // Instance client local pow and iota transport
  const iota = new Iota(transport);
  const api_endpoint = getUrl(account.currency.id, "");
  const client = new SingleNodeClient(api_endpoint);

  // Fetch node info
  const protocolInfo = await client.protocolInfo();

  // Address owner
  const genesisWalletAddressBech32 = account.freshAddress;

  // Because we are using the genesis address we must use send advanced as the input address is
  // not calculated from a Bip32 path, if you were doing a wallet to wallet transfer you can just use send
  // which calculates all the inputs/outputs for you

  /*******************************
   ** Prepare Transaction
   *******************************/

  const hasExpiration = claimedActivity?.isClaimed ? true : false;

  // 1. Fetch outputId with funds to be used as input
  // Indexer returns outputIds of matching outputs.
  const genesisAddressOutputs = await fetchAllOutputs(
    account.currency.id,
    genesisWalletAddressBech32,
    hasExpiration
  );

  // 2. Prepare Inputs for the transaction
  const inputs: IUTXOInput[] = [];
  const consumingOutputs: OutputTypes[] = [];
  const pubKeyHash = addressToPubKeyHash(account.freshAddress);

  let consumedBalance: BigNumber = new BigNumber(0);
  for (let i = 0; i < genesisAddressOutputs.items.length; i++) {
    const output = await client.output(genesisAddressOutputs.items[i]);
    if (
      !output.metadata.isSpent &&
      output.output.type === BASIC_OUTPUT_TYPE &&
      output.metadata.transactionId === claimedActivity?.claimingTransactionId
    ) {
      consumedBalance = consumedBalance.plus(
        (output.output as IBasicOutput).amount
      );
      inputs.push(
        TransactionHelper.inputFromOutputId(genesisAddressOutputs.items[i])
      );
      consumingOutputs.push(output.output);
      // pubKeyHash = output.output.unlockConditions.find((unlock) => {
      //   if (unlock.type === 3 && unlock.returnAddress)
      //     return unlock.returnAddress;
      // });
      break;
    }
  }

  // Start with finding the outputs. They need to have
  // a specific structure

  // 3. Create outputs
  const outputs: IBasicOutput[] = [];
  outputs.push({
    type: BASIC_OUTPUT_TYPE,
    amount: consumedBalance.toString(),
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
  await iota._prepareSigning(0, 0, 0x80000000, 0x80000000);

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
const signOperationClaim = ({
  account,
  deviceId,
}: {
  account: Account;
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
            transport
          );

          o.next({
            type: "device-signature-granted",
          });

          // const recipients: string[] = [transaction.recipient];
          const value = transactionPayload.essence.outputs[0].amount;
          const block: IBlock = {
            protocolVersion: DEFAULT_PROTOCOL_VERSION,
            parents: [],
            payload: transactionPayload,
            nonce: "0",
          };
          const operation = await buildOptimisticOperation({
            account: account,
            value: new BigNumber(value),
            recipients: [account.freshAddress],
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

export default signOperationClaim;
