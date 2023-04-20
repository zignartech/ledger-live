// @flow

import React, { PureComponent } from "react";
import { connect, useDispatch } from "react-redux";
import styled from "styled-components";
import { rgba } from "~/renderer/styles/helpers";
import Box from "~/renderer/components/Box";
import { createStructuredSelector } from "reselect";
import type { TFunction } from "react-i18next";
import type { AccountLike, Account, Operation } from "@ledgerhq/types-live";
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
import type { ThemedComponent } from "~/renderer/styles/StyleProvider";
import { confirmationsNbForCurrencySelector } from "~/renderer/reducers/settings";
import { isConfirmedOperation } from "@ledgerhq/live-common/operation";
import Button from "../Button";
import { openModal } from "~/renderer/actions/modals";
import { getAccountBridge } from "@ledgerhq/live-common/bridge/index";
const mapStateToProps = createStructuredSelector({
  confirmationsNb: (state, { account, parentAccount }) =>
    confirmationsNbForCurrencySelector(state, {
      currency: getMainAccount(account, parentAccount).currency,
    }),
});

const OperationRow: ThemedComponent<{}> = styled(Box).attrs(() => ({
  horizontal: true,
  alignItems: "center",
}))`
  border-bottom: 1px solid ${p => p.theme.colors.palette.divider};
  height: 68px;
  opacity: ${p => (p.isOptimistic ? 0.5 : 1)};
  cursor: pointer;

  &:hover {
    background: ${p => rgba(p.theme.colors.wallet, 0.04)};
  }
`;

type OwnProps = {
  operation: Operation,
  account: AccountLike,
  parentAccount?: Account,
  onOperationClick: (operation: Operation, account: AccountLike, parentAccount?: Account) => void,
  t: TFunction,
  withAccount: boolean,
  withAddress: boolean,
  text?: string,
};

type Props = OwnProps & {
  confirmationsNb: number,
  dispatch: any,
};

const OperationComponent = ({
  account,
  parentAccount,
  t,
  operation,
  withAccount,
  text,
  withAddress,
  confirmationsNb,
  onOperationClick,
}) => {
  const isOptimistic = operation.blockHeight === null;
  const currency = getAccountCurrency(account);
  const unit = getAccountUnit(account);
  const dispatch = useDispatch();
  const mainAccount = getMainAccount(account, parentAccount);
  const isConfirmed = isConfirmedOperation(operation, mainAccount, confirmationsNb);
  console.log("in OperationComponent");
  console.log(mainAccount);
  const onClaim = e => {
    e.stopPropagation();
    console.log("in onClaim");
    console.log(operation.extra);
    dispatch(
      openModal("MODAL_CLAIM", {
        parentAccount: mainAccount,
        account: mainAccount,
        recipient: mainAccount.freshAddress,
        stepId: "device",
        transaction: getAccountBridge(mainAccount, mainAccount).createTransaction(mainAccount),
        amount: operation.value,
        claimedActivity: operation.extra,
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
        onOperationClick(operation, account, parentAccount);
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
          <Box horizontal={true}>
            {new Date(operation.extra.unixTime * 1000) > new Date() ? (
              <Box gap={"2px"} horizontal={true}>
                <Button small primary onClick={onClaim}>
                  Claim
                </Button>
                <Button small inverted onClick={onReject}>
                  Reject
                </Button>
              </Box>
            ) : (
              <div
                style={{
                  fontSize: "12px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                Expired
              </div>
            )}
          </Box>
        )}
      </div>
      <AmountCell operation={operation} currency={currency} unit={unit} isConfirmed={isConfirmed} />
    </OperationRow>
  );
};

const ConnectedOperationComponent: React$ComponentType<OwnProps> = connect(mapStateToProps)(
  OperationComponent,
);

export default ConnectedOperationComponent;
