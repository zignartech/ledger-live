// @flow

import React, { useState } from "react";
import Modal from "~/renderer/components/Modal";
import Body from "./Body";

const SignMessage = () => {
  const rest = {};
  const [state, setState] = useState({
    stepId: "summary",
    error: undefined,
  });
  const handleStepChange = stepId => setState({ ...state, stepId });

  // return (
  //   <Modal
  //     name="MODAL_SIGN_CLAIMING"
  //     centered
  //     refocusWhenChange={rest.refocusWhenChange}
  //     onHide={rest.onClose}
  //     preventBackdropClick={rest.preventBackdropClick}
  //     render={({ data }: any) => <Body data={data} />}
  //     {...rest}
  //   />
  // );

  return (
    <Modal
      name="MODAL_SIGN_CLAIMING"
      centered
      refocusWhenChange={rest.refocusWhenChange}
      onHide={rest.onClose}
      render={({ data }) => (
        <Body transactionData={data} stepId={"device"} onChangeStepId={handleStepChange} />
      )}
    />
  );
};

export default SignMessage;
