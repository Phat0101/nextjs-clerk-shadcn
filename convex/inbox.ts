import { query, mutation, internalMutation, internalQuery, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id, Doc } from "./_generated/dataModel";

// Get all inbox emails for admin view (both inbound and outbound)
export const getAll = query({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user || user.role !== "ADMIN") throw new Error("Admin access required");

        return await ctx.db
            .query("inbox")
            .order("desc")
            .collect();
    },
});

// Get inbox by type (inbound/outbound)
export const getByType = query({
    args: { type: v.union(v.literal("inbound"), v.literal("outbound")) },
    handler: async (ctx, { type }) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user || user.role !== "ADMIN") throw new Error("Admin access required");

        return await ctx.db
            .query("inbox")
            .withIndex("by_type", (q) => q.eq("type", type))
            .order("desc")
            .collect();
    },
});

// Get inbox by status for admin filtering
export const getByStatus = query({
    args: { status: v.union(v.literal("unread"), v.literal("read"), v.literal("processed"), v.literal("archived"), v.literal("sent"), v.literal("failed")) },
    handler: async (ctx, { status }) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user || user.role !== "ADMIN") throw new Error("Admin access required");

        return await ctx.db
            .query("inbox")
            .withIndex("by_status", (q) => q.eq("status", status))
            .order("desc")
            .collect();
    },
});

// Get inbox stats for admin dashboard
export const getStats = query({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user || user.role !== "ADMIN") throw new Error("Admin access required");

        const allEmails = await ctx.db.query("inbox").collect();

        const inboundEmails = allEmails.filter(e => e.type === "inbound");
        const outboundEmails = allEmails.filter(e => e.type === "outbound");

        const stats = {
            total: allEmails.length,
            inbound: inboundEmails.length,
            outbound: outboundEmails.length,
            unread: allEmails.filter(e => e.status === "unread").length,
            read: allEmails.filter(e => e.status === "read").length,
            processed: allEmails.filter(e => e.status === "processed").length,
            archived: allEmails.filter(e => e.status === "archived").length,
            sent: allEmails.filter(e => e.status === "sent").length,
            failed: allEmails.filter(e => e.status === "failed").length,
        };

        return stats;
    },
});

// Mark email as read
export const markAsRead = mutation({
    args: { emailId: v.id("inbox") },
    handler: async (ctx, { emailId }) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user || user.role !== "ADMIN") throw new Error("Admin access required");

        const email = await ctx.db.get(emailId);
        if (!email) throw new Error("Email not found");

        await ctx.db.patch(emailId, {
            status: "read",
            readAt: Date.now(),
        });
    },
});

// Update email status
export const updateStatus = mutation({
    args: {
        emailId: v.id("inbox"),
        status: v.union(v.literal("unread"), v.literal("read"), v.literal("processed"), v.literal("archived"), v.literal("sent"), v.literal("failed"))
    },
    handler: async (ctx, { emailId, status }) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user || user.role !== "ADMIN") throw new Error("Admin access required");

        const email = await ctx.db.get(emailId);
        if (!email) throw new Error("Email not found");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updates: any = { status };

        if (status === "read" && !email.readAt) {
            updates.readAt = Date.now();
        }

        if (status === "processed" && !email.processedAt) {
            updates.processedAt = Date.now();
        }

        if (status === "sent" && !email.sentAt) {
            updates.sentAt = Date.now();
        }

        await ctx.db.patch(emailId, updates);
    },
});

// Delete email (admin only)
export const deleteEmail = mutation({
    args: { emailId: v.id("inbox") },
    handler: async (ctx, { emailId }) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user || user.role !== "ADMIN") throw new Error("Admin access required");

        await ctx.db.delete(emailId);
    },
});

// Internal mutation to create inbox entry from webhook (no auth required) - inbound emails
export const createFromWebhook = internalMutation({
    args: {
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
            storageId: v.optional(v.string()),
        })),
        jobId: v.optional(v.id("jobs")),
    },
    handler: async (ctx, args): Promise<Id<"inbox">> => {
        // Check if email already exists by messageId to prevent duplicates
        const existing = await ctx.db
            .query("inbox")
            .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
            .unique();

        if (existing) {
            return existing._id;
        }

        return await ctx.db.insert("inbox", {
            ...args,
            type: "inbound", // Mark as inbound email
            status: "unread",
            createdAt: Date.now(),
        });
    },
});

