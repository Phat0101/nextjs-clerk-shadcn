import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  // Users are synced from Clerk
  users: defineTable({
    name: v.string(),
    email: v.string(),
    clerkId: v.string(),
    role: v.union(v.literal("CLIENT"), v.literal("COMPILER"), v.literal("ADMIN")),
    clientId: v.optional(v.id("clients")),
  }).index("by_clerkId", ["clerkId"]),

  // Clients group users from the same company
  clients: defineTable({
    name: v.string(),
  }),

  // System settings for commission rates
  systemSettings: defineTable({
    key: v.string(), // e.g., "compilerCommission", "companyCommission"
    value: v.number(), // percentage as integer (70 for 70%)
    description: v.string(),
    updatedBy: v.id("users"),
  }).index("by_key", ["key"]),

  // Price units for different job types
  priceUnits: defineTable({
    name: v.string(),
    description: v.string(),
    amount: v.number(), // in cents
    currency: v.string(), // e.g., "AUD"
    isActive: v.boolean(),
    createdBy: v.id("users"),
  }),

  // Jobs are the core unit of work
  jobs: defineTable({
    title: v.string(),
    status: v.union(v.literal("RECEIVED"), v.literal("IN_PROGRESS"), v.literal("COMPLETED")),
    clientId: v.id("clients"),
    compilerId: v.optional(v.id("users")),
    priceUnitId: v.id("priceUnits"),
    totalPrice: v.number(), // in cents (priceUnit amount * number of files)
    outputFileUrl: v.optional(v.string()),
    deadline: v.number(), // Unix timestamp
    deadlineHours: v.number(), // Original deadline in hours for reference
    compilerStep: v.optional(v.string()), // track compiler workflow progress
    completedAt: v.optional(v.number()),
    // Additional compiler progress data for persistence
    analysisResult: v.optional(v.any()),
    confirmedFields: v.optional(v.array(v.any())),
    extractedData: v.optional(v.any()), // General purpose extracted data field
    shipmentRegistrationExtractedData: v.optional(v.any()), // Specific to shipment registration
    n10extractedData: v.optional(v.any()), // N10 document extracted data
    supplierName: v.optional(v.string()),
    templateFound: v.optional(v.boolean()),
  })
    .index("by_status", ["status"])
    .index("by_compilerId", ["compilerId"])
    .index("by_clientId", ["clientId"])
    .index("by_deadline", ["deadline"]),

  // Job files to support multiple files per job
  jobFiles: defineTable({
    jobId: v.id("jobs"),
    fileName: v.string(),
    fileStorageId: v.string(),
    fileSize: v.optional(v.number()),
    fileType: v.optional(v.string()),
    documentType: v.optional(v.string()),
    pageNumbers: v.optional(v.array(v.number())),
    isCoreDocument: v.optional(v.boolean()),
  })
    .index("by_jobId", ["jobId"]),

  jobOutputs: defineTable({
    jobId: v.id("jobs"),
    csvStorageId: v.string(),
    headerFields: v.optional(v.array(v.any())),
    lineItemFields: v.optional(v.array(v.any())),
    extractedData: v.any(),
  }).index("by_jobId", ["jobId"]),

  // Chat messages for each job's conversational interface
  chatMessages: defineTable({
    jobId: v.id("jobs"),
    // full UIMessage object stored for perfect restoration
    message: v.any(),
    // For quick filtering we still keep role and text snippet (optional)
    role: v.optional(v.union(v.literal("user"), v.literal("assistant"), v.literal("system"))),
    content: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_jobId", ["jobId"]),

  // Invoice templates for automatic extraction
  invoiceTemplates: defineTable({
    // The template may be created by an authenticated user (preferred) or anonymously via the agent.
    // For anonymous saves we allow these relational fields to be missing.
    clientId: v.optional(v.id("clients")),
    supplier: v.string(),
    clientName: v.optional(v.string()),
    headerFields: v.array(v.any()),
    lineItemFields: v.array(v.any()),
    embedding: v.array(v.float64()), // 1536-dimensional Gemini vector
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_client_supplier", ["clientId", "supplier"]).vectorIndex("by_embedding", {
      dimensions: 1536,
      vectorField: "embedding",
    }),
});
