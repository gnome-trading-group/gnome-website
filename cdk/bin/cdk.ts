#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { GnomeAccount } from '@gnome-trading-group/gnome-shared-cdk';
import { WebsitePipelineStack } from '../lib/website-pipeline-stack';

const app = new cdk.App();
new WebsitePipelineStack(app, 'WebsitePipelineStack', {
  env: GnomeAccount.InfraPipelines.environment,
});
app.synth();
