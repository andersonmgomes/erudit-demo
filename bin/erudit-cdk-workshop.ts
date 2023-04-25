#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { EruditCdkWorkshopStack } from '../lib/erudit-cdk-workshop-stack';

const app = new cdk.App();
new EruditCdkWorkshopStack(app, 'EruditCdkWorkshopStack');
