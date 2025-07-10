/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

// -----------------------------------------------------------------------------
//  Analyze Invoice Route – Native Google GenAI SDK (Gemini 2.5-flash)
//
//  Accepts:
//    1. multipart/form-data with one or more File objects (field name "files")
//    2. application/json with { fileUrls: string[] }
//
//  Returns structured suggestions for headerFields & lineItemFields using the
//  Gemini structured-output feature (responseSchema).
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import {
  GoogleGenAI,
  createPartFromUri,
  Type,
  Schema as GenaiSchema,
} from "@google/genai";

// Instantiate SDK once
const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
});

// Helper: upload a blob to File API and wait until processed
const uploadFileAndWait = async (blob: Blob, displayName: string): Promise<{ uri: string; mimeType: string }> => {
  const file = await ai.files.upload({ file: blob, config: { displayName } });
  let info = await ai.files.get({ name: file.name as string });
  while (info.state === "PROCESSING") {
    await new Promise((r) => setTimeout(r, 3000));
    info = await ai.files.get({ name: file.name as string });
  }
  if (info.state === "FAILED") throw new Error(`File ${displayName} processing failed`);
  return { uri: info.uri as string, mimeType: info.mimeType as string };
};

// Static response schema matching SuggestedFields arrays
const fieldSchema: GenaiSchema = {
  type: Type.OBJECT,
  propertyOrdering: ["name", "label", "type", "description", "required", "example"],
  properties: {
    name: { type: Type.STRING },
    label: { type: Type.STRING },
    type: { type: Type.STRING, enum: ["string", "number", "date"] },
    description: { type: Type.STRING },
    required: { type: Type.BOOLEAN },
    example: { type: Type.STRING, nullable: true },
  },
};

const suggestionSchema: GenaiSchema = {
  type: Type.OBJECT,
  propertyOrdering: [
    "headerFields",
    "lineItemFields",
    "documentType",
    "confidence",
    "notes",
  ],
  properties: {
    headerFields: { type: Type.ARRAY, items: fieldSchema },
    lineItemFields: { type: Type.ARRAY, items: fieldSchema },
    documentType: { type: Type.STRING },
    confidence: { type: Type.NUMBER },
    notes: { type: Type.STRING, nullable: true },
  },
};

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    interface UploadedFile { uri: string; mimeType: string }
    const uploaded: UploadedFile[] = [];

    // ---------------------------------------------------------
    // Handle input (multipart vs JSON URLs)
    // ---------------------------------------------------------
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const files = formData.getAll("files") as File[];
      if (!files.length) {
        return NextResponse.json({ error: "No files provided" }, { status: 400 });
      }
      for (const f of files) {
        const blob = new Blob([await f.arrayBuffer()], { type: f.type });
        const info = await uploadFileAndWait(blob, f.name);
        uploaded.push(info);
      }
    } else {
      const body = await request.json();
      const urls: string[] = body.fileUrls;
      if (!Array.isArray(urls) || urls.length === 0) {
        return NextResponse.json({ error: "fileUrls must be a non-empty array" }, { status: 400 });
      }
      for (let i = 0; i < urls.length; i += 1) {
        const u = urls[i];
        const resp = await fetch(u);
        if (!resp.ok) throw new Error(`Failed to fetch ${u}`);
        const buf = await resp.arrayBuffer();
        const mime = resp.headers.get("content-type") || "application/pdf";
        const blob = new Blob([buf], { type: mime });
        const info = await uploadFileAndWait(blob, `remote-${i + 1}`);
        uploaded.push(info);
      }
    }

    const docCount = uploaded.length;

    // ---------------------------------------------------------
    // Build prompt & contents
    // ---------------------------------------------------------
    const promptText = `Analyze ${docCount} document${docCount !== 1 ? "s" : ""} and suggest the most relevant fields for an invoice extraction workflow.

Separate your suggestions into TWO groups:
1. Invoice Header Fields – single-value attributes that appear once per invoice (e.g., invoiceNumber, invoiceDate, supplierName, totalAmount).
2. Invoice Line-Item Fields – columns that repeat for each line-item row (e.g., itemDescription, quantity, unitPrice, lineTotal).

Return JSON that matches the provided response schema exactly.`;

    const contents: any[] = [promptText];
    uploaded.forEach((f) => contents.push(createPartFromUri(f.uri, f.mimeType)));

    // ---------------------------------------------------------
    // Call Gemini with structured output
    // ---------------------------------------------------------
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: suggestionSchema,
      },
    });

    let analysis: any;
    try {
      analysis = JSON.parse(res.text as string);
    } catch {
      analysis = res.text;
    }

    return NextResponse.json({
      ...analysis,
      filesAnalyzed: docCount,
    });
  } catch (err) {
    console.error("Error analyzing documents:", err);
    return NextResponse.json({ error: "Failed to analyze documents" }, { status: 500 });
  }
} 