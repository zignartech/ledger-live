// @flow
import React from "react";
import TrackPage from "~/renderer/analytics/TrackPage";
import { getMainAccount } from "@ledgerhq/live-common/account/index";
import GenericStepConnectDevice from "./StepSign";

export default function StepConnectDevice({
  account,
  parentAccount,
  transaction,
  status,
  transitionTo,
  useApp,
  onTransactionError,
  onTransactionSigned,
}) {
  // Nb setting the mainAccount as a dependency will ensure latest versions of plugins.
  const dependencies = [getMainAccount(account, parentAccount)];
  return (
    <>
      <TrackPage category="Sign Transaction Flow" name="Step ConnectDevice" />
      <GenericStepConnectDevice
        account={account}
        useApp={useApp}
        parentAccount={parentAccount}
        transaction={transaction}
        status={status}
        transitionTo={transitionTo}
        onTransactionError={onTransactionError}
        onTransactionSigned={onTransactionSigned}
        dependencies={dependencies}
        requireLatestFirmware
      />
    </>
  );
}
