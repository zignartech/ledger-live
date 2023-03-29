import React from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { AnyAction } from "redux";
import useBridgeTransaction from "~/../../../libs/ledger-live-common/lib/bridge/useBridgeTransaction";
import { Account } from "~/../../../libs/ledgerjs/packages/types-live/lib";
import { closeModal } from "~/renderer/actions/modals";
import Track from "~/renderer/analytics/Track";
import { getAccountBridge } from "~/renderer/bridge/proxy";
import Stepper from "~/renderer/components/Stepper";
import { getCurrentDevice } from "~/renderer/reducers/devices";
import StepConnectDevice from "../Send/steps/GenericStepConnectDevice";

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
  data: any
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
      component: StepConnectDevice,
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