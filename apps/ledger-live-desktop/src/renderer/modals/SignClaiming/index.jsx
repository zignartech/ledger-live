// @flow

import React from "react";
import Modal from "~/renderer/components/Modal";
import Body from "./Body";

const SignMessage = () => {
  const rest = {};

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
      preventBackdropClick
      render={({ data }) => (
        <Body
          transactionData={data}
          stepId={"summary"}
        />
      )}
    />
  );
};

export default SignMessage;
