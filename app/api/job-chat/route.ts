import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

export const maxDuration = 30;

// Helper to decide if URL is image
const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|bmp|webp)(\?|$)/i.test(url);

export async function POST(req: Request) {
  const { messages: clientMessages, fileUrls = [] } = await req.json();

  console.log(clientMessages);
  // Build a synthetic first user message that includes provided files
  const fileParts: Array<Record<string, unknown>> = [];
  fileUrls.forEach((url: string, idx: number) => {
    if (isImageUrl(url)) {
      fileParts.push({ type: 'image', image: new URL(url) });
    } else {
      fileParts.push({ type: 'file', data: new URL(url), mimeType: 'application/pdf', filename: `document-${idx + 1}` });
    }
  });

  const seedMessage = fileParts.length
    ? [{ role: 'user', content: [ { type: 'text', text: `Here are ${fileParts.length} document(s) I'm working on.` }, ...fileParts ] }]
    : [];

  const messages = [...seedMessage, ...clientMessages];

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: 'You are a helpful assistant for invoice extraction workflow. When relevant, reference the provided documents to answer questions or guide the user.',
    messages,
    temperature: 0.5,
  });

  console.log(result.toDataStreamResponse());

  return result.toDataStreamResponse();
} 