import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import * as AWS from "aws-sdk";
import DocGptChat from '@doc-gpt/chat';

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.TABLE_NAME;
const openaiApiKey  = process.env.OPENAI_API_KEY as string;

const prompt = `Three employees from an IT company are chatting about a technical issue. 
The tech stack is TypeScript, SOA, Hexagonal Architecture (Ports and Adapters), DynamoDB w/ Single Table Design, TRPC,
AWS CDK, Docker, React, Redux, React-Query, Jotai, Zustand.
Employee 1, Employee 2, and Employee 3 are discussing the problem.
Employee 2 has a high level of stress and burnout.
Employee 1 is collaborative and is trying to help Employee 2.
Employee 3 is highly competitive and selfish.
Give me a new discuss round of the employees about some problem using the related tech stack.`;

const gpt = new DocGptChat({
  apiKey: openaiApiKey, 
  defaultSystemMessage: prompt,
});

async function simulateChat(): Promise<string[]> {
  console.log("Prompt:", prompt);
  
  // Get a full response from the api
  const message = await gpt.SimpleChat([
    {
      role: 'user',
      content: prompt,
    },
  ]);

  // print response in console
  console.log('message:', message);

  return [message];
}


async function saveMessage(message: string, timestamp: number) {
  const params: AWS.DynamoDB.DocumentClient.PutItemInput = {
    TableName: tableName as string,
    Item: {
      PK: `Chat#${timestamp}`,
      SK: `Message#${timestamp}`,
      message: message,
    },
  };

  await dynamoDb.put(params).promise();
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const chatMessages = await simulateChat();

    for (const message of chatMessages) {
      const timestamp = Date.now();
      await saveMessage(message, timestamp);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Chat simulation and saving completed successfully" }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "An error occurred while simulating the chat and saving messages" }),
    };
  }
}
