import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { AnyAction } from "redux";
import useBridgeTransaction from "~/../../../libs/ledger-live-common/lib/bridge/useBridgeTransaction";
import { Account } from "~/../../../libs/ledgerjs/packages/types-live/lib";
import { getAccountBridge } from "~/renderer/bridge/proxy";
import { getCurrentDevice } from "~/renderer/reducers/devices";
import StepConnectDevice from "../Send/steps/GenericStepConnectDevice";

interface Props {
  onChangeStepId: (stepId: number) => void;
  onClose: () => void;
  setError: (error?: Error) => void;
  stepId: number;
  params: {
    account: Account;
    canEditFees: boolean;
    parentAccount: Account | null | undefined;
    transactionData: any;
  };
}

export const Body = ({ onChangeStepId, onClose, setError, stepId, params }: Props) => {
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
        console.log("transitionTo: ", 'back');
      }
    }
  ];

  const {
    account,
    parentAccount,
    setAccount,
    status,
    bridgeError,
    bridgePending,
  } = useBridgeTransaction(() => {
    const parentAccount = (params && params.parentAccount) || null;
    const account = params && params.account;

    const bridge = getAccountBridge(account, parentAccount);
    const claimedActivity = {
      claimingTransactionId: "0x1234567890",
      isClaimed: true,
      claimedTimestamp: Date.now(),
    } as any;
    const claimOperation =
      bridge.claimOperation &&
      bridge.claimOperation({
        account,
        device: device,
        claimedActivity: claimedActivity,
      });

    console.log("claimOperation: ", claimOperation);
    const transaction = bridge.createTransaction(account);
    console.log("transaction: ", transaction);

    return { account, parentAccount, transaction };
  });
};
