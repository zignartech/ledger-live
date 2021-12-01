import React from "react";
import Alert, { AlertProps } from "./index";
import Link from "../../cta/Link";
import Text from "../../asorted/Text";
import { Icons } from "../../../../src/assets";
export default {
  title: "Messages/Alerts",
  component: Alert,
  argTypes: {
    type: {
      options: ["info", "warning", "error"],
      control: {
        type: "radio",
      },
    },
    title: {
      control: {
        type: "text",
      },
      defaultValue: "Title",
    },
    showIcon: {
      control: {
        type: "boolean",
      },
      defaultValue: true,
    },
  },
};

export const Default = (args: AlertProps): JSX.Element => {
  return <Alert {...args} />;
};

export const WithContent = (args: AlertProps) => {
  return (
    <Alert
      {...args}
      renderContent={({ color, textProps }) => (
        <>
          <Text color="inherit" {...textProps}>
            Your xpub is privacy-sensitive data. Use with caution, especially when disclosing to
            third parties.
          </Text>
          <Link
            color={color}
            textProps={textProps}
            alwaysUnderline
            size="small"
            Icon={Icons.ExternalLinkMedium}
          >
            And a learn more link
          </Link>
        </>
      )}
    />
  );
};
