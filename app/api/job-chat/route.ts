/* eslint-disable @typescript-eslint/no-explicit-any */
import { streamText, tool } from 'ai';
import { fetchMutation, fetchAction } from 'convex/nextjs';
import { api as convexApi } from '@/convex/_generated/api';
import { google } from '@ai-sdk/google';
// import { anthropic } from '@ai-sdk/anthropic';
import { Id } from '@/convex/_generated/dataModel';
import {
  TRANSPORT_ENUM,
  CONTAINER_ENUM,
  TYPE_ENUM,
  WEIGHT_UNIT_ENUM,
  VOLUME_UNIT_ENUM,
  PACKAGES_ENUM,
  CURRENCY_ENUM,
  INCOTERM_ENUM,
  SPOT_RATE_TYPE_ENUM,
  SERVICE_LEVEL_ENUM,
  RELEASE_TYPE_ENUM,
  CHARGES_APPLY_ENUM,
  PHASE_ENUM,
} from '@/lib/shipmentSchema';
import { z } from 'zod';

// (Removed delay helper – no longer needed after refactor)

export const maxDuration = 30;

// ---------------------------------------------------------------------------
//  Flattened shipment schema – every field is a single top-level parameter so
//  the language model doesn't have to build nested objects.
// ---------------------------------------------------------------------------

const flatShipmentSchema = z.object({
  // Mode
  transport: z.enum(TRANSPORT_ENUM),
  container: z.enum(CONTAINER_ENUM),
  type: z.enum(TYPE_ENUM),

  // Consignor
  consignor_company: z.string().nullable().optional(),
  consignor_address: z.string().nullable().optional(),
  consignor_city_state: z.string().nullable().optional(),
  consignor_country: z.string().nullable().optional(),

  // Consignee
  consignee_company: z.string().nullable().optional(),
  consignee_address: z.string().nullable().optional(),
  consignee_city_state: z.string().nullable().optional(),
  consignee_country: z.string().nullable().optional(),

  // Details – identifiers & routing
  details_house_bill: z.string().nullable().optional(),
  details_domestic: z.boolean().nullable().optional(),
  details_origin: z.string().nullable().optional(),
  details_destination: z.string().nullable().optional(),
  details_etd: z.string().nullable().optional(),
  details_eta: z.string().nullable().optional(),

  // Details – weights / volumes
  details_weight_value: z.number().nullable().optional(),
  details_weight_unit: z.enum(WEIGHT_UNIT_ENUM).nullable().optional(),
  details_volume_value: z.number().nullable().optional(),
  details_volume_unit: z.enum(VOLUME_UNIT_ENUM).nullable().optional(),
  details_chargeable_value: z.number().nullable().optional(),
  details_chargeable_unit: z.enum(VOLUME_UNIT_ENUM).nullable().optional(),

  // Details – packages
  details_packages_count: z.number().nullable().optional(),
  details_packages_type: z.enum(PACKAGES_ENUM).nullable().optional(),
  details_wv_ratio: z.number().nullable().optional(),
  details_inners_count: z.number().nullable().optional(),
  details_inners_type: z.enum(PACKAGES_ENUM).nullable().optional(),

  // Details – values & description
  details_goods_value_amount: z.number().nullable().optional(),
  details_goods_value_currency: z.enum(CURRENCY_ENUM).nullable().optional(),
  details_insurance_value_amount: z.number().nullable().optional(),
  details_insurance_value_currency: z.enum(CURRENCY_ENUM).nullable().optional(),
  details_description: z.string().nullable().optional().describe('Summary description of the goods'),
  details_marks_numbers: z.string().nullable().optional(),

  // Details – commercial terms
  details_incoterm: z.enum(INCOTERM_ENUM).nullable().optional(),
  details_free_on_board: z.boolean().nullable().optional(),
  details_spot_rate: z.number().nullable().optional(),
  details_spot_rate_type: z.enum(SPOT_RATE_TYPE_ENUM).nullable().optional(),
  details_use_standard_rate: z.boolean().nullable().optional(),
  details_service_level: z.enum(SERVICE_LEVEL_ENUM).nullable().optional(),
  details_release_type: z.enum(RELEASE_TYPE_ENUM).nullable().optional(),
  details_charges_apply: z.enum(CHARGES_APPLY_ENUM).nullable().optional(),
  details_phase: z.enum(PHASE_ENUM).nullable().optional(),
  details_order_refs: z.string().nullable().optional(),

  // Customs fields
  customs_aqis_status: z.string().nullable().optional(),
  customs_customs_status: z.string().nullable().optional(),
  customs_subject_to_aqis: z.boolean().nullable().optional(),
  customs_subject_to_jfis: z.boolean().nullable().optional(),
});

