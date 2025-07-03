/* eslint-disable @typescript-eslint/no-explicit-any */
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { embedText } from "./embeddings";

export const matchTemplate = action({
  args: { supplier: v.string(), clientName: v.optional(v.string()) },
  handler: async (ctx, { supplier, clientName }) => {
    console.log("matchTemplate action", { supplier, clientName });

    // Compute embedding for search key
    const vector = await embedText(`${supplier} ${clientName || ""}`.trim());

    // Perform vector search and return multiple matches (score >= 0.8)
    const results = await (ctx as any).vectorSearch("invoiceTemplates", "by_embedding", {
      vector,
      limit: 10,
    });

    console.log("vectorSearch results", results);
    if (results.length === 0) return [];

    const filtered = results.filter((r: any) => r._score !== undefined && r._score >= 0.8);
    if (filtered.length === 0) return [];

    // Fetch docs
    const matches: any[] = [];
    for (const res of filtered) {
      const doc: any = await ctx.runQuery((internal as any).templates.getTemplateById, { id: res._id });
      if (doc) {
        matches.push({
          supplier: doc.supplier,
          clientName: doc.clientName,
          headerFields: doc.headerFields,
          lineItemFields: doc.lineItemFields,
          score: res._score,
          templateId: res._id,
        });
      }
    }

    // Sort highest score first
    matches.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return matches;
  },
});

export const saveTemplate = action({
  args: {
    templateId: v.optional(v.id("invoiceTemplates")),
    supplier: v.string(),
    clientName: v.optional(v.string()),
    headerFields: v.array(v.any()),
    lineItemFields: v.array(v.any()),
  },
  handler: async (ctx, { templateId, supplier, clientName, headerFields, lineItemFields }) => {
    // Attempt to identify the caller, but proceed even if unauthenticated.
    const identity = await ctx.auth.getUserIdentity();

    // Helper variables that may (or may not) be populated depending on auth status.
    let clientId: Id<"clients"> | undefined = undefined;
    let createdBy: Id<"users"> | undefined = undefined;

    if (identity) {
      const user = await (ctx as any).db
        .query("users")
        .withIndex("by_clerkId", (q: any) => q.eq("clerkId", identity.subject))
        .unique();

      if (user) {
        clientId = user.clientId ?? undefined;
        createdBy = user._id;
      }
    }

    const embedding = await embedText(`${supplier} ${clientName || ""}`.trim());

    // Persist via mutation (actions cannot write directly to DB)
    await ctx.runMutation((internal as any).templates.internalUpsertTemplate, {
      templateId,
      clientId,
      supplier,
      clientName,
      headerFields,
      lineItemFields,
      embedding,
      createdBy,
    });
  },
});

// Internal mutation to actually write the invoice template to the database.
export const internalUpsertTemplate = internalMutation({
  args: {
    templateId: v.optional(v.id("invoiceTemplates")),
    clientId: v.optional(v.id("clients")),
    supplier: v.string(),
    clientName: v.optional(v.string()),
    headerFields: v.array(v.any()),
    lineItemFields: v.array(v.any()),
    embedding: v.array(v.float64()),
    createdBy: v.optional(v.id("users")),
  },
  handler: async (
    ctx,
    { templateId, clientId, supplier, clientName, headerFields, lineItemFields, embedding, createdBy }
  ) => {
    // Update existing if id provided
    if (templateId) {
      await ctx.db.patch(templateId, {
        headerFields,
        lineItemFields,
        embedding,
        supplier,
        clientName,
      });
      return;
    }

    // Otherwise attempt to find existing by clientId + supplier
    if (clientId) {
      const existing = await ctx.db
        .query("invoiceTemplates")
        .withIndex("by_client_supplier", q => q.eq("clientId", clientId).eq("supplier", supplier))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          headerFields,
          lineItemFields,
          embedding,
          clientName,
        });
        return;
      }
    }

    // Insert new
    await ctx.db.insert("invoiceTemplates", {
      clientId,
      supplier,
      clientName,
      headerFields,
      lineItemFields,
      embedding,
      createdBy,
      createdAt: Date.now(),
    });
  },
});

// Internal query to fetch a template by its document _id.
export const getTemplateById = internalQuery({
  args: { id: v.id("invoiceTemplates") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
}); 