// @flow

import React, { useState } from "react";
import Modal from "~/renderer/components/Modal";
import Body from "./Body";

const SignMessage = (props) => {
  const [state, setState] = useState({
    stepId: stepId || "summary",
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
        />
      )}
      {...rest}
    />
  );
};

export default SignMessage;
