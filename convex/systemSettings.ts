import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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