import { NextRequest } from "next/server";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { fetchAction } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

// Template match will be called directly via Convex fetchAction

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { clientName, fileUrls } = body;
    if (!Array.isArray(fileUrls)) {
        return new Response("Missing fileUrls", { status: 400 });
    }

    console.log("agent called with", clientName, fileUrls);

    // -------------------------
    // Schema for supplier inference
    const supplierSchema = z.object({
        supplier: z
            .string()
            .min(1)
            .describe("The exact supplier / company name as written on the invoice header."),
    });

    // -------------------------
    // 1. Ask Gemini (generateObject) to extract the supplier name from the documents

    // Build multimodal message parts for supplier inference
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [
        {
            type: "text",
            text: `Identify the supplier / company name that issued these invoice documents. Return it as { "supplier": "..." } using exactly the provided JSON schema.`,
        },
    ];

    fileUrls.forEach((u: string, idx: number) => {
        const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(u);
        if (isImage) {
            parts.push({ type: "image", image: new URL(u) });
        } else {
            parts.push({
                type: "file",
                data: new URL(u),
                mimeType: "application/pdf",
                filename: `invoice-${idx + 1}.pdf`,
            });
        }
    });

    const { object: supplierObj } = await generateObject({
        model: google("gemini-2.5-pro"),
        schema: supplierSchema,
        messages: [
            {
                role: "user",
                content: parts,
            },
        ],
    });

    const supplier = supplierObj.supplier.trim();
    console.log("Inferred supplier from LLM:", supplier);

    // -------------------------
    // 2. Look for a matching template in Convex via action

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matchedTemplate = await fetchAction((api as any).templates.matchTemplate, {
        supplier,
        clientName,
    });

    // -------------------------
    // 3. Build final agent response

    return new Response(
        JSON.stringify({ supplier, templates: matchedTemplate }),
        { headers: { "Content-Type": "application/json" } }
    );
} 