import { NextRequest, NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { PDFDocument } from "pdf-lib";
import { api } from "@/convex/_generated/api";
import { fetchAction, fetchMutation } from "convex/nextjs";
import type { Id } from "@/convex/_generated/dataModel";

// Helper – core document list based on Australian Customs guidance
const CORE_DOC_TYPES = [
  "Packing List",
  "Sea Waybill",
  "Packing Declaration",
  "Invoice", // Allow simplified names
  "Air Waybill",
  "Waybill",
];

// Zod schema Gemini will fill in for each document/page
const classifySchema = z.object({
  documentType: z.string().describe("Document type, e.g. Invoice, Packing List, Sea Waybill, Certificate Of Origin, Air Waybill, Other"),
  confidence: z.number().min(0).max(1),
});

type ClassifyResult = z.infer<typeof classifySchema>;

/**
 * Classify a single file/page buffer with Gemini 2.5-pro.
 */
async function classifyDocument(buffer: Uint8Array | ArrayBuffer, mimeType: string): Promise<ClassifyResult> {
  const { object: result } = await generateObject({
    model: google("gemini-2.5-flash"),
    schema: classifySchema,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Classify the type of the following shipping-related document. Core document types you must choose from when appropriate: Invoice, Packing List, Air Waybill, Sea Waybill, Packing Declaration. If the document clearly matches one of those types, use that exact wording; otherwise use the best descriptive type (e.g. Certificate Of Origin, Other). Respond strictly using the provided JSON schema.`,
          },
          {
            type: "file",
            data: buffer,
            mimeType,
            filename: "document.pdf",
          },
        ],
      },
    ],
    temperature: 0,
  });
  console.log("Classified document:", result);
  return result;
}

/**
 * Upload a buffer to Convex storage and return the storageId + public URL.
 */
async function uploadToConvex(buffer: Uint8Array, mimeType: string, fileName: string) {
  // 1. Get pre-signed upload URL from Convex action
  const uploadUrl: string = await fetchAction(api.upload.generateUploadUrl, {});
  // 2. POST the file bytes
  const uploadResp = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": mimeType,
      "x-file-name": encodeURIComponent(fileName),
    },
    body: Buffer.from(buffer),
  });
  if (!uploadResp.ok) {
    const text = await uploadResp.text().catch(()=>"<no body>");
    throw new Error(`Failed to upload file to Convex storage: ${uploadResp.status} ${text}`);
  }
  const { storageId } = await uploadResp.json();
  // 3. Get public URL via helper query (unauthenticated)
  const fileUrl: string | null = await fetchAction(api.upload.getPublicUrl, { storageId });
  return { storageId, fileUrl, fileName };
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let files: File[] = [];
    let jobId: string | null = null;
    let incomingFileUrls: string[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      files = formData.getAll("files") as File[];
      if (!files || files.length === 0) {
        return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
      }
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      jobId = body.jobId;
      incomingFileUrls = body.fileUrls;
      if (!Array.isArray(incomingFileUrls) || incomingFileUrls.length === 0) {
        return NextResponse.json({ error: "fileUrls required" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "Unsupported content-type" }, { status: 400 });
    }

    // If we received URLs, download into File-like objects using fetch and Blob
    if (incomingFileUrls.length) {
      const downloaded: File[] = [];
      for (const url of incomingFileUrls) {
        const resp = await fetch(url);
        const arrayBuf = await resp.arrayBuffer();
        const mime = resp.headers.get("content-type") || "application/pdf";
        const fname = url.split("/").pop() || "document.pdf";
        downloaded.push(new File([arrayBuf], fname, { type: mime }));
      }
      files = downloaded;
    }

    console.log("Starting split & classify");
    // No token needed

    const results: Array<{
      storageId: string;
      fileUrl: string | null;
      documentType: string;
      pageNumbers: number[];
      isCoreDocument: boolean;
      fileName: string;
    }> = [];

    for (const file of files) {
      console.log("Processing uploaded file", file.name, file.type, file.size);
      const arrayBuffer = await file.arrayBuffer();
      const mimeType = file.type || "application/pdf";
      console.log("Inferred mime", mimeType);

      // Handle PDF vs image
      if (mimeType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        console.log("Loading PDF ...");
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        console.log("PDF pages", pdfDoc.getPageCount());

        // If single-page – classify whole doc directly
        if (pdfDoc.getPageCount() === 1) {
          console.log("Classifying single-page PDF");
          const classify = await classifyDocument(arrayBuffer, "application/pdf");
          const { fileUrl, storageId, fileName } = await uploadToConvex(new Uint8Array(arrayBuffer), "application/pdf", file.name);
          results.push({
            storageId,
            fileUrl,
            documentType: classify.documentType,
            pageNumbers: [1],
            isCoreDocument: CORE_DOC_TYPES.map((d) => d.toLowerCase()).includes(classify.documentType.toLowerCase()),
            fileName,
          });
        } else {
          // Multi-page: classify each page, then group consecutive pages with same docType
          const pageClassifications: ClassifyResult[] = [];
          for (let pageIdx = 0; pageIdx < pdfDoc.getPageCount(); pageIdx++) {
            console.log(`Classifying page ${pageIdx + 1}`);
            const singlePagePdf = await PDFDocument.create();
            const [copied] = await singlePagePdf.copyPages(pdfDoc, [pageIdx]);
            singlePagePdf.addPage(copied);
            const singleBytes = await singlePagePdf.save();
            const classify = await classifyDocument(singleBytes, "application/pdf");
            pageClassifications.push(classify);
          }

          // Group pages by consecutive same type
          let currentType = pageClassifications[0].documentType;
          let currentPages: number[] = [];
          const flushGroup = async () => {
            if (currentPages.length === 0) return;
            // Assemble PDF for this group
            const newPdf = await PDFDocument.create();
            const pagesToCopy = currentPages.map((p) => p - 1); // zero-based
            const copiedPages = await newPdf.copyPages(pdfDoc, pagesToCopy);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            copiedPages.forEach((page: any) => newPdf.addPage(page));
            const bytes = await newPdf.save();
            console.log("Uploading grouped PDF of", currentPages.length, "pages");
            const { fileUrl, storageId, fileName } = await uploadToConvex(bytes, "application/pdf", file.name);
            results.push({
              storageId,
              fileUrl,
              documentType: currentType,
              pageNumbers: [...currentPages],
              isCoreDocument: CORE_DOC_TYPES.map((d) => d.toLowerCase()).includes(currentType.toLowerCase()),
              fileName,
            });
          };

          for (let i = 0; i < pdfDoc.getPageCount(); i++) {
            const type = pageClassifications[i].documentType;
            if (type === currentType) {
              currentPages.push(i + 1);
            } else {
              await flushGroup();
              currentType = type;
              currentPages = [i + 1];
            }
          }
          await flushGroup();
        }
      } else if (mimeType.startsWith("image/")) {
        console.log("Classifying image");
        // Single image treated as single page
        const classify = await classifyDocument(arrayBuffer, mimeType);
        const { fileUrl, storageId, fileName } = await uploadToConvex(new Uint8Array(arrayBuffer), mimeType, file.name);
        results.push({
          storageId,
          fileUrl,
          documentType: classify.documentType,
          pageNumbers: [1],
          isCoreDocument: CORE_DOC_TYPES.map((d) => d.toLowerCase()).includes(classify.documentType.toLowerCase()),
          fileName,
        });
      } else {
        // Unsupported type – skip or treat as other
        continue;
      }
    }

    console.log("Split & classify finished, total logical docs:", results.length);

    // If jobId provided, persist new grouped files via mutation
    if (jobId) {
      const persistPayload = results.map(r=>({
        fileName: `${r.documentType.replace(/\s+/g,'_')}-${Array.isArray(r.pageNumbers)?r.pageNumbers.join('-'):r.pageNumbers}.pdf`,
        fileStorageId: r.storageId,
        fileType: "application/pdf",
        documentType: r.documentType,
        pageNumbers: r.pageNumbers,
        isCoreDocument: r.isCoreDocument,
      }));
      await fetchMutation(api.jobs.addJobFiles, { jobId: jobId as Id<"jobs">, files: persistPayload });
    }

    return NextResponse.json({ documents: results }, { status: 200 });
  } catch (error) {
    console.error("Error in classify route", error instanceof Error ? error.message : error);
    if (error instanceof Error) {
      console.error(error.stack);
      return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
}
