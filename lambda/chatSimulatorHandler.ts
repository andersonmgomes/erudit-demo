import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import * as AWS from "aws-sdk";
import DocGptChat, { GptChatOptions } from '@doc-gpt/chat';

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.TABLE_NAME || "";
const openaiApiKey  = process.env.OPENAI_API_KEY  || "";
const queueUrl = process.env.QUEUE_URL || "";

const prompt = `Three employees from an IT company are chatting about some technical issue in their commom project. 
The tech stack is TypeScript, SOA, Hexagonal Architecture (Ports and Adapters), DynamoDB w/ Single Table Design, TRPC,
AWS CDK, Docker, React, Redux, React-Query, Jotai, Zustand.
Employee 1, Employee 2, and Employee 3 are discussing the issue.
Employee 2 has a high level of stress and burnout.
Employee 1 is collaborative and is trying to help everyone.
Employee 3 is highly competitive and selfish.
Give me a new discuss round of the employees about some random problem using the related tech stack.
The discussion must always start with a concrete issue on the system.
Your answer must ALWAYS follow a typescript JSON format using the '#' char as separator in this way:
{"person": "<<person's name>>", "text": "<<dialog text>>"}#{"person": "<<person's name>>", "text": "<<dialog text>>"}#...{"person": "<<person's name>>", "text": "<<dialog text>>"}`;

//setting options using GptChatOptions interface
const options: GptChatOptions = {
  temperature: 1,
  top_p: 1,
  n: 1,
  max_tokens: 1000,
};

const gpt = new DocGptChat({
  apiKey: openaiApiKey, 
  defaultSystemMessage: prompt,
});

// Define a TypeScript interface to represent the expected JSON Message structure
interface Message {
  person: string;
  text: string;
}


// Function to extract individual JSON strings from the plain string
function extractJsonStrings(plain: string): string[] {
  return plain.split("#");
}


// Function to convert JSON string to a JavaScript object
function parseJsonToObject(json: string): Message | null {
  console.log("Parsing JSON string:", json);
  try {
    const parsedObject: Message = JSON.parse(json);
    return parsedObject;
  } catch (error) {
    console.error("Failed to parse JSON string:", error);
    return null;
  }
}

async function simulateChat(): Promise<Message[]> {
  console.log("Prompt:", prompt);
  
  // Get a full response from the api
  const response = await gpt.SimpleChat([
    {
      role: 'user',
      content: prompt,
    },
  ], options);

  // print response in console
  console.log('model response:', response);

  // Extract individual JSON strings from the plain string
  const jsonStrings: string[] = extractJsonStrings(response);

  // Convert JSON strings to JavaScript objects
  const messageObjects: (Message | null)[] = jsonStrings.map(parseJsonToObject);

  console.log("Converted JSON strings to objects:", messageObjects);

  return messageObjects.filter((messageObject): messageObject is Message => messageObject !== null);

}

const sqs = new AWS.SQS();

async function saveMessage(author: string, message: string, timestamp: number, order: number) {
  const params: AWS.DynamoDB.DocumentClient.PutItemInput = {
    TableName: tableName as string,
    Item: {
      PK: `Chat#${timestamp}`,
      order: order,
      author: author,
      message: message,
    },
  };

  await dynamoDb.put(params).promise();

  // Send a message to the SQS queue with the saved item object
  const sqsParams: AWS.SQS.SendMessageRequest = {
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify({
      PK: `Chat#${timestamp}`,
      order: order,
      author: author,
      message: message,
    }),
  };

  await sqs.sendMessage(sqsParams).promise();  
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const chatMessages = await simulateChat();

    const timestamp = Date.now();
    // initialize a order variable to save the order of the messages
    let order = 0;
    for (const message of chatMessages) {
      await saveMessage(message.person, message.text, timestamp, order++);
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
