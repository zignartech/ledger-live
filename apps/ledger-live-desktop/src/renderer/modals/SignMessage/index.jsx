// @flow

import React, { useState } from "react";
import Modal from "~/renderer/components/Modal";
import Body from "./Body";

const SignMessage = (props) => {
  const [state, setState] = useState({
    stepId: "device",
    error: undefined,
  });
  const rest = {};
  if (props.onClose) {
    rest.onClose = props.onClose;
  }

  const handleStepChange = (stepId) => setState({ ...state, stepId });

  return (
    <Modal
      name="MODAL_SIGN_MESSAGE"
      centered
      render={({ data, onClose }) => (
        <Body
          onClose={onClose}
          data={data}
          onChangeStepId={handleStepChange}
          stepId={state.stepId}
        />
      )}
      {...rest}
    />
  );
};

export default SignMessage;
