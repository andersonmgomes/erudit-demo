import * as cdk from "@aws-cdk/core";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import * as lambda from "@aws-cdk/aws-lambda";
import * as nodejs from "@aws-cdk/aws-lambda-nodejs";
import * as events from "@aws-cdk/aws-events";
import * as targets from "@aws-cdk/aws-events-targets";
import * as sqs from "@aws-cdk/aws-sqs";
import * as lambdaEventSources from "@aws-cdk/aws-lambda-event-sources";
import { TableViewer } from 'cdk-dynamo-table-viewer'


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
        name: "order",
        type: dynamodb.AttributeType.NUMBER,
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
        type: dynamodb.AttributeType.NUMBER,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Create an SQS queue
    const chatSimulatorQueue = new sqs.Queue(this, "ChatSimulatorQueue", {
      visibilityTimeout: cdk.Duration.minutes(10),
    });

    // Create a Lambda function to insert records into the DynamoDB table
    const chatSimulatorFunction = new nodejs.NodejsFunction(this, "ChatSimulatorFunction", {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "handler",
      entry: "lambda/chatSimulatorHandler.ts", 
      environment: {
        TABLE_NAME: singleTable.tableName,
        QUEUE_URL: chatSimulatorQueue.queueUrl,
      },
      timeout: cdk.Duration.minutes(5),
    });

    // Create a Lambda function to consume messages from the SQS queue
    const chatQueueClassifierFunction = new nodejs.NodejsFunction(this, "chatQueueClassifierFunction", {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "handler",
      entry: "lambda/chatQueueClassifierHandler.ts", 
      environment: {
        TABLE_NAME: singleTable.tableName,
      },
      timeout: cdk.Duration.minutes(5),
    });

    // Grant the Lambda function permissions to put items in the DynamoDB table
    singleTable.grantWriteData(chatQueueClassifierFunction);

    // Add the SQS queue as an event source to the Lambda function
    chatQueueClassifierFunction.addEventSource(new lambdaEventSources.SqsEventSource(chatSimulatorQueue, {
      batchSize: 1, 
    }));

    // Grant the Lambda function permissions to put items in the DynamoDB table
    singleTable.grantWriteData(chatSimulatorFunction);

    // Grant the Lambda function permissions to send messages to the SQS queue
    chatSimulatorQueue.grantSendMessages(chatSimulatorFunction);    

    // Create an EventBridge rule to trigger the Lambda function every hour
    const hourlyRule = new events.Rule(this, "HourlyRule", {
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
    });

    // Add the Lambda function as a target of the EventBridge rule
    hourlyRule.addTarget(new targets.LambdaFunction(chatSimulatorFunction));    

    // Create a TableViewer object to visualize the DynamoDB table content
    const tableViewer = new TableViewer(this, "ChatMessagesViewer", {
      table: singleTable,
      title: "Chat Messages", 
      sortBy: "-PK, order",       // ("-" denotes descending order)
    });

    // Export the TableViewer endpoint as a stack output
    new cdk.CfnOutput(this, "TableViewerEndpoint", {
      value: tableViewer.endpoint,
      description: "TableViewer endpoint URL",
    });

  }
 
}
