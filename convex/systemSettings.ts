import { v } from "convex/values";
import { mutation, query, internalQuery, action } from "./_generated/server";
import { internal } from "./_generated/api";

// Get commission settings
export const getCommissionSettings = query({
  handler: async (ctx) => {
    const settings = await ctx.db.query("systemSettings").collect();
    
    // Default settings if none exist
    const defaults = {
      compilerCommission: 70,
      companyCommission: 30,
    };

    const result: Record<string, number> = { ...defaults };
    
    settings.forEach(setting => {
      result[setting.key] = setting.value;
    });

    return result;
  },
});

// Get job processing mode setting
export const getJobProcessingMode = query({
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("systemSettings")
      .withIndex("by_key", (q) => q.eq("key", "jobProcessingMode"))
      .unique();
    
    // Default to "require-human-review" if not set
    return setting?.value === 1 ? "auto-process" : "require-human-review";
  },
});

// Internal version for use in actions
export const _getJobProcessingModeInternal = internalQuery({
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("systemSettings")
      .withIndex("by_key", (q) => q.eq("key", "jobProcessingMode"))
      .unique();
    
    // Default to "require-human-review" if not set
    return setting?.value === 1 ? "auto-process" : "require-human-review";
  },
});

// Action wrapper for getting processing mode (for use from server routes)
export const getJobProcessingModeAction = action({
  args: {},
  handler: async (ctx): Promise<"auto-process" | "require-human-review"> => {
    return await ctx.runQuery(internal.systemSettings._getJobProcessingModeInternal, {});
  },
});

// Update job processing mode setting (admin only)
export const updateJobProcessingMode = mutation({
  args: { 
    mode: v.union(v.literal("auto-process"), v.literal("require-human-review")),
  },
  handler: async (ctx, { mode }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
      
    if (!user || user.role !== "ADMIN") throw new Error("Unauthorized");

    const value = mode === "auto-process" ? 1 : 0;
    const description = mode === "auto-process" 
      ? "Jobs with matching templates are automatically completed"
      : "Jobs require human review even after AI extraction";

    const existingSetting = await ctx.db
      .query("systemSettings")
      .withIndex("by_key", (q) => q.eq("key", "jobProcessingMode"))
      .unique();

    if (existingSetting) {
      await ctx.db.patch(existingSetting._id, {
        value,
        description,
        updatedBy: user._id,
      });
    } else {
      await ctx.db.insert("systemSettings", {
        key: "jobProcessingMode",
        value,
        description,
        updatedBy: user._id,
      });
    }
  },
});

// Update commission setting (admin only)
export const updateCommissionSetting = mutation({
  args: { 
    key: v.string(), 
    value: v.number(),
    description: v.string(),
  },
  handler: async (ctx, { key, value, description }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
      
    if (!user || user.role !== "ADMIN") throw new Error("Unauthorized");

    // Validate commission percentages
    if (key === "compilerCommission" || key === "companyCommission") {
      if (value < 0 || value > 100) {
        throw new Error("Commission percentage must be between 0 and 100");
      }
    }

    const existingSetting = await ctx.db
      .query("systemSettings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();

    if (existingSetting) {
      await ctx.db.patch(existingSetting._id, {
        value,
        description,
        updatedBy: user._id,
      });
    } else {
      await ctx.db.insert("systemSettings", {
        key,
        value,
        description,
        updatedBy: user._id,
      });
    }
  },
});

// Initialize default settings
export const initializeDefaultSettings = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
      
    if (!user || user.role !== "ADMIN") throw new Error("Unauthorized");

    const defaults = [
      {
        key: "compilerCommission",
        value: 70,
        description: "Percentage of job price that goes to the compiler",
      },
      {
        key: "companyCommission", 
        value: 30,
        description: "Percentage of job price that goes to the company",
      },
      {
        key: "jobProcessingMode",
        value: 0, // 0 = require-human-review, 1 = auto-process
        description: "Jobs require human review even after AI extraction",
      },
    ];

    for (const setting of defaults) {
      const existing = await ctx.db
        .query("systemSettings")
        .withIndex("by_key", (q) => q.eq("key", setting.key))
        .unique();

      if (!existing) {
        await ctx.db.insert("systemSettings", {
          ...setting,
          updatedBy: user._id,
        });
      }
    }
  },
}); 