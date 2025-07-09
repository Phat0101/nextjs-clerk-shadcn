import { anthropic } from '@ai-sdk/anthropic';
import { streamText, tool } from "ai";
import { fetchAction, fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { z } from "zod";
import { Id } from "@/convex/_generated/dataModel";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const runtime = "nodejs";

// Helper to sanitize message for Convex storage
function sanitizeMessage(message: any): any {
  if (!message) return message;
  return JSON.parse(JSON.stringify(message, (key, value) => {
    if (value instanceof URL) return value.toString();
    if (typeof value === 'function' || typeof value === 'symbol') return undefined;
    return value;
  }));
}

// Save a chat message to Convex
async function saveMessage(jobId: string, message: any) {
  try {
    const sanitized = sanitizeMessage(message);
    await fetchMutation(api.chat.addMessage, { jobId: jobId as Id<'jobs'>, message: sanitized });
  } catch (e) {
    console.error('persist chat message failed', e);
  }
}

export async function POST(req: Request) {
  const { clientName = "", fileUrls = [], messages = [], jobId } = await req.json() as { clientName?: string; fileUrls: string[]; messages?: any[]; jobId?: string };
  if (!Array.isArray(fileUrls) || fileUrls.length === 0) {
    return new Response("fileUrls array is required", { status: 400 });
  }
  // Persist latest user message if present
  if (jobId && messages && messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'user') {
      await saveMessage(jobId, lastMessage);
    }
  }

  // Helper to detect images
  const isImageUrl = (u: string) => /\.(jpg|jpeg|png|gif|bmp|webp)(\?|$)/i.test(u);

  // Build multimodal parts for the initial user message
  const fileParts: Array<Record<string, unknown>> = fileUrls.map((u: string, idx: number) => {
    if (isImageUrl(u)) {
      return { type: "image", image: new URL(u) } as const;
    }
    return {
      type: "file",
      data: new URL(u),
      mimeType: "application/pdf",
      filename: `invoice-${idx + 1}.pdf`,
    } as const;
  });

  console.log("Agent invoice route called");

  // -----------------------------
  // TOOL DEFINITIONS
  // -----------------------------

  // 1) Match stored template via Convex vector DB
  const matchTemplate = tool({
    description:
      "Match the supplier & client invoice template from the vector DB. Return an array sorted by score descending.",
    parameters: z.object({
      supplier: z.string().min(1),
      clientName: z.string().optional(),
    }),
    execute: async ({ supplier, clientName }: { supplier: string; clientName?: string }) => {
      console.log("matchTemplate called", { supplier, clientName });
      const templates = await fetchAction((api as any).templates.matchTemplate, {
        supplier,
        clientName,
      });
      return templates;
    },
  });

  // 2) Extract invoice data with a selected template
  const extractInvoice = tool({
    description:
      "Extract invoice data using the provided headerFields and lineItemFields arrays.",
    parameters: z.object({
      headerFields: z.array(z.any()),
      lineItemFields: z.array(z.any()),
    }),
    execute: async ({ headerFields, lineItemFields }: { headerFields: unknown[]; lineItemFields: unknown[] }) => {
      console.log("extractInvoice called", { headerFields, lineItemFields });
      const resp = await fetch(new URL("/api/extract/invoice", req.url).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrls, headerFields, lineItemFields }),
      });
      if (!resp.ok) {
        throw new Error("/api/extract/invoice failed");
      }
      const json = await resp.json();
      return json;
    },
  });

  // 3) Analyze invoice to suggest fields when no template found
  const analyzeInvoice = tool({
    description: "Analyze invoice documents and suggest fields when no template match is found.",
    parameters: z.object({}),
    execute: async () => {
      console.log("suggestFields called");
      const resp = await fetch(new URL("/api/analyze-invoice", req.url).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrls }),
      });
      if (!resp.ok) throw new Error("/api/analyze-invoice failed");
      const json = await resp.json();
      return json;
    },
  });

  // -----------------------------
  // STREAMING AGENT
  // -----------------------------

  const systemPrompt = `You are an intelligent invoice extraction orchestrator.
Client name (if relevant): ${clientName || 'N/A'}

Workflow:
1. Inspect the invoice documents to identify the supplier/company name (exact header text).
2. Call \`matchTemplate\` with that supplier (and clientName when provided).
3. If the top template score is >= 0.95:
   • Call \`extractInvoice\` with its headerFields and lineItemFields.
   • After extraction, summarise completion.
4. Else:
   • Call \`analyzeInvoice\` to obtain suggested headerFields & lineItemFields.
   • Present suggestions to user for confirmation.

Never invent template structures – only rely on tool results.`;

  const seedMessage = [
    {
      role: "user" as const,
      content: [
        { type: "text", text: `Attached ${fileUrls.length} invoice document(s).` },
        ...fileParts,
      ],
    },
  ] as const;

  // -----------------------------
  // SANITISE UI MESSAGES → CoreMessage format
  // -----------------------------

  const cleanedMessages = (messages as any[]).map((uiMsg) => {
    const role = uiMsg.role;

    // Helper: convert toolInvocations → tool-result parts
    const toolResultParts = Array.isArray(uiMsg.toolInvocations)
      ? uiMsg.toolInvocations
          .filter((ti: any) => ti.state === 'result' && ti.toolCallId && ti.toolName)
          .map((ti: any) => ({
            type: 'tool-result',
            toolCallId: ti.toolCallId,
            toolName: ti.toolName,
            result: ti.result,
          }))
      : [];

    // Build parts array from uiMsg.parts, filtering allowed types
    const allowedTypes = new Set(['text', 'image', 'file', 'tool-call', 'tool-result']);
    const sourceParts: any[] = Array.isArray(uiMsg.parts) ? uiMsg.parts : [];
    const filteredParts = sourceParts.filter((p) => allowedTypes.has(p.type));

    const finalParts = [...filteredParts, ...toolResultParts];

    if (finalParts.length === 0) {
      // Fallback to simple string content
      return {
        role,
        content: typeof uiMsg.content === 'string' ? uiMsg.content : '',
      } as const;
    }

    return {
      role,
      content: finalParts,
    } as const;
  });

  const combinedMessages: any = [...cleanedMessages, ...seedMessage];

  const result = streamText({
    model: anthropic('claude-4-sonnet-20250514'),
    // providerOptions: {
    //   anthropic: {
    //     thinking: { type: 'enabled', budget_tokens: 100000 }
    //   }
    // },
    system: systemPrompt,
    messages: combinedMessages,
    temperature: 0,
    maxSteps: 8,
    toolChoice: 'auto',
    toolCallStreaming: true,
    tools: {
      matchTemplate,
      extractInvoice,
      analyzeInvoice,
    },
    onFinish: async ({ response }) => {
      try {
        if (jobId) {
          for (const coreMessage of response.messages) {
            if (coreMessage.role === 'assistant') {
              let uiMessage: any;
              if (typeof coreMessage.content === 'string') {
                uiMessage = {
                  id: coreMessage.id || `msg-${Date.now()}`,
                  role: 'assistant',
                  content: coreMessage.content,
                  createdAt: new Date().toISOString(),
                };
              } else if (Array.isArray(coreMessage.content)) {
                uiMessage = {
                  id: coreMessage.id || `msg-${Date.now()}`,
                  role: 'assistant',
                  parts: coreMessage.content,
                  createdAt: new Date().toISOString(),
                };
              }
              if (uiMessage) {
                await saveMessage(jobId, uiMessage);
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed to persist assistant message onFinish', e);
      }
    },
  });

  return result.toDataStreamResponse({ sendReasoning: true });
}