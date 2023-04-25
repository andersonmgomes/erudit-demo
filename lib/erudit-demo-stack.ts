import * as cdk from "@aws-cdk/core";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import * as lambda from "@aws-cdk/aws-lambda";
import * as nodejs from "@aws-cdk/aws-lambda-nodejs";

export class EruditDemoStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a DynamoDB table with a single GSI for single table design
    const singleTable = new dynamodb.Table(this, "SingleTable", {
      partitionKey: {
        name: "PK",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "SK",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Not recommended for production
    });

    // Add a Global Secondary Index (GSI)
    singleTable.addGlobalSecondaryIndex({
      indexName: "GSI",
      partitionKey: {
        name: "GSI1PK",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "GSI1SK",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Create a Lambda function to insert records into the DynamoDB table
    const chatSimulatorFunction = new nodejs.NodejsFunction(this, "ChatSimulatorFunction", {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "handler",
      entry: "lambda/chatSimulatorHandler.ts", // Path relative to the root directory of the CDK app
      environment: {
        TABLE_NAME: singleTable.tableName,
      },
    });

    // Grant the Lambda function permissions to put items in the DynamoDB table
    singleTable.grantWriteData(chatSimulatorFunction);

  }
  
}
