/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

// -----------------------------------------------------------------------------
//  Invoice Extraction API Route (Gemini native SDK)
//  ---------------------------------------------------------------------------
//  - Accepts either multipart/form-data (uploaded File objects) *or* JSON with
//    remote `fileUrls` (array of URLs).
//  - Builds a dynamic structured-output schema based on confirmed header &
//    line-item fields supplied by the client.
//  - Uploads all documents to the Gemini File API, waits for processing, then
//    calls `models.generateContent` with the uploaded files and prompt.
//  - Returns JSON: { extractedData, headerFields, lineItemFields, filesProcessed }
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import {
  GoogleGenAI,
  createPartFromUri,
  Type,
  Schema as GenaiSchema,
} from "@google/genai";

interface ConfirmedField {
  name: string;
  label: string;
  type: "string" | "number" | "date";
  description: string;
  required: boolean;
}

// Initialise the SDK once (cold-start friendly)
const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
  httpOptions: {
    timeout: 10 * 60 * 1000,
  },
});

// Helper – convert our ConfirmedField list into a Gemini JSON schema fragment
const buildProperties = (fields: ConfirmedField[]): Record<string, GenaiSchema> => {
  const map: Record<string, GenaiSchema> = {};
  fields.forEach((f) => {
    let t: GenaiSchema["type"];
    switch (f.type) {
      case "number":
        t = Type.NUMBER;
        break;
      case "date":
        // Represent dates as strings (YYYY-MM-DD)
        t = Type.STRING;
        break;
      default:
        t = Type.STRING;
    }
    map[f.name] = { type: t, description: f.description || undefined } as GenaiSchema;
  });
  return map;
};

