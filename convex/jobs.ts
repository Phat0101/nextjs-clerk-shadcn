import { query, mutation, action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// For Compilers: Fetch jobs that are available to be taken with commission pricing
export const getAvailable = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
      
    if (!user || user.role !== "COMPILER") return [];
    
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "RECEIVED"))
      .collect();

    // Get commission settings
    const settings = await ctx.db.query("systemSettings").collect();
    let compilerCommission = 70; // default
    
    const commissionSetting = settings.find(s => s.key === "compilerCommission");
    if (commissionSetting) {
      compilerCommission = commissionSetting.value;
    }

    // Return jobs with compiler's cut of the price
    return jobs.map(job => ({
      ...job,
      compilerPrice: Math.round((job.totalPrice * compilerCommission) / 100),
    }));
  },
});

// For Compilers: Fetch jobs they are currently working on
export const getMyActive = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
      
    if (!user) return [];
    
    return await ctx.db
      .query("jobs")
      .withIndex("by_compilerId", (q) => q.eq("compilerId", user._id))
      .filter((q) => q.eq(q.field("status"), "IN_PROGRESS"))
      .collect();
  },
});

// For Clients: Fetch all jobs associated with their company with compiler info
export const getForClient = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
      
    if (!user || !user.clientId) return [];

    const jobs = (await ctx.db
      .query("jobs")
      .withIndex("by_clientId", (q) => q.eq("clientId", user.clientId!))
      .collect()).sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0));

    // Add compiler information for jobs that have been assigned
    const jobsWithCompilerInfo = await Promise.all(
      jobs.map(async (job) => {
        if (job.compilerId) {
          const compiler = await ctx.db.get(job.compilerId);
          return {
            ...job,
            compilerName: compiler?.name || "Unknown",
          };
        }
        return {
          ...job,
          compilerName: null,
        };
      })
    );

    return jobsWithCompilerInfo;
  },
});

// For Admins: Fetch all jobs in the system with compiler info
export const getAll = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
      
    if (!user || user.role !== "ADMIN") return [];

    const jobs = (await ctx.db
      .query("jobs")
      .collect()).sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0));

    // Add compiler information for jobs that have been assigned
    const jobsWithCompilerInfo = await Promise.all(
      jobs.map(async (job) => {
        if (job.compilerId) {
          const compiler = await ctx.db.get(job.compilerId);
          return {
            ...job,
            compilerName: compiler?.name || "Unknown",
          };
        }
        return {
          ...job,
          compilerName: null,
        };
      })
    );

    return jobsWithCompilerInfo;
  },
});

// Get job details with file URLs (for compilers working on the job)
export const getDetails = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
      
    if (!user) return null;

    const job = await ctx.db.get(jobId);
    if (!job) return null;

    // Security check: Only the assigned compiler, client, or an admin can view the job
    if (user.role !== "ADMIN" && 
        job.compilerId !== user._id && 
        (user.clientId && job.clientId !== user.clientId)) {
      return null;
    }
    
    // Get all files for this job
    const jobFiles = await ctx.db
      .query("jobFiles")
      .withIndex("by_jobId", (q) => q.eq("jobId", jobId))
      .collect();

    // Get file URLs
    const filesWithUrls = await Promise.all(
      jobFiles.map(async (file) => {
        const fileUrl = await ctx.storage.getUrl(file.fileStorageId);
        return {
          ...file,
          fileUrl,
        };
      })
    );

    // Fetch client info
    const client = await ctx.db.get(job.clientId);

    // Get price unit details
    const priceUnit = await ctx.db.get(job.priceUnitId);

    return { job, files: filesWithUrls, priceUnit, client };
  },
});

// Get files for a job with URLs
export const getJobFiles = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const jobFiles = await ctx.db
      .query("jobFiles")
      .withIndex("by_jobId", (q) => q.eq("jobId", jobId))
      .collect();

    // Get file URLs
    const filesWithUrls = await Promise.all(
      jobFiles.map(async (file) => {
        const fileUrl = await ctx.storage.getUrl(file.fileStorageId);
        return {
          ...file,
          fileUrl,
        };
      })
    );

    return filesWithUrls;
  },
});

// Generate upload URL for file upload
export const generateUploadUrl = mutation(async (ctx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  
  return await ctx.storage.generateUploadUrl();
});

