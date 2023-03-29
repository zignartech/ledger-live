// @flow

import React from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { Account } from "~/../../../libs/ledgerjs/packages/types-live/lib";
import { closeModal } from "~/renderer/actions/modals";
import Track from "~/renderer/analytics/Track";
import Stepper from "~/renderer/components/Stepper";
import { getCurrentDevice } from "~/renderer/reducers/devices";
import { Trans } from "react-i18next";
import type { Device } from "@ledgerhq/live-common/hw/actions/types";
import DeviceAction from "~/renderer/components/DeviceAction";
import StepProgress from "~/renderer/components/StepProgress";
import { createAction } from "@ledgerhq/live-common/hw/actions/transaction";
import { useBroadcast } from "~/renderer/hooks/useBroadcast";
import type { AccountLike } from "@ledgerhq/types-live";
import { command } from "~/renderer/commands";
import { getEnv } from "@ledgerhq/live-common/env";
import { mockedEventEmitter } from "~/renderer/components/debug/DebugMock";
import { DeviceBlocker } from "~/renderer/components/DeviceAction/DeviceBlocker";
import { getAccountBridge } from "~/renderer/bridge/proxy";
import useBridgeTransaction from "~/../../../libs/ledger-live-common/lib/bridge/useBridgeTransaction";
interface Props {
  onChangeStepId: (stepId: number) => void;
  setError: (error?: Error) => void;
  stepId: number;
  params: {
    account: Account;
    canEditFees: boolean;
    parentAccount: Account | null | undefined;
    transactionData: any;
  };
  data: any;
}


function StepConnectDevice({
  account,
  operation,
}: {
  account: Account,
  operation: any,
}) {
  const bridge = getAccountBridge(account, account);
  const device = useSelector(getCurrentDevice);

  const claim = () => {
    return bridge.claimOperation && bridge.claimOperation({
      account: account,
      device: device,
      claimedActivity: {
        isClaimed: true,
        claimingTransactionId: operation.id,
        claimedTimestamp: Date.now(),
      }
    })
  }

  return (
    <div>
    <DeviceAction
      action={
        {
          useHook: () => {
            const data = useBridgeTransaction();
            console.log(data)
            return {
              ...data,
            }
          },
          mapResult: (result) => result,
        }
      }
      request={claim}
    /> 
    </div>
  )

}


const Body = ({ onChangeStepId, setError, stepId, params, data }: Props) => {
  const device = useSelector(getCurrentDevice);
  const dispatch = useDispatch();
  const { t } = useTranslation();

  const openedFromAccount = !!params.account;
  const steps = [
    {
      id: "device",
      label: t("send.steps.device.title"),
      component: <StepConnectDevice operation={
        data.operation as any
      } account={
        data.account as Account
      }  />,
      onBack: () => {
        console.log("transitionTo: ", "back");
      },
    },
  ];

  const stepperProps = {
    title: t("signmessage.title"),
    account: data.account,
    onStepChange: onChangeStepId,
    stepId,
    steps,
    message: data.message,
    onConfirmationHandler: data.onConfirmationHandler,
    onFailHandler: data.onFailHandler,
    onClose: () => dispatch(closeModal("MODAL_SIGN_CLAIMING")),
  } as any;

  return (
    <Stepper {...stepperProps}>
      <Track onUnmount event="CloseModalWalletConnectPasteLink" />
    </Stepper>
  );
};

export default Body;
