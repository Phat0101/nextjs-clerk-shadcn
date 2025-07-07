/* eslint-disable @typescript-eslint/no-explicit-any */
import { streamText, tool } from 'ai';
import { fetchMutation, fetchAction } from 'convex/nextjs';
import { api as convexApi } from '@/convex/_generated/api';
// import { openai } from '@ai-sdk/openai';
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

// const flatShipmentSchema = z.object({
//   // Mode
//   transport: z.enum(TRANSPORT_ENUM),
//   container: z.enum(CONTAINER_ENUM),
//   type: z.enum(TYPE_ENUM),
//
//   // Consignor
//   consignor_company: z.string().nullable().optional(),
//   consignor_address: z.string().nullable().optional(),
//   consignor_city_state: z.string().nullable().optional(),
//   consignor_country: z.string().nullable().optional(),
//
//   // Consignee
//   consignee_company: z.string().nullable().optional(),
//   consignee_address: z.string().nullable().optional(),
//   consignee_city_state: z.string().nullable().optional(),
//   consignee_country: z.string().nullable().optional(),
//
//   // Details – identifiers & routing
//   details_house_bill: z.string().nullable().optional(),
//   details_domestic: z.boolean().nullable().optional(),
//   details_origin: z.string().nullable().optional(),
//   details_destination: z.string().nullable().optional(),
//   details_etd: z.string().nullable().optional(),
//   details_eta: z.string().nullable().optional(),
//
//   // Details – weights / volumes
//   details_weight_value: z.number().nullable().optional(),
//   details_weight_unit: z.enum(WEIGHT_UNIT_ENUM).nullable().optional(),
//   details_volume_value: z.number().nullable().optional(),
//   details_volume_unit: z.enum(VOLUME_UNIT_ENUM).nullable().optional(),
//   details_chargeable_value: z.number().nullable().optional(),
//   details_chargeable_unit: z.enum(VOLUME_UNIT_ENUM).nullable().optional(),
//
//   // Details – packages
//   details_packages_count: z.number().nullable().optional(),
//   details_packages_type: z.enum(PACKAGES_ENUM).nullable().optional(),
//   details_wv_ratio: z.number().nullable().optional(),
//   details_inners_count: z.number().nullable().optional(),
//   details_inners_type: z.enum(PACKAGES_ENUM).nullable().optional(),
//
//   // Details – values & description
//   details_goods_value_amount: z.number().nullable().optional(),
//   details_goods_value_currency: z.enum(CURRENCY_ENUM).nullable().optional(),
//   details_insurance_value_amount: z.number().nullable().optional(),
//   details_insurance_value_currency: z.enum(CURRENCY_ENUM).nullable().optional(),
//   details_description: z.string().nullable().optional().describe('Summary description of the goods'),
//   details_marks_numbers: z.string().nullable().optional(),
//
//   // Details – commercial terms
//   details_incoterm: z.enum(INCOTERM_ENUM).nullable().optional(),
//   details_free_on_board: z.boolean().nullable().optional(),
//   details_spot_rate: z.number().nullable().optional(),
//   details_spot_rate_type: z.enum(SPOT_RATE_TYPE_ENUM).nullable().optional(),
//   details_use_standard_rate: z.boolean().nullable().optional(),
//   details_service_level: z.enum(SERVICE_LEVEL_ENUM).nullable().optional(),
//   details_release_type: z.enum(RELEASE_TYPE_ENUM).nullable().optional(),
//   details_charges_apply: z.enum(CHARGES_APPLY_ENUM).nullable().optional(),
//   details_phase: z.enum(PHASE_ENUM).nullable().optional(),
//   details_order_refs: z.string().nullable().optional(),
//
//   // Customs fields
//   customs_aqis_status: z.string().nullable().optional(),
//   customs_customs_status: z.string().nullable().optional(),
//   customs_subject_to_aqis: z.boolean().nullable().optional(),
//   customs_subject_to_jfis: z.boolean().nullable().optional(),
// });

