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
import { PDFDocument } from "pdf-lib";

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

// Upload a blob to the File API and wait until it is processed
const uploadFileAndWait = async (blob: Blob, displayName: string): Promise<{ uri: string; mimeType: string }> => {
  const file = await ai.files.upload({
    file: blob,
    config: { displayName },
  });

  // Poll until state !== PROCESSING
  let current = await ai.files.get({ name: file.name as string });
  while (current.state === "PROCESSING") {
    await new Promise((r) => setTimeout(r, 5000));
    current = await ai.files.get({ name: file.name as string });
  }
  if (current.state === "FAILED") throw new Error(`File ${displayName} processing failed`);
  return { uri: current.uri as string, mimeType: current.mimeType as string };
};

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let headerFieldsInput: ConfirmedField[] = [];
    let lineItemFieldsInput: ConfirmedField[] = [];
    const sourceFiles: File[] = [];

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

      files.forEach((f) => sourceFiles.push(f));
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
        const fileObj = new File([arrayBuf], url.split("/").pop() || `remote-${i + 1}.pdf`, { type: mimeType });
        sourceFiles.push(fileObj);
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
    const totalFiles = sourceFiles.length;

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

If the document spans multiple pages or the table is very long, continue until **all** rows are included. It is acceptable if the final JSON is very large.

Return JSON matching the provided response schema with the complete \`lineItems\` array.`;

    // -------------------------------------------------------------
    // Split PDFs into overlapping 3-page windows and extract per chunk
    // -------------------------------------------------------------

    let mergedHeader: any = null;
    const mergedLineItems: any[] = [];
    const dedup = new Set<string>();

    const extractChunk = async (bytes: Uint8Array, displayName: string) => {
      const processed = await uploadFileAndWait(new Blob([bytes], { type: "application/pdf" }), displayName);
      const contentsChunk: any[] = [systemPrompt, createPartFromUri(processed.uri, processed.mimeType)];
      console.log("Calling Gemini on", displayName);
      const res = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: contentsChunk,
        config: { responseMimeType: "application/json", responseSchema: dynamicSchema },
      });
      try {
        return JSON.parse(res.text as string);
      } catch {
        console.warn("Unparsable JSON for", displayName);
        return null;
      }
    };

    for (const file of sourceFiles) {
      if ((file.type || "").includes("pdf")) {
        const originalBuf = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(originalBuf);
        const pages = pdfDoc.getPageCount();
        for (let start = 0; start < pages; start += 2) {
          const end = Math.min(start + 3, pages);
          const newPdf = await PDFDocument.create();
          const indices = Array.from({ length: end - start }, (_, i) => start + i);
          const copied = await newPdf.copyPages(pdfDoc, indices);
          copied.forEach((p) => newPdf.addPage(p));
          const chunkBytes = await newPdf.save();
          const chunkName = `${file.name}-p${start + 1}-${end}`;
          console.log(`Chunk ${chunkName} pages ${start + 1}-${end}`);
          const data = await extractChunk(chunkBytes, chunkName);
          if (data) {
            if (!mergedHeader) mergedHeader = data.header;
            (data.lineItems || []).forEach((li: any) => {
              const key = JSON.stringify(li);
              if (!dedup.has(key)) {
                dedup.add(key);
                mergedLineItems.push(li);
              }
            });
            console.log(`→ extracted ${data.lineItems?.length || 0} rows`);
          }
        }
      } else {
        // Non-PDF (image) – single extraction
        const buf = await file.arrayBuffer();
        const processed = await uploadFileAndWait(new Blob([buf], { type: file.type }), file.name);
        const contentsImg: any[] = [systemPrompt, createPartFromUri(processed.uri, processed.mimeType)];
        const res = await ai.models.generateContent({
          model: "gemini-2.5-pro",
          contents: contentsImg,
          config: { responseMimeType: "application/json", responseSchema: dynamicSchema },
        });
        const data = JSON.parse(res.text as string);
        if (!mergedHeader) mergedHeader = data.header;
        (data.lineItems || []).forEach((li: any) => {
          const key = JSON.stringify(li);
          if (!dedup.has(key)) {
            dedup.add(key);
            mergedLineItems.push(li);
          }
        });
      }
    }

    const extractedData = { header: mergedHeader || {}, lineItems: mergedLineItems };

    return NextResponse.json({
      extractedData,
      headerFields: headerFieldsInput.length,
      lineItemFields: lineItemFieldsInput.length,
      filesProcessed: totalFiles,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error extracting data:", error);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
} 