// Create a new job with multiple files (for clients)
export const createJob = mutation({
  args: { 
    title: v.string(), 
    priceUnitId: v.id("priceUnits"),
    deadlineHours: v.number(),
    files: v.array(v.object({
      fileName: v.string(),
      fileStorageId: v.string(),
      fileSize: v.optional(v.number()),
      fileType: v.optional(v.string()),
      // Optional classification metadata – populated by the new split & classify pipeline
      documentType: v.optional(v.string()),
      pageNumbers: v.optional(v.array(v.number())),
      isCoreDocument: v.optional(v.boolean()),
    }))
  },
  handler: async (ctx, { title, priceUnitId, deadlineHours, files }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
      
    if (!user || !user.clientId) throw new Error("Client not found");

    // Get the price unit to calculate total price
    const priceUnit = await ctx.db.get(priceUnitId);
    if (!priceUnit || !priceUnit.isActive) {
      throw new Error("Invalid or inactive price unit");
    }

    // Calculate total price (flat rate per job)
    const totalPrice = priceUnit.amount;

    // Calculate deadline timestamp (current time + deadline hours)
    const deadline = Date.now() + (deadlineHours * 60 * 60 * 1000);

    // Create the job
    const jobId = await ctx.db.insert("jobs", {
      title,
      priceUnitId,
      totalPrice,
      clientId: user.clientId,
      status: "RECEIVED",
      deadline,
      deadlineHours,
    });
    
    // Create job file records
    for (const file of files) {
      await ctx.db.insert("jobFiles", {
        jobId,
        fileName: file.fileName,
        fileStorageId: file.fileStorageId,
        fileSize: file.fileSize,
        fileType: file.fileType,
        documentType: file.documentType,
        pageNumbers: file.pageNumbers,
        isCoreDocument: file.isCoreDocument,
      });
    }
    
    return jobId;
  },
});

// Called by a Compiler to claim an available job
export const acceptJob = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
      
    if (!user || user.role !== "COMPILER") throw new Error("Unauthorized");
    
    const job = await ctx.db.get(jobId);
    if (!job || job.status !== "RECEIVED") throw new Error("Job not available");

    await ctx.db.patch(jobId, {
      status: "IN_PROGRESS",
      compilerId: user._id,
    });
  },
});

// Called by a Compiler to submit their work
export const completeJob = mutation({
  args: {
    jobId: v.id("jobs"),
    csvStorageId: v.string(),
    headerFields: v.optional(v.array(v.any())),
    lineItemFields: v.optional(v.array(v.any())),
    extractedData: v.any(),
  },
  handler: async (ctx, { jobId, csvStorageId, headerFields, lineItemFields, extractedData }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
      
    if (!user) throw new Error("User not found");

    const job = await ctx.db.get(jobId);
    if (!job || job.compilerId !== user._id) throw new Error("Not your job");

    // Store the job output record
    await ctx.db.insert("jobOutputs", {
      jobId,
      csvStorageId,
      headerFields,
      lineItemFields,
      extractedData,
    });

    // Generate a public URL for the CSV file to store on the job record for easy download
    const csvUrl = (await ctx.storage.getUrl(csvStorageId)) ?? "";

    await ctx.db.patch(jobId, {
      status: "COMPLETED",
      outputFileUrl: csvUrl,
      completedAt: Date.now(),
    });
  },
});

// Get job output (CSV url + extracted data) – accessible to the job's client, compiler, or an admin
export const getJobOutput = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) return null;

    const job = await ctx.db.get(jobId);
    if (!job) return null;

    const isAuthorized =
      user.role === "ADMIN" ||
      job.compilerId === user._id ||
      (user.clientId && job.clientId === user.clientId);

    if (!isAuthorized) return null;

    const output = await ctx.db
      .query("jobOutputs")
      .withIndex("by_jobId", (q) => q.eq("jobId", jobId))
      .unique();

    if (!output) return null;

    const csvUrl = (await ctx.storage.getUrl(output.csvStorageId)) ?? "";

    return {
      csvUrl,
      extractedData: output.extractedData,
      headerFields: output.headerFields,
      lineItemFields: output.lineItemFields,
    };
  },
});

