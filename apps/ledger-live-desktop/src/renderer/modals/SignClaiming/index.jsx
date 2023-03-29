import Modal from "~/renderer/components/Modal";
import Body from "./Body";

const ClaimOperationModal = ({
  t,
  account,
  parentAccount,
  transaction,
  status,
  bridgeError,
  bridgePending,
  onRetry,
  onTransactionSigned,
  onTransactionError,
  updateTransaction,
  closeModal,
  openedFromAccount,
  openModal,
  useApp,
  operation,
  ...props
}) => {
  console.log("ClaimOperationModal", props);
  return (
    <Modal
      name="MODAL_SIGN_CLAIMING"
      centered
      refocusWhenChange={"device"}
      onHide={closeModal ? () => closeModal() : undefined}
      preventBackdropClick
      render={({ onClose, data }) => (
        <Body
          stepId={"device"}
          onClose={() => {
            if (data.onCancel) {
              data.onCancel(new Error("Signature interrupted by user"));
            }
            onClose();
          }}
          onChangeStepId={() => {
            console.log("onChangeStepId");
          }}
          params={data || {}}
          data={{
            account: account,
            operation: operation,
            onConfirmationHandler: onTransactionSigned,
            onFailHandler: onTransactionError,
          }}
        />
      )}
    />
  );
};

export default ClaimOperationModal;
