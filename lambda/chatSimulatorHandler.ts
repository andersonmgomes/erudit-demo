import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import * as AWS from "aws-sdk";

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.TABLE_NAME;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const data = JSON.parse(event.body || "{}");

    // Replace these with the actual data fields you need
    const pk = data.pk;
    const sk = data.sk;

    const params: AWS.DynamoDB.DocumentClient.PutItemInput = {
      TableName: tableName as string,
      Item: {
        PK: pk,
        SK: sk,
      },
    };

    await dynamoDb.put(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Item added successfully" }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "An error occurred while adding the item" }),
    };
  }
}