// Admin only: Delete a job
export const deleteJob = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
      
    if (!user || user.role !== "ADMIN") throw new Error("Unauthorized");

    // Delete related job files first
    const jobFiles = await ctx.db
      .query("jobFiles")
      .withIndex("by_jobId", (q) => q.eq("jobId", jobId))
      .collect();
    
    for (const file of jobFiles) {
      await ctx.db.delete(file._id);
    }

    // Delete the job
    await ctx.db.delete(jobId);
  },
});

// Admin only: Update job deadline
export const updateJobDeadline = mutation({
  args: { jobId: v.id("jobs"), deadlineHours: v.number() },
  handler: async (ctx, { jobId, deadlineHours }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
      
    if (!user || user.role !== "ADMIN") throw new Error("Unauthorized");

    const job = await ctx.db.get(jobId);
    if (!job) throw new Error("Job not found");

    // Calculate new deadline from current time
    const deadline = Date.now() + (deadlineHours * 60 * 60 * 1000);

    await ctx.db.patch(jobId, {
      deadline,
      deadlineHours,
    });
  },
});

// For Compilers: Fetch completed jobs
export const getMyCompleted = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user || user.role !== "COMPILER") return [];

    return await ctx.db
      .query("jobs")
      .withIndex("by_compilerId", (q) => q.eq("compilerId", user._id))
      .filter((q) => q.eq(q.field("status"), "COMPLETED"))
      .collect();
  },
});

// Update compiler workflow step
export const updateCompilerStep = mutation({
  args: {
    jobId: v.id("jobs"),
    step: v.string(),
    analysisResult: v.optional(v.any()),
    confirmedFields: v.optional(v.array(v.any())),
    extractedData: v.optional(v.any()),
    shipmentRegistrationExtractedData: v.optional(v.any()),
    n10extractedData: v.optional(v.any()),
    supplierName: v.optional(v.string()),
    templateFound: v.optional(v.boolean()),
  },
  handler: async (ctx, { jobId, step, analysisResult, confirmedFields, extractedData, shipmentRegistrationExtractedData, n10extractedData, supplierName, templateFound }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const job = await ctx.db.get(jobId);
    if (!job || job.compilerId !== user._id) throw new Error("Not your job");

    await ctx.db.patch(jobId, {
      compilerStep: step,
      ...(analysisResult !== undefined ? { analysisResult } : {}),
      ...(confirmedFields !== undefined ? { confirmedFields } : {}),
      ...(extractedData !== undefined ? { extractedData } : {}),
      ...(shipmentRegistrationExtractedData !== undefined ? { shipmentRegistrationExtractedData } : {}),
      ...(n10extractedData !== undefined ? { n10extractedData } : {}),
      ...(supplierName !== undefined ? { supplierName } : {}),
      ...(templateFound !== undefined ? { templateFound } : {}),
    });
  },
});

// Append additional job files (used by classify pipeline)
export const addJobFiles = mutation({
  args: {
    jobId: v.id("jobs"),
    files: v.array(v.object({
      fileName: v.string(),
      fileStorageId: v.string(),
      fileSize: v.optional(v.number()),
      fileType: v.optional(v.string()),
      documentType: v.optional(v.string()),
      pageNumbers: v.optional(v.array(v.number())),
      isCoreDocument: v.optional(v.boolean()),
    })),
  },
  handler: async (ctx, { jobId, files }) => {
    // Ensure job exists
    const job = await ctx.db.get(jobId);
    if (!job) throw new Error("Job not found");

    // Insert each additional file
    for (const f of files) {
      await ctx.db.insert("jobFiles", {
        jobId,
        fileName: f.fileName,
        fileStorageId: f.fileStorageId,
        fileSize: f.fileSize,
        fileType: f.fileType,
        documentType: f.documentType,
        pageNumbers: f.pageNumbers,
        isCoreDocument: f.isCoreDocument,
      });
    }
  },
});

// Public action to save shipment registration extracted data (used by server-side agent where auth is unavailable)
export const saveShipmentRegistrationExtractedData = action({
  args: {
    jobId: v.id('jobs'),
    data: v.any(),
  },
  handler: async (ctx, { jobId, data }) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore internal path generated by Convex
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.runMutation((internal as any).jobs._saveShipmentRegistrationExtractedDataInternal, { jobId, data });
  },
});

