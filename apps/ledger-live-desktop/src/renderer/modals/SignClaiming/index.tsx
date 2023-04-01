// @flow

import React from "react";
import Modal from "~/renderer/components/Modal";
import Body from "./Body";

const SignMessage = (props: { onClose: Function }) => {
  const rest: any = {};
  if (props.onClose) {
    rest.onClose = props.onClose;
  }

  return (
    <Modal
      name="MODAL_SIGN_CLAIMING"
      centered
      render={({ data, onClose }: any) => <Body onClose={onClose} data={data} />}
      {...rest}
    />
  );
};

export default SignMessage;
