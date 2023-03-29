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
  params:any;
}

const StepDevice = () => {
  return (
    <div></div>
  )
}

const Body = ({ onChangeStepId, setError, stepId, params }: Props) => {
  const device = useSelector(getCurrentDevice);
  console.log(device, 'DEVICE')
  const dispatch = useDispatch();
  const { t } = useTranslation();
  console.log(params, 'PARAMS')
  console.log(t, 't')

  const steps = [
    {
      id: "device",
      label: t("signmessage.steps.device"),
      component: StepDevice,
      onBack: () => dispatch(closeModal("MODAL_SIGN_CLAIMING")),
    },
  ];

  const stepperProps = {
    title: t("signmessage.title"),
    account: params.account,
    onStepChange: onChangeStepId,
    stepId,
    steps,
    message: 'test',
    onConfirmationHandler: params.onTransactionSigned,
    onFailHandler: params.onReject,
    onClose: () => dispatch(closeModal("MODAL_SIGN_CLAIMING")),
  } as any;

  return (
    <Stepper {...stepperProps}>
      <Track onUnmount event="CloseModalWalletConnectPasteLink" />
    </Stepper>
  );
};

export default Body;