// Helper to decide if URL is image
const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|bmp|webp)(\?|$)/i.test(url);

// Helper to sanitize message for Convex storage
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
async function saveMessage(jobId: string, message: any) {
  try {
    const sanitizedMessage = sanitizeMessage(message);
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
    ? [{ role: 'user', content: [{ type: 'text', text: `Please analyze these ${fileParts.length} document(s) and extract the relevant data. Wait for my specific instructions on which extraction workflow to use (shipment registration or N10).` }, ...fileParts] }]
    : [];

  const messages = [...seedMessage, ...clientMessages];

  // Save the latest user message if it exists (it should be in UI format already)
  if (clientMessages && clientMessages.length > 0) {
    const lastMessage = clientMessages[clientMessages.length - 1];
    if (lastMessage.role === 'user') {
      await saveMessage(jobId, lastMessage);
    }
  }

  // --------------------------------------------------
  // 5 Separate tools for incremental extraction
  // --------------------------------------------------

  const modeSchema = z.object({
    transport: z.enum(TRANSPORT_ENUM),
    container: z.enum(CONTAINER_ENUM),
    type: z.enum(TYPE_ENUM),
  });

  const consignorSchema = z.object({
    company: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    city_state: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
  });

  const consigneeSchema = consignorSchema;

  const detailsSchema = z.object({
    house_bill: z.string().nullable().optional(),
    domestic: z.boolean().nullable().optional(),
    origin: z.string().nullable().optional(),
    destination: z.string().nullable().optional(),
    etd: z.string().nullable().optional(),
    eta: z.string().nullable().optional(),
    weight_value: z.number().nullable().optional(),
    weight_unit: z.enum(WEIGHT_UNIT_ENUM).nullable().optional(),
    volume_value: z.number().nullable().optional(),
    volume_unit: z.enum(VOLUME_UNIT_ENUM).nullable().optional(),
    chargeable_value: z.number().nullable().optional(),
    chargeable_unit: z.enum(VOLUME_UNIT_ENUM).nullable().optional(),
    packages_count: z.number().nullable().optional(),
    packages_type: z.enum(PACKAGES_ENUM).nullable().optional(),
    wv_ratio: z.number().nullable().optional(),
    inners_count: z.number().nullable().optional(),
    inners_type: z.enum(PACKAGES_ENUM).nullable().optional(),
    goods_value_amount: z.number().nullable().optional(),
    goods_value_currency: z.enum(CURRENCY_ENUM).nullable().optional(),
    insurance_value_amount: z.number().nullable().optional(),
    insurance_value_currency: z.enum(CURRENCY_ENUM).nullable().optional(),
    description: z.string().nullable().optional(),
    marks_numbers: z.string().nullable().optional(),
    incoterm: z.enum(INCOTERM_ENUM).nullable().optional(),
    free_on_board: z.boolean().nullable().optional(),
    spot_rate: z.number().nullable().optional(),
    spot_rate_type: z.enum(SPOT_RATE_TYPE_ENUM).nullable().optional(),
    use_standard_rate: z.boolean().nullable().optional(),
    service_level: z.enum(SERVICE_LEVEL_ENUM).nullable().optional(),
    release_type: z.enum(RELEASE_TYPE_ENUM).nullable().optional(),
    charges_apply: z.enum(CHARGES_APPLY_ENUM).nullable().optional(),
    phase: z.enum(PHASE_ENUM).nullable().optional(),
    order_refs: z.string().nullable().optional(),
  });

  const customsSchema = z.object({
    aqis_status: z.string().nullable().optional(),
    customs_status: z.string().nullable().optional(),
    subject_to_aqis: z.boolean().nullable().optional(),
    subject_to_jfis: z.boolean().nullable().optional(),
  });

  // Helper to create tool that saves partial under given key
  function createPartialTool(name: string, key: string, schema: z.ZodTypeAny) {
    const fieldNames = Object.keys((schema as any).shape ?? {});
    const fieldList = fieldNames.join(', ');
    return tool({
      description: `Extract the ${key} section of the shipment data. Provide values for these fields: ${fieldList}. Return ONLY the parameters defined.`,
      parameters: schema,
      execute: async function (/** @type {any} */ params: any) {
        // Use explicit parameter variable instead of generic 'args' for better model clarity
        const sectionData = params; // alias with semantic name
        const partial = { [key]: sectionData };
        console.log(`🔧 ${name} called`, partial);
        await fetchAction((convexApi as any).jobs.saveShipmentRegistrationExtractedDataPartial, {
          jobId: jobId as Id<'jobs'>,
          partial,
        });
        return { extracted: partial };
      },
    });
  }

  const extractMode = createPartialTool('extract_mode', 'mode', modeSchema);
  const extractConsignor = createPartialTool('extract_consignor', 'consignor', consignorSchema);
  const extractConsignee = createPartialTool('extract_consignee', 'consignee', consigneeSchema);
  const extractDetails = createPartialTool('extract_details', 'details', detailsSchema);
  const extractCustoms = createPartialTool('extract_customs', 'customs_fields', customsSchema);

  // N10 extraction tool - single comprehensive tool for N10 document data
  const declarationHeaderSchema = z.object({
    declarationHeader: z.object({
      ownerReference: z.string().nullable().optional(),
      biosecurityInspectionLocation: z.string().nullable().optional(),
      valuationDate: z.string().describe("YYYY-MM-DD").nullable().optional(),
      headerValuationAdviceNumber: z.string().nullable().optional(),
      eftPaymentIndicator: z.boolean().nullable().optional(),
    }).describe("Header information for the declaration.").nullable().optional(),
  });

  const ownerDetailsSchema = z.object({
    ownerDetails: z.object({
      abn: z.string().nullable().optional(),
      cac: z.string().nullable().optional(),
      ccid: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
      address: z.object({
        street: z.string().nullable().optional(),
        city: z.string().nullable().optional(),
        state: z.string().nullable().optional(),
        postcode: z.string().nullable().optional(),
      }).nullable().optional(),
      contact: z.object({
        phone: z.string().nullable().optional(),
        mobile: z.string().nullable().optional(),
        fax: z.string().nullable().optional(),
        email: z.string().nullable().optional(),
      }).nullable().optional(),
    }).describe("Details of the owner.").nullable().optional(),
  });

  const senderDetailsSchema = z.object({
    senderDetails: z.object({
      name: z.string().nullable().optional(),
      address: z.object({
        street: z.string().nullable().optional(),
        city: z.string().nullable().optional(),
        state: z.string().nullable().optional(),
        postcode: z.string().nullable().optional(),
      }).nullable().optional(),
      supplierId: z.object({
        ccid: z.string().nullable().optional(),
        abn: z.string().nullable().optional(),
      }).nullable().optional(),
      vendorId: z.object({
        abn: z.string().nullable().optional(),
        arn: z.string().nullable().optional(),
      }).nullable().optional(),
    }).describe("Details of the sender.").nullable().optional(),
  });

  const transportInformationSchema = z.object({
    transportInformation: z.object({
      modeOfTransport: z.enum(["Sea", "Air", "Post", "Other"]).nullable().optional(),
      firstArrivalDate: z.string().describe("YYYY-MM-DD").nullable().optional(),
      grossWeight: z.number().nullable().optional(),
      grossWeightUnit: z.string().nullable().optional(),
      numberOfPackages: z.number().nullable().optional(),
      marksAndNumbersDescription: z.string().nullable().optional(),
      loadingPort: z.string().nullable().optional(),
      dischargePort: z.string().nullable().optional(),
      sea: z.object({
        vesselName: z.string().nullable().optional(),
        vesselId: z.string().nullable().optional(),
        voyageNumber: z.string().nullable().optional(),
        firstArrivalPort: z.string().nullable().optional(),
        cargoType: z.string().nullable().optional(),
        containerNumber: z.string().nullable().optional(),
        oceanBillOfLadingNumber: z.string().nullable().optional(),
        houseBillOfLadingNumber: z.string().nullable().optional(),
      }).nullable().optional(),
      air: z.object({
        masterAirWaybillNumber: z.string().nullable().optional(),
        houseAirWaybillNumber: z.string().nullable().optional(),
      }).nullable().optional(),
      post: z.object({
        parcelPostCardNumber: z.string().nullable().optional(),
      }).nullable().optional(),
      other: z.object({
        departmentReceiptForGoodsNumber: z.string().nullable().optional(),
      }).nullable().optional(),
    }).describe("Information about the transport of goods.").nullable().optional(),
  });

  const goodsDeclarationSchema = z.object({
    goodsDeclaration: z.array(z.object({
      lineNumber: z.number().nullable().optional(),
      goodsDescription: z.string().nullable().optional(),
      tariffClassificationNumber: z.string().nullable().optional(),
      statisticalCode: z.string().nullable().optional(),
      supplierName: z.string().nullable().optional(),
      valuationBasisType: z.string().nullable().optional(),
      treatmentCode: z.string().nullable().optional(),
      gstExemptionCode: z.string().nullable().optional(),
      establishmentCode: z.string().nullable().optional(),
      quantity: z.number().nullable().optional(),
      unit: z.string().nullable().optional(),
      price: z.number().nullable().optional(),
      currency: z.string().nullable().optional(),
      valuationElements: z.array(z.object({
        type: z.string().nullable().optional(),
        amount: z.number().nullable().optional(),
        currency: z.string().nullable().optional(),
      })).nullable().optional(),
      permits: z.array(z.object({
        permitNumber: z.string().nullable().optional(),
        instrumentType: z.string().nullable().optional(),
        additionalInformation: z.string().nullable().optional(),
      })).nullable().optional(),
      producer: z.object({
        producerCode: z.string().nullable().optional(),
        type: z.string().nullable().optional(),
      }).nullable().optional(),
    })).describe("A list of goods being declared."),
  });

  const declarationStatementSchema = z.object({
    declarationStatement: z.object({
      name: z.string().nullable().optional(),
      signature: z.string().nullable().optional(),
      date: z.string().describe("YYYY-MM-DD").nullable().optional(),
      isOwner: z.boolean().nullable().optional(),
      isAgent: z.boolean().nullable().optional(),
    }).describe("Statement of declaration.").nullable().optional(),
    amberStatement: z.object({
      reasonForUncertainty: z.string().nullable().optional(),
    }).describe("Amber line statement for uncertain declarations.").nullable().optional(),
  });

  // Helper to create tool that saves N10 partial under given key
  function createN10PartialTool(name: string, schema: z.ZodTypeAny) {
    const fieldNames = Object.keys((schema as any).shape ?? {});
    const fieldList = fieldNames.join(', ');
    return tool({
      description: `Extract the following sections of the N10 data: ${fieldList}.`,
      parameters: schema,
      execute: async function (params: any) {
        console.log(`🔧 ${name} called`, params);
        await fetchAction((convexApi as any).jobs.saveN10ExtractedDataPartial, {
          jobId: jobId as Id<'jobs'>,
          partial: params,
        });
        return { extracted: params };
      },
    });
  }

  const extractN10Header = createN10PartialTool('extract_n10_header', declarationHeaderSchema);
  const extractN10Owner = createN10PartialTool('extract_n10_owner', ownerDetailsSchema);
  const extractN10Sender = createN10PartialTool('extract_n10_sender', senderDetailsSchema);
  const extractN10Transport = createN10PartialTool('extract_n10_transport', transportInformationSchema);
  const extractN10Goods = tool({
    description:
      `Extract the full \`goodsDeclaration\` list for the N10 document. ` +
      `You MUST cross-reference BOTH the invoice and packing-list documents to ensure every line item is captured. ` +
      `All fields defined in the schema are required (use null when not present). ` +
      `CRITICAL: The length of \`goodsDeclaration\` MUST equal the \`numberOfPackages\` value from \`transportInformation\`. ` +
      `If the counts differ, fix the list and call this tool again.`,
    parameters: goodsDeclarationSchema,
    execute: async (params: any) => {
      console.log('🔧 extract_n10_goods called', params);
      await fetchAction((convexApi as any).jobs.saveN10ExtractedDataPartial, {
        jobId: jobId as Id<'jobs'>,
        partial: params,
      });
      return { extracted: params };
    },
  });
  const extractN10Statement = createN10PartialTool('extract_n10_statement', declarationStatementSchema);

  const result = streamText({
    model: google('gemini-2.5-pro'),
    seed: 4834,
    // model: anthropic('claude-4-sonnet-20250514'),
    // providerOptions: {
    //   anthropic: {
    //     thinking: { type: 'enabled', budgetTokens: 50000 },
    //   },
    // },
    system: `You are a document data extraction specialist. Your task is to extract structured data from logistics and customs documents.

WORKFLOW SELECTION:
Listen carefully to the user's request to determine which extraction workflow to use:

**USER REQUESTS "SHIPMENT" OR "SHIPMENT REGISTRATION":**
Use the 5-tool shipment workflow: extract_mode, extract_consignor, extract_consignee, extract_details, extract_customs.
Call EACH tool exactly once in this recommended order:
  1. extract_mode – identify transport/container/type
  2. extract_consignor – consignor company/address/etc.
  3. extract_consignee – consignee company/address/etc.
  4. extract_customs – customs & AQIS fields
  5. extract_details – routing, weights, packages, commercial terms

**USER REQUESTS "N10" OR MENTIONS "N10 EXTRACTION":**
Use the 6-tool N10 workflow.
Call EACH tool exactly once in this recommended order:
  1. extract_n10_header
  2. extract_n10_owner
  3. extract_n10_sender
  4. extract_n10_transport
  5. extract_n10_goods (this includes the list of all goods)
  6. extract_n10_statement

The N10 tools can be used on ANY document type when the user specifically requests N10 extraction.
Extract whatever relevant information is available from the provided documents.

**USER PROVIDES NO SPECIFIC REQUEST:**
Default to shipment registration workflow (5 tools) for general logistics documents.

IMPORTANT NOTES:
• User intent overrides document type detection
• If user says "extract N10" or "for N10 extraction", use the N10 tools regardless of document type
• If user says "extract shipment data", use the 5-tool workflow
• Never mix workflows or call tools from different workflows
• After completing the appropriate workflow, return \`DONE\` + summary

EXTRACTION RULES:
- CRITICAL: For all tools, you MUST provide a value for EVERY field defined in the tool's schema. If a value cannot be found in the document, you MUST explicitly use null.
- CRITICAL (N10 Workflow): When calling \`extract_n10_goods\`, you MUST build the \`goodsDeclaration\` array by CROSS-REFERENCING information from BOTH the invoice *and* the packing-list documents. The number of items in this array MUST exactly match the \`numberOfPackages\` value obtained from \`extract_n10_transport\`. If there is any mismatch or missing line item, you *must* correct the list and call \`extract_n10_goods\` again.
- Extract exact values from documents when clearly visible
- For missing fields, use null/empty values
- Dates must be in YYYY-MM-DD format
- Numbers should be numeric values without formatting
- Analyze document context to deduce values when appropriate
- Be flexible and extract relevant information even if document format doesn't perfectly match the expected type`,
    messages,
    temperature: 0,
    maxSteps: 12,
    toolChoice: 'auto',
    toolCallStreaming: true,
    tools: {
      extract_mode: extractMode,
      extract_consignor: extractConsignor,
      extract_consignee: extractConsignee,
      extract_details: extractDetails,
      extract_customs: extractCustoms,
      extract_n10_header: extractN10Header,
      extract_n10_owner: extractN10Owner,
      extract_n10_sender: extractN10Sender,
      extract_n10_transport: extractN10Transport,
      extract_n10_goods: extractN10Goods,
      extract_n10_statement: extractN10Statement,
    },
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

  return result.toDataStreamResponse({ sendReasoning: true });
} 