import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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
  },
  handler: async (ctx, { name, description, amount, currency }) => {
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
    isActive: v.boolean(),
  },
  handler: async (ctx, { id, name, description, amount, currency, isActive }) => {
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