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
import { ClaimedActivity, Transaction } from "./types";

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
import { fetchAllOutputs, getAccountBalance, getUrl } from "./api";
import {
  ED25519_PUBLIC_KEY_LENGTH,
  ED25519_SIGNATURE_LENGTH,
} from "./hw-app-iota/constants";

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
  const { freshAddress } = account;

  const { amount, recipient, claimedActivity } = transaction;

  const { isClaiming, claimTransactionId } = claimedActivity as ClaimedActivity;

  let amountToSend: BigNumber = new BigNumber(0);
  let addressToSend: string;

  // Instance client local pow and iota transport
  const iota = new Iota(transport);
  const api_endpoint = getUrl(account.currency.id, "");
  const client = new SingleNodeClient(api_endpoint);

  // Fetch node info
  const protocolInfo = await client.protocolInfo();

  const hasExpiration = isClaiming ? true : false;

  /*******************************
   ** Prepare Transaction
   *******************************/

  // 1. Fetch outputId with funds to be used as input
  // Indexer returns outputIds of matching outputs.
  const genesisAddressOutputs = await fetchAllOutputs(
    account.currency.id,
    freshAddress,
    hasExpiration
  );

  // 2. Prepare Inputs for the transaction
  const inputs: IUTXOInput[] = [];
  const consumingOutputs: OutputTypes[] = [];

  let consumedBalance: BigNumber = new BigNumber(0);
  let hasRemainder = false;

  if (isClaiming) {
    for (let i = 0; i < genesisAddressOutputs.items.length; i++) {
      const output = await client.output(genesisAddressOutputs.items[i]);
      if (
        !output.metadata.isSpent &&
        output.output.type === BASIC_OUTPUT_TYPE &&
        output.metadata.transactionId === claimTransactionId
      ) {
        amountToSend = amountToSend.plus(
          (output.output as IBasicOutput).amount
        );
        inputs.push(
          TransactionHelper.inputFromOutputId(genesisAddressOutputs.items[i])
        );
        consumingOutputs.push(output.output);
        break;
      }
    }
    addressToSend = freshAddress;
  } else {
    amountToSend = amountToSend.plus(amount);
    const balance = await getAccountBalance(account.currency.id, freshAddress);

    if (amountToSend.isGreaterThan(balance)) {
      throw new Error("Not enough funds to send");
    }

    for (const element of genesisAddressOutputs.items) {
      const output = await client.output(element);
      if (
        !output.metadata.isSpent &&
        output.output.type === BASIC_OUTPUT_TYPE
      ) {
        consumedBalance = consumedBalance.plus(output.output.amount);
        inputs.push(TransactionHelper.inputFromOutputId(element));
        consumingOutputs.push(output.output);
        if (consumedBalance.isEqualTo(amountToSend)) {
          break;
        }
        // Fetch the outputs itself with remainder
        if (consumedBalance.isGreaterThan(amountToSend)) {
          hasRemainder = true;
          break;
        }
      }
    }
    addressToSend = recipient;
  }

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
          pubKeyHash: addressToPubKeyHash(addressToSend),
        },
      },
    ],
    features: [],
  });

  if (hasRemainder) {
    outputs.push({
      type: BASIC_OUTPUT_TYPE,
      amount: consumedBalance.minus(amountToSend).toString(),
      nativeTokens: [],
      unlockConditions: [
        {
          type: ADDRESS_UNLOCK_CONDITION_TYPE,
          address: {
            type: ED25519_ADDRESS_TYPE,
            pubKeyHash: addressToPubKeyHash(freshAddress),
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
