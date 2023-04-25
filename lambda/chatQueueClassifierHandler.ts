import { SQSEvent } from "aws-lambda";
import * as AWS from "aws-sdk";
import DocGptChat, { GptChatOptions } from '@doc-gpt/chat';

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.TABLE_NAME || "";
const openaiApiKey  = process.env.OPENAI_API_KEY  || "";

interface QueueMessage {
  PK: string;
  order: number;
  author: string;
  message: string;
}

//setting options using GptChatOptions interface
const options: GptChatOptions = {
    temperature: 1,
    top_p: 1,
    n: 1,
    max_tokens: 1000,
  };
  
  const gpt = new DocGptChat({
    apiKey: openaiApiKey, 
  });

async function getSentimentAnalysis(text: string): Promise<string> {
    const prompt = `Analyze the sentiment of the following text: "${text}". 
    Is it positive, negative, or neutral? 
    Answer only with "positive", "negative", or "neutral".`;
  
    console.log("Prompt:", prompt);
  
    // Get a full response from the api
    const response = await (await gpt.SimpleChat([
        {
            role: 'user',
            content: prompt,
        },
    ], options)).toLowerCase();

    // print response in console
    console.log('model response:', response);

    // testing if "positive" is in the response
    if (response.includes("positive")) {
        return "positive";
    }
    // testing if "negative" is in the response
    if (response.includes("negative")) {
        return "negative";
    }
    // else:   
    return  "neutral";
  }
  

async function processMessage(message: QueueMessage) {
  // Get sentiment analysis for the message
  const sentiment_analysis = await getSentimentAnalysis(message.message);    
  const params: AWS.DynamoDB.DocumentClient.PutItemInput = {
    TableName: tableName,
    Item: {
      PK: message.PK,
      order: message.order,
      author: message.author,
      message: message.message,
      sentiment_analysis
    },
  };

  await dynamoDb.put(params).promise();
}

export async function handler(event: SQSEvent): Promise<void> {
  try {
    for (const record of event.Records) {
      const message: QueueMessage = JSON.parse(record.body);
      console.log("Processing message:", message);
      await processMessage(message);
    }
  } catch (error) {
    console.error("An error occurred while processing the messages:", error);
    throw error;
  }
}
