// @flow
import React, { useCallback, useState } from "react";
import type { Account } from "@ledgerhq/types-live";
import Track from "~/renderer/analytics/Track";
import { Trans, useTranslation } from "react-i18next";
import StepSummary, { StepSummaryFooter } from "./steps/StepSummary";
import StepSign from "./steps/StepSign";
import type { St, StepProps } from "./types";
import Stepper from "~/renderer/components/Stepper";
import type { TypedMessageData } from "@ledgerhq/live-common/families/ethereum/types";
import type { MessageData } from "@ledgerhq/live-common/hw/signMessage/types";

type OwnProps = {
  data: {
    account: Account,
    message: MessageData | TypedMessageData,
    onConfirmationHandler: Function,
    onFailHandler: Function,
  },
};

type Props = OwnProps;

const steps: Array<St> = [
  {
    id: "summary",
    label: <Trans i18nKey="signmessage.steps.summary.title" />,
    component: StepSummary,
    footer: StepSummaryFooter,
  },
  {
    id: "device",
    label: <Trans i18nKey="signmessage.steps.sign.title" />,
    component: StepSign,
    onBack: ({ transitionTo }: StepProps) => {
      transitionTo("summary");
    },
    
  },
];

const Body = ({ data }: Props) => {
  const { t } = useTranslation();
  const [stepId, setStepId] = useState("summary");

  const handleStepChange = useCallback(e => setStepId(e.id), [setStepId]);

  const stepperProps = {
    title: t("signmessage.title"),
    account: data.account,
    onStepChange: handleStepChange,
    stepId,
    steps,
    message: data.message,
    onConfirmationHandler: data.onConfirmationHandler,
    onFailHandler: data.onFailHandler,
  };

  return (
    <Stepper {...stepperProps as any}>
      <Track onUnmount event="CloseModalWalletConnectPasteLink" />
    </Stepper>
  );
};

export default Body;