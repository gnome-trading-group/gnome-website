import { GnomeAccount, Stage } from "@gnome-trading-group/gnome-shared-cdk";

export interface ControllerConfig {
  account: GnomeAccount;
  domainName: string;
  subdomain: string | undefined;
  certificateArn: string;
}

export const CONFIGS: { [stage in Stage]?:  ControllerConfig } = {
  [Stage.PROD]: {
    account: GnomeAccount.InfraProd,
    domainName: "gnometrading.group",
    subdomain: undefined,
    certificateArn: "arn:aws:acm:us-east-1:241533121172:certificate/ba76675f-9841-4008-96d0-357bcb06086c",
  },
}

export const GITHUB_REPO = "gnome-trading-group/gnome-website";
export const GITHUB_BRANCH = "main";
