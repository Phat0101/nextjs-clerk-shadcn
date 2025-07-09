import { query, mutation, internalMutation, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Get all active price units (available to clients)
export const getActive = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("priceUnits")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

// Get all price units (admin only)
export const getAll = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
      
    if (!currentUser || currentUser.role !== "ADMIN") {
      throw new Error("Only admins can view all price units");
    }
    
    return await ctx.db.query("priceUnits").collect();
  },
});

// Create a new price unit (admin only)
export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    amount: v.number(),
    currency: v.string(),
    jobType: v.union(
      v.literal("INVOICE"),
      v.literal("SHIPMENT"),
      v.literal("N10")
    ),
  },
  handler: async (ctx, { name, description, amount, currency, jobType }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
      
    if (!currentUser || currentUser.role !== "ADMIN") {
      throw new Error("Only admins can create price units");
    }
    
    return await ctx.db.insert("priceUnits", {
      name,
      description,
      amount,
      currency,
      jobType,
      isActive: true,
      createdBy: currentUser._id,
    });
  },
});

// Update a price unit (admin only)
export const update = mutation({
  args: {
    id: v.id("priceUnits"),
    name: v.string(),
    description: v.string(),
    amount: v.number(),
    currency: v.string(),
    jobType: v.union(
      v.literal("INVOICE"),
      v.literal("SHIPMENT"),
      v.literal("N10")
    ),
    isActive: v.boolean(),
  },
  handler: async (ctx, { id, name, description, amount, currency, jobType, isActive }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
      
    if (!currentUser || currentUser.role !== "ADMIN") {
      throw new Error("Only admins can update price units");
    }
    
    await ctx.db.patch(id, {
      name,
      description,
      amount,
      currency,
      jobType,
      isActive,
    });
  },
});

// Delete a price unit (admin only)
export const remove = mutation({
  args: { id: v.id("priceUnits") },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
      
    if (!currentUser || currentUser.role !== "ADMIN") {
      throw new Error("Only admins can delete price units");
    }
    
    await ctx.db.delete(id);
  },
});

// Get a specific price unit by ID
export const getById = query({
  args: { id: v.id("priceUnits") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

// Get or create $0 price unit for webhook processing (internal)
export const getOrCreateWebhookPriceUnit = internalMutation({
  args: { 
    jobType: v.union(
      v.literal("INVOICE"),
      v.literal("SHIPMENT"),
      v.literal("N10")
    ),
    systemUserId: v.id("users"), // System user to assign as creator
  },
  handler: async (ctx, { jobType, systemUserId }) => {
    // Look for existing $0 price unit for this job type
    const existingUnit = await ctx.db
      .query("priceUnits")
      .filter((q) => 
        q.and(
          q.eq(q.field("jobType"), jobType),
          q.eq(q.field("amount"), 0),
          q.eq(q.field("isActive"), true)
        )
      )
      .first();
    
    if (existingUnit) {
      return existingUnit._id;
    }

    // Create new $0 price unit
    const priceUnitId = await ctx.db.insert("priceUnits", {
      name: `Email ${jobType} Processing (Free)`,
      description: `Automated ${jobType.toLowerCase()} processing from email - no charge`,
      amount: 0, // $0.00
      currency: "AUD",
      jobType,
      isActive: true,
      createdBy: systemUserId,
    });
    
    return priceUnitId;
  },
});

// Find system user or create one (internal)
export const getOrCreateSystemUser = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Look for existing system user
    const systemUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), "system@webhook.internal"))
      .first();
    
    if (systemUser) {
      return systemUser._id;
    }

    // Create system client first
    const clientId = await ctx.db.insert("clients", { 
      name: "System Webhook Client" 
    });
    
    // Create system user
    const userId = await ctx.db.insert("users", {
      clerkId: "system:webhook:internal",
      email: "system@webhook.internal",
      name: "System Webhook User",
      role: "ADMIN", // Give admin role so it can create price units
      clientId,
    });
    
    return userId;
  },
});

// Public actions for webhook use
export const getOrCreateSystemUserAction = action({
  args: {},
  handler: async (ctx): Promise<Id<"users">> => {
    return await ctx.runMutation(internal.priceUnits.getOrCreateSystemUser, {});
  },
});

export const getOrCreateWebhookPriceUnitAction = action({
  args: { 
    jobType: v.union(
      v.literal("INVOICE"),
      v.literal("SHIPMENT"),
      v.literal("N10")
    ),
    systemUserId: v.id("users"),
  },
  handler: async (ctx, { jobType, systemUserId }): Promise<Id<"priceUnits">> => {
    return await ctx.runMutation(internal.priceUnits.getOrCreateWebhookPriceUnit, { jobType, systemUserId });
  },
}); 