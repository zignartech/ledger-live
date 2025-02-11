import React, { useContext, useCallback } from "react";
import { Trans } from "react-i18next";
import { urls } from "~/config/urls";
import { openURL } from "~/renderer/linking";
import IconUpdate from "~/renderer/icons/Update";
import IconDonjon from "~/renderer/icons/Donjon";
import IconWarning from "~/renderer/icons/TriangleWarning";
import Spinner from "~/renderer/components/Spinner";
import TopBanner, { FakeLink, Content } from "~/renderer/components/TopBanner";
import { UpdaterContext } from "./UpdaterContext";
import { shouldUpdateYet } from "~/helpers/user";
import { useRemoteConfig } from "~/renderer/components/RemoteConfig";
export const VISIBLE_STATUS = [
  "download-progress",
  "checking",
  "check-success",
  "error",
  "update-available",
  "downloading-update",
];
const CONTENT_BY_STATUS = (
  quitAndInstall,
  reDownload,
  progress,
  downloadUpdate,
  version,
): {
  [x: string]: Content;
} => ({
  "download-progress": {
    Icon: Spinner,
    message: <Trans i18nKey="update.downloadInProgress" />,
    right: (
      <Trans
        i18nKey="update.downloadProgress"
        values={{
          progress,
        }}
      />
    ),
  },
  checking: {
    Icon: IconDonjon,
    message: <Trans i18nKey="update.checking" />,
  },
  "check-success": {
    Icon: IconUpdate,
    message: <Trans i18nKey="update.checkSuccess" />,
    right: (
      <FakeLink onClick={quitAndInstall}>
        <Trans i18nKey="update.quitAndInstall" />
      </FakeLink>
    ),
  },
  "downloading-update": {
    Icon: IconUpdate,
    message: <Trans i18nKey="update.downloadInProgress" />,
  },
  "update-available": {
    Icon: IconUpdate,
    message: (
      <Trans
        i18nKey="update.updateAvailable"
        values={{
          version,
        }}
      />
    ),
    right: (
      <FakeLink onClick={downloadUpdate}>
        <Trans i18nKey="update.downloadNow" />
      </FakeLink>
    ),
  },
  error: {
    Icon: IconWarning,
    message: <Trans i18nKey="update.error" />,
    right: (
      <FakeLink onClick={reDownload}>
        <Trans i18nKey="update.reDownload" />
      </FakeLink>
    ),
  },
});
const UpdaterTopBanner = () => {
  const context = useContext(UpdaterContext);
  const remoteConfig = useRemoteConfig();
  const reDownload = useCallback(() => {
    openURL(urls.liveHome);
  }, []);
  if (
    context &&
    remoteConfig.lastUpdatedAt &&
    context.version &&
    shouldUpdateYet(context.version, remoteConfig)
  ) {
    const { status, quitAndInstall, downloadProgress, version, downloadUpdate } = context;
    if (!VISIBLE_STATUS.includes(status)) return null;
    const content: Content | undefined | null = CONTENT_BY_STATUS(
      quitAndInstall,
      reDownload,
      downloadProgress,
      downloadUpdate,
      version,
    )[status];
    if (!content) return null;
    return (
      <TopBanner
        testId="layout-app-update-banner"
        content={content}
        status={status === "error" ? "alertRed" : "warning"}
      />
    );
  }
  return null;
};
export default UpdaterTopBanner;
