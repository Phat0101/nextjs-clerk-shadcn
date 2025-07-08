import { NextRequest, NextResponse } from "next/server";
import { fetchAction } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { templateId, supplier, clientName, headerFields, lineItemFields } = await req.json();
    if (!supplier || !Array.isArray(headerFields) || !Array.isArray(lineItemFields)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    // Build payload conditionally (omit templateId if not supplied)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = {
      supplier,
      clientName,
      headerFields,
      lineItemFields,
    };
    if (templateId) payload.templateId = templateId;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newId = await fetchAction((api as any).templates.saveTemplate, payload);
    return NextResponse.json({ templateId: newId });
  } catch (error) {
    console.error("Save template API error", error);
    return NextResponse.json({ error: "Failed to save template" }, { status: 500 });
  }
} 