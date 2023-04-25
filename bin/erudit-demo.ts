#!/usr/bin/env node
import * as cdk from "@aws-cdk/core";
import { EruditDemoStack } from '../lib/erudit-demo-stack';

const app = new cdk.App();
new EruditDemoStack(app, 'EruditDemoStack');