// Public action to save N10 extracted data (used by server-side agent where auth is unavailable)
export const saveN10ExtractedData = action({
  args: {
    jobId: v.id('jobs'),
    data: v.any(),
  },
  handler: async (ctx, { jobId, data }) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore internal path generated by Convex
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.runMutation((internal as any).jobs._saveN10ExtractedDataInternal, { jobId, data });
  },
});

// Legacy action - kept for backward compatibility
export const saveExtractedData = action({
  args: {
    jobId: v.id('jobs'),
    data: v.any(),
  },
  handler: async (ctx, { jobId, data }) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore internal path generated by Convex
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.runMutation((internal as any).jobs._saveExtractedDataInternal, { jobId, data });
  },
});

// ---------------------------------------------------------------------------
// Incremental extraction support – merge partial data instead of overwriting
// ---------------------------------------------------------------------------

export const saveShipmentRegistrationExtractedDataPartial = action({
  args: {
    jobId: v.id('jobs'),
    partial: v.any(),
  },
  handler: async (ctx, { jobId, partial }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.runMutation((internal as any).jobs._mergeShipmentRegistrationExtractedDataInternal, { jobId, partial });
  },
});

export const saveN10ExtractedDataPartial = action({
  args: {
    jobId: v.id('jobs'),
    partial: v.any(),
  },
  handler: async (ctx, { jobId, partial }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.runMutation((internal as any).jobs._mergeN10ExtractedDataInternal, { jobId, partial });
  },
});

// Legacy action - kept for backward compatibility
export const saveExtractedDataPartial = action({
  args: {
    jobId: v.id('jobs'),
    partial: v.any(),
  },
  handler: async (ctx, { jobId, partial }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.runMutation((internal as any).jobs._mergeExtractedDataInternal, { jobId, partial });
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(target: any, source: any): any {
  if (typeof target !== 'object' || target === null) return source;
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = deepMerge(target[key] ?? {}, source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const _mergeShipmentRegistrationExtractedDataInternal = internalMutation({
  args: {
    jobId: v.id('jobs'),
    partial: v.any(),
  },
  handler: async (ctx, { jobId, partial }) => {
    const job = await ctx.db.get(jobId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current = (job?.shipmentRegistrationExtractedData as any) ?? {};
    const merged = deepMerge(current, partial);
    await ctx.db.patch(jobId, { shipmentRegistrationExtractedData: merged });
  },
});

// Internal mutation actually writing the shipment registration data (no auth, internal only)
export const _saveShipmentRegistrationExtractedDataInternal = internalMutation({
  args: {
    jobId: v.id('jobs'),
    data: v.any(),
  },
  handler: async (ctx, { jobId, data }) => {
    await ctx.db.patch(jobId, { shipmentRegistrationExtractedData: data });
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const _mergeN10ExtractedDataInternal = internalMutation({
  args: {
    jobId: v.id('jobs'),
    partial: v.any(),
  },
  handler: async (ctx, { jobId, partial }) => {
    const job = await ctx.db.get(jobId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current = (job?.n10extractedData as any) ?? {};
    const merged = deepMerge(current, partial);
    await ctx.db.patch(jobId, { n10extractedData: merged });
  },
});

// Internal mutation actually writing the N10 data (no auth, internal only)
export const _saveN10ExtractedDataInternal = internalMutation({
  args: {
    jobId: v.id('jobs'),
    data: v.any(),
  },
  handler: async (ctx, { jobId, data }) => {
    await ctx.db.patch(jobId, { n10extractedData: data });
  },
});

// Legacy internal mutations - kept for backward compatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const _mergeExtractedDataInternal = internalMutation({
  args: {
    jobId: v.id('jobs'),
    partial: v.any(),
  },
  handler: async (ctx, { jobId, partial }) => {
    const job = await ctx.db.get(jobId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current = (job?.extractedData as any) ?? {};
    const merged = deepMerge(current, partial);
    await ctx.db.patch(jobId, { extractedData: merged });
  },
});

// Internal mutation actually writing the data (no auth, internal only)
export const _saveExtractedDataInternal = internalMutation({
  args: {
    jobId: v.id('jobs'),
    data: v.any(),
  },
  handler: async (ctx, { jobId, data }) => {
    await ctx.db.patch(jobId, { extractedData: data });
  },
}); 