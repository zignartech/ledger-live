// @flow

import React, { ComponentType } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { rgba } from "~/renderer/styles/helpers";
import Box from "~/renderer/components/Box";
import { createStructuredSelector } from "reselect";
import {
  getAccountCurrency,
  getAccountName,
  getAccountUnit,
  getMainAccount,
} from "@ledgerhq/live-common/account/index";

import ConfirmationCell from "./ConfirmationCell";
import DateCell from "./DateCell";
import AccountCell from "./AccountCell";
import AddressCell from "./AddressCell";
import AmountCell from "./AmountCell";
import { confirmationsNbForCurrencySelector } from "~/renderer/reducers/settings";
import { isConfirmedOperation } from "@ledgerhq/live-common/operation";
import Button from "../Button";
import { openModal } from "~/renderer/actions/modals";
import { getAccountBridge } from "~/../../../libs/ledger-live-common/lib/bridge/impl";

const mapStateToProps = createStructuredSelector({
  confirmationsNb: (
    state,
    { account, parentAccount },
  ) =>
    confirmationsNbForCurrencySelector(state, {
      currency: getMainAccount(account, parentAccount).currency,
    }),
});

const OperationComponent = ({
  account,
  parentAccount,
  t,
  operation,
  withAccount,
  text,
  withAddress,
  confirmationsNb,
  dispatch,
  onOperationClick
}) => {
  const isOptimistic = operation.blockHeight === null;
  const currency = getAccountCurrency(account);
  const unit = getAccountUnit(account);
  const mainAccount = getMainAccount(account, parentAccount);
  const isConfirmed = isConfirmedOperation(operation, mainAccount, confirmationsNb);
  const bridge = getAccountBridge(account, parentAccount);
  const onClaim = () => {
    console.log("in onClaim");
    // const claimedOperation = bridge.claimOperation && bridge.claimOperation(mainAccount);
    // console.log("claimedOperation", claimedOperation);
    dispatch(
      openModal("MODAL_SIGN_MESSAGE", {
        account,
        parentAccount,
        message: operation.extra.claimableHash,
        onConfirmationHandler: () => {
          console.log("in onConfirmationHandler");
        },
        onStepChange: () => {
          console.log("in onStepChange");
        },
        onFailHandler: () => {
          console.log("in onFailHandler");
        }
      }),
    );
  };

  const onReject = () => {
    // Do something on reject
  };

  return (
      <OperationRow
        className="operation-row"
        isOptimistic={isOptimistic}
        onClick={() => {
          onOperationClick(operation, account, parentAccount)
        }}
      >
        <ConfirmationCell
          operation={operation}
          parentAccount={parentAccount}
          account={account}
          t={t}
          isConfirmed={isConfirmed}
        />
        <DateCell text={text} operation={operation} t={t} />
        {withAccount && <AccountCell accountName={getAccountName(account)} currency={currency} />}
        {withAddress ? <AddressCell operation={operation} /> : <Box flex="1" />}
        <div style={{ width: "48px", paddingRight: "4px", paddingLeft: "4px" }}>
          {operation.extra.isClaiming && (
            <Box gap={"2px"} horizontal={true}>
              <Button small primary onClick={onClaim}>
                Claim
              </Button>
              <Button small inverted onClick={onReject}>
                Reject
              </Button>
            </Box>
          )}
        </div>
        <AmountCell
          operation={operation}
          currency={currency}
          unit={unit}
          isConfirmed={isConfirmed}
        />
      </OperationRow>
  );
};

OperationComponent.defaultProps = {
  withAccount: false,
  withAddress: true,
};

const ConnectedOperationComponent = connect(mapStateToProps)(
  OperationComponent,
);


const OperationRow = styled(Box).attrs(() => ({
  horizontal: true,
  alignItems: "center",
  ff: "Inter|SemiBold",
  fontSize: 3,
  color: "palette.text.shade100",
  px: 4,
  py: 3,
}))<any>`
  cursor: pointer;
  border-bottom: 1px solid ${({theme}) => rgba(theme.colors.palette.text.shade20, 0.2)};
  &:hover {
    background: ${({theme}) => rgba(theme.colors.palette.text.shade20, 0.1)};
  }
  &:last-child {
    border-bottom: none;
  }
`;

export default ConnectedOperationComponent;