// Internal mutation to create outbound email record (no auth required)
export const createOutboundEmail = internalMutation({
    args: {
        from: v.string(),
        fromName: v.optional(v.string()),
        to: v.string(),
        recipientEmail: v.string(),
        subject: v.optional(v.string()),
        textBody: v.optional(v.string()),
        htmlBody: v.optional(v.string()),
        messageId: v.string(),
        jobId: v.optional(v.id("jobs")),
        attachments: v.optional(v.array(v.object({
            name: v.string(),
            contentType: v.string(),
            contentLength: v.number(),
            storageId: v.optional(v.string()),
        }))),
        emailService: v.optional(v.string()),
        status: v.union(v.literal("sent"), v.literal("failed")),
        errorMessage: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<Id<"inbox">> => {
        const now = Date.now();
        
        return await ctx.db.insert("inbox", {
            type: "outbound", // Mark as outbound email
            from: args.from,
            fromName: args.fromName,
            to: args.to,
            toFull: [{ email: args.recipientEmail }], // Single recipient for outbound
            subject: args.subject,
            textBody: args.textBody,
            htmlBody: args.htmlBody,
            messageId: args.messageId,
            date: new Date().toISOString(),
            attachments: args.attachments || [],
            status: args.status,
            jobId: args.jobId,
            recipientEmail: args.recipientEmail,
            emailService: args.emailService,
            errorMessage: args.errorMessage,
            createdAt: now,
            sentAt: args.status === "sent" ? now : undefined,
        });
    },
});

// Public action to create outbound email record
export const createOutboundEmailAction = action({
    args: {
        from: v.string(),
        fromName: v.optional(v.string()),
        to: v.string(),
        recipientEmail: v.string(),
        subject: v.optional(v.string()),
        textBody: v.optional(v.string()),
        htmlBody: v.optional(v.string()),
        messageId: v.string(),
        jobId: v.optional(v.id("jobs")),
        attachments: v.optional(v.array(v.object({
            name: v.string(),
            contentType: v.string(),
            contentLength: v.number(),
            storageId: v.optional(v.string()),
        }))),
        emailService: v.optional(v.string()),
        status: v.union(v.literal("sent"), v.literal("failed")),
        errorMessage: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<Id<"inbox">> => {
        return await ctx.runMutation(internal.inbox.createOutboundEmail, args);
    },
});

// Get file URL from storage ID (for admin attachment viewing)
// Note: This function doesn't require auth since access is controlled by the admin interface
// and Convex storage URLs are already secure and time-limited
export const getFileUrl = query({
    args: { storageId: v.string() },
    handler: async (ctx, { storageId }) => {
        return await ctx.storage.getUrl(storageId);
    },
});

// Internal query to get email by ID (for completion email sending)
export const getEmailById = internalQuery({
    args: { emailId: v.id("inbox") },
    handler: async (ctx, { emailId }) => {
        return await ctx.db.get(emailId);
    },
});

// Internal query to check job link without authentication (for auto-processing)
export const checkJobLinkInternal = internalQuery({
    args: { jobId: v.id("jobs") },
    handler: async (ctx, { jobId }) => {
        console.log('🔍 Internal: Checking job link for jobId:', jobId);
        
        // Find inbox email linked to this job (no auth needed for internal queries)
        const linkedEmail = await ctx.db
            .query("inbox")
            .filter((q) => q.eq(q.field("jobId"), jobId))
            .order("desc")
            .first();

        console.log('📧 Internal: Linked email search result:', linkedEmail ? 'Found' : 'Not found');
        if (linkedEmail) {
            console.log('📧 Internal: Email details:', {
                from: linkedEmail.from,
                subject: linkedEmail.subject,
                status: linkedEmail.status
            });
        }

        return linkedEmail;
    },
});

// Check if a job is linked to an inbox email (accessible to anyone with job access)
export const checkJobLink = query({
    args: { jobId: v.id("jobs") },
    handler: async (ctx, { jobId }) => {
        console.log('🔍 Convex: Checking job link for jobId:', jobId);
        
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            console.log('❌ Convex: No identity found');
            return null;
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!user) {
            console.log('❌ Convex: No user found for identity:', identity.subject);
            return null;
        }

        console.log('👤 Convex: User found:', { role: user.role, clientId: user.clientId });

        // Get the job to check access permissions
        const job = await ctx.db.get(jobId);
        if (!job) {
            console.log('❌ Convex: Job not found:', jobId);
            return null;
        }

        console.log('💼 Convex: Job found:', { 
            status: job.status, 
            clientId: job.clientId, 
            compilerId: job.compilerId 
        });

        // Security check: Only the assigned compiler, client, or an admin can check the job link
        if (user.role !== "ADMIN" && 
            job.compilerId !== user._id && 
            (user.clientId && job.clientId !== user.clientId)) {
            console.log('❌ Convex: Access denied - user not authorized to check job link');
            return null;
        }

        console.log('✅ Convex: Access granted, searching for linked email');

        // Find inbox email linked to this job
        const linkedEmail = await ctx.db
            .query("inbox")
            .filter((q) => q.eq(q.field("jobId"), jobId))
            .order("desc")
            .first();

        console.log('📧 Convex: Linked email search result:', linkedEmail ? 'Found' : 'Not found');
        if (linkedEmail) {
            console.log('📧 Convex: Email details:', {
                from: linkedEmail.from,
                subject: linkedEmail.subject,
                status: linkedEmail.status
            });
        }

        return linkedEmail;
    },
});

// Internal mutation to link job to inbox email
export const linkJob = internalMutation({
    args: {
        emailId: v.id("inbox"),
        jobId: v.id("jobs"),
    },
    handler: async (ctx, { emailId, jobId }) => {
        await ctx.db.patch(emailId, {
            jobId,
            status: "processed",
            processedAt: Date.now(),
        });
    },
});

// Public action to create inbox entry from webhook
export const createFromWebhookAction = action({
    args: {
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
            storageId: v.optional(v.string()),
        })),
        jobId: v.optional(v.id("jobs")),
    },
    handler: async (ctx, args): Promise<Id<"inbox">> => {
        return await ctx.runMutation(internal.inbox.createFromWebhook, args);
    },
});

// Public action to link job to inbox email
export const linkJobAction = action({
    args: {
        emailId: v.id("inbox"),
        jobId: v.id("jobs"),
    },
    handler: async (ctx, args) => {
        await ctx.runMutation(internal.inbox.linkJob, args);
    },
});

// Public action to check job link without authentication (for auto-processing)
export const checkJobLinkAction = action({
    args: { jobId: v.id("jobs") },
    handler: async (ctx, { jobId }): Promise<Doc<"inbox"> | null> => {
        return await ctx.runQuery(internal.inbox.checkJobLinkInternal, { jobId });
    },
});

