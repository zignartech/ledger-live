// @flow
import React, { useCallback, useState } from "react";
import Track from "~/renderer/analytics/Track";
import { Trans, useTranslation } from "react-i18next";
import StepSummary, { StepSummaryFooter } from "./steps/StepSummary";
import StepSign from "./steps/StepSign";
import Stepper from "~/renderer/components/Stepper";


const steps = [
  {
    id: "summary",
    label: <Trans i18nKey="signmessage.steps.summary.title" />,
    component: StepSummary,
    footer: StepSummaryFooter,
  },
  {
    id: "sign",
    label: <Trans i18nKey="signmessage.steps.sign.title" />,
    component: StepSign,
    onBack: ({ transitionTo }) => {
      transitionTo("summary");
    },
  },
];

const Body = ({ onClose, data, onChangeStepId }) => {
  const { t } = useTranslation();
  const [stepId, setStepId] = useState("summary");

  const handleStepChange = useCallback(e => onChangeStepId(e.id), [onChangeStepId]);

  const stepperProps = {
    title: t("signmessage.title"),
    account: data.account,
    onStepChange: handleStepChange,
    stepId,
    steps,
    message: data.message,
    onConfirmationHandler: data.onConfirmationHandler,
    onFailHandler: data.onFailHandler,
    onClose,
  };

  return (
    <Stepper {...stepperProps}>
      <Track onUnmount event="CloseModalWalletConnectPasteLink" />
    </Stepper>
  );
};

export default Body;
