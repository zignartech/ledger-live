import Modal from "~/renderer/components/Modal";

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
          onChangeStepId={handleStepChange}
          params={data || {}}
        />
      )}
    />
  );
};

export default ClaimOperationModal;