// Helper to decide if URL is image
const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|bmp|webp)(\?|$)/i.test(url);

// Helper to sanitize message for Convex storage
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeMessage(message: any): any {
  if (!message) return message;
  
  // Create a deep copy and clean it
  const sanitized = JSON.parse(JSON.stringify(message, (key, value) => {
    // Convert URL objects to strings
    if (value instanceof URL) {
      return value.toString();
    }
    // Remove functions and other non-serializable types
    if (typeof value === 'function' || typeof value === 'symbol') {
      return undefined;
    }
    return value;
  }));
  
  return sanitized;
}

// Simple helper to persist a chat message
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveMessage(jobId: string, message: any) {
  try {
    const sanitizedMessage = sanitizeMessage(message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchMutation((convexApi as any).chat.addMessage, { jobId: jobId as Id<'jobs'>, message: sanitizedMessage });
  } catch (e) {
    console.error('persist chat message failed', e);
  }
}

export async function POST(req: Request) {
  const { jobId, messages: clientMessages, fileUrls = [] } = await req.json();

  if (!jobId) {
    return new Response('jobId is required', { status: 400 });
  }

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
    ? [{ role: 'user', content: [{ type: 'text', text: `Please extract shipment data from these ${fileParts.length} document(s). Use the extract_shipment tool ONCE to structure all the data, then provide a summary. Do not call the tool multiple times.` }, ...fileParts] }]
    : [];

  const messages = [...seedMessage, ...clientMessages];

  // Save the latest user message if it exists (it should be in UI format already)
  if (clientMessages && clientMessages.length > 0) {
    const lastMessage = clientMessages[clientMessages.length - 1];
    if (lastMessage.role === 'user') {
      await saveMessage(jobId, lastMessage);
    }
  }

  // Tool definition – model fills shipment schema directly
  const extractShipment = tool({
    description: 'Extract and structure shipment data from shipping documents. Call this tool ONLY ONCE per conversation to extract all data from all provided documents.',
    parameters: flatShipmentSchema,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async function ({
      transport, container, type,
      consignor_company, consignor_address, consignor_city_state, consignor_country,
      consignee_company, consignee_address, consignee_city_state, consignee_country,
      details_house_bill, details_domestic, details_origin, details_destination, details_etd, details_eta,
      details_weight_value, details_weight_unit, details_volume_value, details_volume_unit,
      details_chargeable_value, details_chargeable_unit, details_packages_count, details_packages_type,
      details_wv_ratio, details_inners_count, details_inners_type,
      details_goods_value_amount, details_goods_value_currency,
      details_insurance_value_amount, details_insurance_value_currency,
      details_description, details_marks_numbers,
      details_incoterm, details_free_on_board, details_spot_rate, details_spot_rate_type,
      details_use_standard_rate, details_service_level, details_release_type, details_charges_apply,
      details_phase, details_order_refs,
      customs_aqis_status, customs_customs_status, customs_subject_to_aqis, customs_subject_to_jfis,
    }: any) {
      console.log('🔧 Extract shipment tool called', {
        transport, container, type,
        consignor_company, consignor_address, consignor_city_state, consignor_country,
        consignee_company, consignee_address, consignee_city_state, consignee_country,
        details_house_bill, details_domestic, details_origin, details_destination, details_etd, details_eta,
        details_weight_value, details_weight_unit, details_volume_value, details_volume_unit,
        details_chargeable_value, details_chargeable_unit, details_packages_count, details_packages_type,
        details_wv_ratio, details_inners_count, details_inners_type,
        details_goods_value_amount, details_goods_value_currency,
        details_insurance_value_amount, details_insurance_value_currency,
        details_description, details_marks_numbers,
        details_incoterm, details_free_on_board, details_spot_rate, details_spot_rate_type,
        details_use_standard_rate, details_service_level, details_release_type, details_charges_apply,
        details_phase, details_order_refs,
        customs_aqis_status, customs_customs_status, customs_subject_to_aqis, customs_subject_to_jfis,
      });
      const extracted = {
        mode: { transport, container, type },
        consignor: {
          company: consignor_company || '',
          address: consignor_address || '',
          city_state: consignor_city_state || '',
          country: consignor_country || '',
        },
        consignee: {
          company: consignee_company || '',
          address: consignee_address || '',
          city_state: consignee_city_state || '',
          country: consignee_country || '',
        },
        details: {
          house_bill: details_house_bill || '',
          domestic: details_domestic || '',
          origin: details_origin || '',
          destination: details_destination || '',
          etd: details_etd || '',
          eta: details_eta || '',
          weight_value: details_weight_value || '',
          weight_unit: details_weight_unit || '',
          volume_value: details_volume_value || '',
          volume_unit: details_volume_unit || '',
          chargeable_value: details_chargeable_value || '',
          chargeable_unit: details_chargeable_unit || '',
          packages_count: details_packages_count || '',
          packages_type: details_packages_type || '',
          wv_ratio: details_wv_ratio || '',
          inners_count: details_inners_count || '',
          inners_type: details_inners_type || '',
          goods_value_amount: details_goods_value_amount || '',
          goods_value_currency: details_goods_value_currency || '',
          insurance_value_amount: details_insurance_value_amount || '',
          insurance_value_currency: details_insurance_value_currency || '',
          description: details_description || '',
          marks_numbers: details_marks_numbers || '',
          incoterm: details_incoterm || '',
          free_on_board: details_free_on_board || '',
          spot_rate: details_spot_rate || '',
          spot_rate_type: details_spot_rate_type || '',
          use_standard_rate: details_use_standard_rate || '',
          service_level: details_service_level || '',
          release_type: details_release_type || '',
          charges_apply: details_charges_apply || '',
          phase: details_phase || '',
          order_refs: details_order_refs || '',
        },
        customs_fields: {
          aqis_status: customs_aqis_status || '',
          customs_status: customs_customs_status || '',
          subject_to_aqis: customs_subject_to_aqis || '',
          subject_to_jfis: customs_subject_to_jfis || '',
        },
      };

      console.log('Flat extraction complete', extracted);

      await fetchAction(convexApi.jobs.saveExtractedData, {
        jobId: jobId as Id<'jobs'>,
        data: extracted,
      });

      return { extracted };
    },
  });

  const result = streamText({
    model: google('gemini-2.5-pro'),
    system: `You are a shipment data extraction specialist. Your task is to extract structured data from shipment documents.

CRITICAL: Use the extract_shipment tool EXACTLY ONCE to extract all data, then provide a brief summary. Do not call the tool multiple times.

WORKFLOW:
1. Analyze ALL provided documents
2. Call extract_shipment tool ONE TIME with all extracted data
3. Provide a brief natural language summary
4. STOP - do not make additional tool calls

EXTRACTION RULES:
- Extract exact values from documents when clearly visible
- For missing fields, use null/empty values
- Dates must be in YYYY-MM-DD format
- Numbers should be numeric values without formatting
- Analyze document context to deduce transport mode, container type, etc.
- Summarize goods description concisely

After calling the tool once, your job is complete.`,
    messages,
    temperature: 0,
    maxSteps: 2,
    toolChoice: 'auto',
    toolCallStreaming: true,
    tools: { extract_shipment: extractShipment },
    onFinish: async ({ response, usage }) => {
      try {
        // Log token usage
        if (usage) {
          console.log('🔢 Token Usage:', {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
          });
        }

        // The response.messages contain the core messages from the AI
        // We need to convert these to UI messages that match useChat format
        for (const coreMessage of response.messages) {
          if (coreMessage.role === 'assistant') {
            // Handle different types of assistant message content
            let uiMessage: any;
            
            if (typeof coreMessage.content === 'string') {
              // Simple text message
              uiMessage = {
                id: coreMessage.id || `msg-${Date.now()}`,
                role: 'assistant',
                content: coreMessage.content,
                createdAt: new Date().toISOString(),
              };
            } else if (Array.isArray(coreMessage.content)) {
              // Message with parts (text + tool calls)
              const parts = [];
              const toolInvocations = [];
              
              for (const part of coreMessage.content) {
                if (part.type === 'text') {
                  parts.push({
                    type: 'text',
                    text: part.text
                  });
                } else if (part.type === 'tool-call') {
                  // Convert tool call to tool invocation format
                  toolInvocations.push({
                    toolCallId: part.toolCallId,
                    toolName: part.toolName,
                    args: part.args,
                    state: 'result',
                    result: { extracted: part.args } // For extract_shipment tool
                  });
                }
              }
              
              uiMessage = {
                id: coreMessage.id || `msg-${Date.now()}`,
                role: 'assistant',
                parts: parts.length > 0 ? parts : undefined,
                content: parts.length === 1 && parts[0].type === 'text' ? parts[0].text : undefined,
                toolInvocations: toolInvocations.length > 0 ? toolInvocations : undefined,
                createdAt: new Date().toISOString(),
              };
            }
            
            if (uiMessage) {
              await saveMessage(jobId, uiMessage);
            }
          }
        }
        console.log('The extraction is complete');
      } catch (e) {
        console.error('Failed to persist assistant message onFinish', e);
      }
    },
  });

  return result.toDataStreamResponse();
} 