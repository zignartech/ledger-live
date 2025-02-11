import React, { PureComponent } from "react";
import styled from "styled-components";
import { Account } from "@ledgerhq/types-live";
import { getEnv } from "@ledgerhq/live-common/env";
import { darken } from "~/renderer/styles/helpers";
import Box, { Tabbable } from "~/renderer/components/Box";
import CheckBox from "~/renderer/components/CheckBox";
import CryptoCurrencyIconWithCount from "~/renderer/components/CryptoCurrencyIconWithCount";
import FormattedVal from "~/renderer/components/FormattedVal";
import Input from "~/renderer/components/Input";
import AccountTagDerivationMode from "../AccountTagDerivationMode";
const InputWrapper = styled.div`
  margin-left: 4px;
  width: 100%;
`;
type Props = {
  account: Account;
  isChecked?: boolean;
  isDisabled?: boolean;
  isReadonly?: boolean;
  autoFocusInput?: boolean;
  accountName: string;
  onToggleAccount?: (b: Account, a: boolean) => void;
  onEditName?: (b: Account, a: string) => void;
  hideAmount?: boolean;
};
export default class AccountRow extends PureComponent<Props> {
  handlePreventSubmit = (e: SyntheticEvent<any>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  handleKeyPress = (e: SyntheticEvent<HTMLInputElement>) => {
    // this fixes a bug with the event propagating to the Tabbable
    e.stopPropagation();
  };

  onToggleAccount = () => {
    const { onToggleAccount, account, isChecked } = this.props;
    if (onToggleAccount) onToggleAccount(account, !isChecked);
  };

  handleChangeName = (name: string) => {
    const { onEditName, account } = this.props;
    if (onEditName) onEditName(account, name);
  };

  onClickInput = (e: SyntheticEvent<any>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  onFocus = (e: any) => {
    e.target.select();
  };

  onBlur = (e: any) => {
    const { onEditName, account } = this.props;
    const { value } = e.target;
    if (!value && onEditName) {
      // don't leave an empty input on blur
      onEditName(account, account.name);
    }
  };

  _input = null;
  overflowStyles = {
    textOverflow: "ellipsis",
    overflow: "hidden",
    whiteSpace: "nowrap",
  };

  render() {
    const {
      account,
      isChecked,
      onEditName,
      accountName,
      isDisabled,
      isReadonly,
      autoFocusInput,
      hideAmount,
    } = this.props;
    const tokenCount = (account.subAccounts && account.subAccounts.length) || 0;
    const tag = <AccountTagDerivationMode account={account} />;
    return (
      <AccountRowContainer
        className="account-row"
        isDisabled={isDisabled}
        onClick={isDisabled ? null : this.onToggleAccount}
      >
        <CryptoCurrencyIconWithCount currency={account.currency} count={tokenCount} withTooltip />
        <Box
          shrink
          grow
          ff="Inter|SemiBold"
          color="palette.text.shade100"
          horizontal
          alignItems="center"
          fontSize={4}
        >
          {onEditName ? (
            <InputWrapper>
              <Input
                style={this.overflowStyles}
                value={accountName}
                onChange={this.handleChangeName}
                onClick={this.onClickInput}
                onEnter={this.handlePreventSubmit}
                onFocus={this.onFocus}
                onBlur={this.onBlur}
                onKeyPress={this.handleKeyPress}
                maxLength={getEnv("MAX_ACCOUNT_NAME_SIZE")}
                editInPlace
                autoFocus={autoFocusInput}
                renderRight={tag}
              />
            </InputWrapper>
          ) : (
            <div
              style={{
                ...this.overflowStyles,
                paddingLeft: 15,
                marginLeft: 4,
                width: "100%",
              }}
            >
              {accountName}
              {tag}
            </div>
          )}
        </Box>
        {!hideAmount ? (
          <FormattedVal
            val={account.balance}
            unit={account.unit}
            style={{
              textAlign: "right",
              width: "auto",
              minWidth: 120,
            }}
            showCode
            fontSize={4}
            color="palette.text.shade60"
          />
        ) : null}
        {!isDisabled && !isReadonly && <CheckBox disabled isChecked={isChecked || !!isDisabled} />}
      </AccountRowContainer>
    );
  }
}
const AccountRowContainer: ThemedComponent<{
  isDisabled?: boolean;
}> = styled(Tabbable).attrs(() => ({
  horizontal: true,
  alignItems: "center",
  bg: "palette.background.default",
  px: 3,
  flow: 1,
}))`
  height: 48px;
  border-radius: 4px;

  opacity: ${p => (p.isDisabled ? 0.5 : 1)};
  pointer-events: ${p => (p.isDisabled ? "none" : "auto")};

  &:hover {
    background-color: ${p => darken(p.theme.colors.palette.background.default, 0.015)};
  }

  &:active {
    background-color: ${p => darken(p.theme.colors.palette.background.default, 0.03)};
  }
`;
