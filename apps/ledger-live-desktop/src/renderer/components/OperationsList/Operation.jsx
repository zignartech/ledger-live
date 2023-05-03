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

  function getTimeRemaining(unixTime) {
    const now = new Date();
    const targetDate = new Date(unixTime * 1000);
    const difference = targetDate - now;

    if (difference <= 0) {
      return "The target time has already passed.";
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    return `${days > 0 ? days + " d" : ""}${hours > 0 ? hours + " h" : ""} ${
      days < 1 && minutes > 0 ? minutes + " m" : ""
    }`;
  }

  return (
    <OperationRow
      className="operation-row"
      isOptimistic={isOptimistic}
      onClick={() => {
        const newOperation = {
          ...operation,
          extra: {}
        }
        onOperationClick(newOperation, account, parentAccount);
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
      <div style={{ width: "120px", paddingRight: "4px", paddingLeft: "4px" }}>
        {operation.extra.isClaiming && (
          <Box horizontal={true}>
            {new Date(operation.extra.unixTime * 1000) > new Date() ? (
              <Box horizontal={true}>
                <div
                  style={{
                    fontSize: "12px",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    marginRight: "8px",
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    style={{ marginRight: "4px" }}
                  >
                    <path
                      d="M6 0C2.69 0 0 2.69 0 6C0 9.31 2.69 12 6 12C9.31 12 12 9.31 12 6C12 2.69 9.31 0 6 0ZM6 11C3.24 11 1 8.76 1 6C1 3.24 3.24 1 6 1C8.76 1 11 3.24 11 6C11 8.76 8.76 11 6 11Z"
                      fill="#999999"
                    />
                    <path
                      d="M6 2C5.45 2 5 2.45 5 3V6.5C5 6.78 5.22 7 5.5 7C5.78 7 6 6.78 6 6.5V3C6 2.45 5.55 2 5 2Z"
                      fill="#999999"
                    />
                    <path
                      d="M6 10C5.45 10 5 10.45 5 11C5 11.55 5.45 12 6 12C6.55 12 7 11.55 7 11C7 10.45 6.55 10 6 10Z"
                      fill="#999999"
                    />
                  </svg>
                  {
                    <span style={{ color: "#999999" }}>
                      {getTimeRemaining(operation.extra.unixTime)}
                    </span>
                  }
                </div>
                <Box gap={"2px"} horizontal={true}>
                  <Button small primary onClick={onClaim}>
                    Claim
                  </Button>
                  <Button small inverted onClick={onReject}>
                    Reject
                  </Button>
                </Box>
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
