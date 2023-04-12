// @flow

import React, { useCallback, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import useBridgeTransaction from "@ledgerhq/live-common/bridge/useBridgeTransaction";
import { UserRefusedOnDevice } from "@ledgerhq/errors";
import Stepper from "~/renderer/components/Stepper";
import { SyncSkipUnderPriority } from "@ledgerhq/live-common/bridge/react/index";
import { isTokenAccount } from "@ledgerhq/live-common/account/index";
import { closeModal, openModal } from "~/renderer/actions/modals";
import { getCurrentDevice } from "~/renderer/reducers/devices";
import Track from "~/renderer/analytics/Track";
import StepConnectDevice from "./steps/StepConnectDevice";
import StepSummary, { StepSummaryFooter } from "./steps/StepSummary";
import { getAccountBridge } from "@ledgerhq/live-common/bridge/index";
import logger from "~/logger/logger";


function useSteps() {
  const { t } = useTranslation();

  return useMemo(() => {
    const steps = [
      {
        id: "summary",
        label: t("send.steps.summary.title"),
        component: StepSummary,
        footer: StepSummaryFooter,
      },
      {
        id: "device",
        label: t("send.steps.device.title"),
        component: StepConnectDevice,
        onBack: ({ transitionTo }) => transitionTo("summary"),
      },
    ];

    return steps;
  }, [t]);
}


export default function Body({ onChangeStepId, onClose, setError, stepId, transactionData }) {
  const device = useSelector(getCurrentDevice);
  const dispatch = useDispatch();
  const { t } = useTranslation();
  console.log(transactionData)
  const openedFromAccount = !!transactionData.account;
  const steps = useSteps();

  const {
    transaction,
    setTransaction,
    updateTransaction,
    account,
    parentAccount,
    setAccount,
    status,
    bridgeError,
    bridgePending,
  } = useBridgeTransaction(() => {
    const parentAccount = transactionData && transactionData.parentAccount;
    const account = transactionData && transactionData.account;

    const bridge = getAccountBridge(account, parentAccount);
    const tx = bridge.createTransaction(account);

    const { recipient, ...txData } = transactionData;
    const tx2 = bridge.updateTransaction(tx, {
      recipient,
      subAccountId: isTokenAccount(account) ? account.id : undefined,
    });
    const transaction = bridge.updateTransaction(tx2, {
      userGasLimit: txData.gasLimit,
      ...txData,
    });

    return { account, parentAccount, transaction };
  });

  const [transactionError, setTransactionError] = useState(null);

  const handleOpenModal = useCallback((name, data) => dispatch(openModal(name, data)), [dispatch]);

  const handleCloseModal = useCallback(() => {
    dispatch(closeModal("MODAL_SIGN_CLAIMING"));
  }, [dispatch]);

  const handleChangeAccount = useCallback(
    (nextAccount, nextParentAccount) => {
      if (account !== nextAccount) {
        setAccount(nextAccount, nextParentAccount);
      }
    },
    [account, setAccount],
  );

  const handleRetry = useCallback(() => {
    setTransactionError(null);
    setError(undefined);
  }, [setError]);

  const handleTransactionError = useCallback(
    (error) => {
      if (!(error instanceof UserRefusedOnDevice)) {
        logger.critical(error);
      }
      setTransactionError(error);
      setError(error);
    },
    [setError],
  );

  const handleStepChange = useCallback(e => onChangeStepId(e.id), [onChangeStepId]);

  const handleTransactionSigned = useCallback(
    (signedTransaction) => {
      transactionData.onResult(signedTransaction);
      handleCloseModal();
    },
    [handleCloseModal, transactionData],
  );

  const errorSteps = [];

  if (transactionError) {
    errorSteps.push(steps.length - 2);
  } else if (bridgeError) {
    errorSteps.push(0);
  }

  const error = transactionError || bridgeError || null;
  const warning = "warning"

  const stepperProps = {
    title: t("sign.title"),
    stepId,
    useApp: transactionData.useApp,
    steps,
    errorSteps,
    device,
    openedFromAccount,
    account,
    parentAccount,
    transaction,
    hideBreadcrumb: (!!error && ["amount"].includes(stepId)) || stepId === "warning",
    error,
    warning,
    status,
    bridgePending,
    openModal: handleOpenModal,
    onClose,
    closeModal: handleCloseModal,
    onChangeAccount: handleChangeAccount,
    onChangeTransaction: setTransaction,
    onRetry: handleRetry,
    onStepChange: handleStepChange,
    onTransactionSigned: handleTransactionSigned,
    onTransactionError: handleTransactionError,
    updateTransaction,
  };

  if (!status) return null;

  return (
    <Stepper {...stepperProps}>
      <SyncSkipUnderPriority priority={100} />
      <Track onUnmount event="CloseModalSignTransaction" />
    </Stepper>
  );
}
