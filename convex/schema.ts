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
    // Job type this price unit applies to
    jobType: v.optional(
      v.union(
        v.literal("INVOICE"),
        v.literal("SHIPMENT"),
        v.literal("N10")
      )
    ),
    isActive: v.boolean(),
    createdBy: v.id("users"),
  }),

  // Jobs are the core unit of work
  jobs: defineTable({
    title: v.string(),
    // What kind of job this is (invoice extraction, shipment registration, N10 registration)
    jobType: v.optional(
      v.union(
        v.literal("INVOICE"),
        v.literal("SHIPMENT"),
        v.literal("N10")
      )
    ),
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

  // Inbox for managing inbound and outbound emails
  inbox: defineTable({
    type: v.union(v.literal("inbound"), v.literal("outbound")), // Email direction
    from: v.string(),
    fromName: v.optional(v.string()),
    to: v.string(),
    toFull: v.array(v.object({
      email: v.string(),
      name: v.optional(v.string()),
      mailboxHash: v.optional(v.string()),
    })),
    subject: v.optional(v.string()),
    textBody: v.optional(v.string()),
    htmlBody: v.optional(v.string()),
    messageId: v.string(),
    date: v.string(),
    attachments: v.array(v.object({
      name: v.string(),
      contentType: v.string(),
      contentLength: v.number(),
      storageId: v.optional(v.string()), // Convex storage ID if uploaded
    })),
    status: v.union(
      v.literal("unread"),
      v.literal("read"),
      v.literal("processed"),
      v.literal("archived"),
      v.literal("sent"), // For outbound emails
      v.literal("failed") // For failed outbound emails
    ),
    jobId: v.optional(v.id("jobs")), // Link to created job if any
    createdAt: v.number(),
    readAt: v.optional(v.number()),
    processedAt: v.optional(v.number()),
    sentAt: v.optional(v.number()), // When outbound email was sent
    // Additional fields for outbound email tracking
    recipientEmail: v.optional(v.string()), // Primary recipient for outbound emails
    emailService: v.optional(v.string()), // "postmark", etc.
    errorMessage: v.optional(v.string()), // Error message if sending failed
  })
    .index("by_status", ["status"])
    .index("by_type", ["type"])
    .index("by_date", ["date"])
    .index("by_from", ["from"])
    .index("by_messageId", ["messageId"])
    .index("by_type_status", ["type", "status"]),
});