// Retry wrapper for Gemini API calls
const retryGeminiCall = async (callFn: () => Promise<any>, maxRetries = 3, baseDelay = 2000): Promise<any> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await callFn();
    } catch (error: any) {
      console.error(`Gemini API attempt ${attempt} failed:`, error?.message || error);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff: 2s, 4s, 8s
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Upload a blob to the File API and wait until it is processed
const uploadFileAndWait = async (blob: Blob, displayName: string): Promise<{ uri: string; mimeType: string }> => {
  return await retryGeminiCall(async () => {
    const file = await ai.files.upload({
      file: blob,
      config: { displayName },
    });

    // Poll until state !== PROCESSING (with timeout)
    let current = await ai.files.get({ name: file.name as string });
    let pollCount = 0;
    const maxPolls = 24; // 2 minutes max (24 * 5s)
    
    while (current.state === "PROCESSING" && pollCount < maxPolls) {
      await new Promise((r) => setTimeout(r, 5000));
      current = await ai.files.get({ name: file.name as string });
      pollCount++;
    }
    
    if (current.state === "PROCESSING") {
      throw new Error(`File ${displayName} processing timed out after 2 minutes`);
    }
    if (current.state === "FAILED") {
      throw new Error(`File ${displayName} processing failed`);
    }
    
    return { uri: current.uri as string, mimeType: current.mimeType as string };
  });
};

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let headerFieldsInput: ConfirmedField[] = [];
    let lineItemFieldsInput: ConfirmedField[] = [];
    interface UploadedFile { uri?: string; mimeType?: string }
    const uploadedFiles: UploadedFile[] = [];

    // -------------------------------------------------------------
    // multipart/form-data branch
    // -------------------------------------------------------------
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const files = formData.getAll("files") as File[];
      headerFieldsInput = JSON.parse((formData.get("headerFields") as string) || "[]");
      lineItemFieldsInput = JSON.parse((formData.get("lineItemFields") as string) || "[]");

      if (!files.length) {
        return NextResponse.json({ error: "No files provided." }, { status: 400 });
      }

      for (const f of files) {
        const blob = new Blob([await f.arrayBuffer()], { type: f.type });
        const processed = await uploadFileAndWait(blob, f.name);
        if (processed.uri && processed.mimeType) {
          uploadedFiles.push({ uri: processed.uri as string, mimeType: processed.mimeType as string });
        }
      }
    } else {
      // -----------------------------------------------------------
      // JSON body branch (remote URLs)
      // -----------------------------------------------------------
      const { fileUrls = [], headerFields = [], lineItemFields = [] } = await request.json();
      if (!Array.isArray(fileUrls) || fileUrls.length === 0) {
        return NextResponse.json({ error: "fileUrls must be a non-empty array." }, { status: 400 });
      }
      headerFieldsInput = headerFields;
      lineItemFieldsInput = lineItemFields;

      // Fetch each URL → buffer → upload
      for (let i = 0; i < fileUrls.length; i += 1) {
        const url = fileUrls[i];
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Failed to fetch ${url}`);
        const arrayBuf = await resp.arrayBuffer();
        const mimeType = resp.headers.get("content-type") || "application/pdf";
        const blob = new Blob([arrayBuf], { type: mimeType });
        const processed = await uploadFileAndWait(blob, `remote-${i + 1}`);
        if (processed.uri && processed.mimeType) {
          uploadedFiles.push({ uri: processed.uri as string, mimeType: processed.mimeType as string });
        }
      }
    }

    // -------------------------------------------------------------
    // Build responseSchema for structured output
    // -------------------------------------------------------------

    const headerProps = buildProperties(headerFieldsInput);
    const lineItemProps = buildProperties(lineItemFieldsInput);

    const dynamicSchema: GenaiSchema = {
      type: Type.OBJECT,
      propertyOrdering: ["header", "lineItems"],
      properties: {
        header: {
          type: Type.OBJECT,
          properties: headerProps,
          propertyOrdering: Object.keys(headerProps),
        },
        lineItems: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: lineItemProps,
            propertyOrdering: Object.keys(lineItemProps),
          },
        },
      },
    };

    // -------------------------------------------------------------
    // Construct contents array: prompt + file parts
    // -------------------------------------------------------------
    const totalFiles = uploadedFiles.length;

    const headerDescriptions = headerFieldsInput
      .map(
        (f) =>
          `- ${f.label} (${f.name}): ${f.description} [Type: ${f.type}${f.required ? ", Required" : ", Optional"}]`,
      )
      .join("\n");

    const lineItemDescriptions = lineItemFieldsInput
      .map(
        (f) =>
          `- ${f.label} (${f.name}): ${f.description} [Type: ${f.type}${f.required ? ", Required" : ", Optional"}]`,
      )
      .join("\n");

    const systemPrompt = `Extract the following information from ${totalFiles} invoice document$${totalFiles > 1 ? "s" : ""}. If multiple documents are provided they belong to the same transaction; combine their information into ONE set of header fields and ONE unified list of line-items. Be precise and accurate.

Header fields (single occurrence per invoice):
${headerDescriptions}

Line-item fields (repeat for each row in the invoice table):
${lineItemDescriptions}

Make sure to include all the line items in the invoice by either checking the invoice header or number of line items.

IMPORTANT – The \`lineItems\` array MUST contain **one entry for EVERY single line-item row** present in the invoice's item table. Do NOT summarise, collapse, or omit rows – the array length must exactly equal the number of rows you detect (274 rows ➜ 274 objects).
IMPORTANT - All field values should be strictly extracted from the document, and not made up.
IMPORTANT - Be careful about misplacement in a table, review the table carefully.

If the document spans multiple pages or the table is very long, continue until **all** rows are included. It is acceptable if the final JSON is very large.

Return JSON matching the provided response schema with the complete \`lineItems\` array.`;

    const contents: any[] = [systemPrompt];
    uploadedFiles.forEach((f) => {
      if (f.uri && f.mimeType) {
        contents.push(createPartFromUri(f.uri as string, f.mimeType as string));
      }
    });

    // -------------------------------------------------------------
    // Generate content with structured output
    // -------------------------------------------------------------
    const response = await retryGeminiCall(async () => {
      return await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: dynamicSchema,
          thinkingConfig: {
            thinkingBudget: 20000, 
            includeThoughts: true, // Disable to reduce response time
          },
          temperature: 0.0,
        },
      });
    });

    let extractedData: any = null;
    try {
      extractedData = JSON.parse(response.text as string);
    } catch {
      // If parsing fails, return raw text for debugging
      extractedData = response.text;
    }

    console.log(response.usageMetadata);

    return NextResponse.json({
      extractedData,
      headerFields: headerFieldsInput.length,
      lineItemFields: lineItemFieldsInput.length,
      filesProcessed: totalFiles,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error extracting data:", error);
    
    // Provide more specific error messages
    let errorMessage = "Extraction failed";
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes("fetch failed") || error.message.includes("network")) {
        errorMessage = "Network error: Unable to connect to AI service. Please try again.";
        statusCode = 503; // Service Unavailable
      } else if (error.message.includes("timeout") || error.message.includes("timed out")) {
        errorMessage = "Request timed out: Document processing took too long. Try with smaller files.";
        statusCode = 408; // Request Timeout
      } else if (error.message.includes("processing failed")) {
        errorMessage = "File processing failed: Unable to process one or more uploaded files.";
        statusCode = 422; // Unprocessable Entity
      } else if (error.message.includes("rate limit") || error.message.includes("quota")) {
        errorMessage = "Rate limit exceeded: Too many requests. Please wait and try again.";
        statusCode = 429; // Too Many Requests
      } else {
        errorMessage = `Extraction failed: ${error.message}`;
      }
    }
    
    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
} 