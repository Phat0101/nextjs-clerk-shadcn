import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get current user details from the DB
export const getCurrent = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
  },
});

// Create user if they don't exist (called from frontend)
export const ensureUser = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (existingUser) return existingUser;

    // Create client first
    const clientId = await ctx.db.insert("clients", { 
      name: `${identity.name || identity.email} Company PTY LTD` 
    });
    
    // Create user
    const userId = await ctx.db.insert("users", {
      clerkId: identity.subject,
      email: identity.email || "",
      name: identity.name || identity.email || "User",
      role: "CLIENT", // Default role
      clientId,
    });
    
    return await ctx.db.get(userId);
  },
});

// Update user role (for testing - allows self role change)
export const updateRole = mutation({
  args: { 
    userId: v.id("users"), 
    role: v.union(v.literal("CLIENT"), v.literal("COMPILER"), v.literal("ADMIN"))
  },
  handler: async (ctx, { userId, role }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
      
    if (!currentUser) {
      throw new Error("User not found");
    }
    
    // For testing: allow users to change their own role
    if (currentUser._id !== userId && currentUser.role !== "ADMIN") {
      throw new Error("Can only change your own role (unless you're an admin)");
    }
    
    await ctx.db.patch(userId, { role });
  },
});

// Get all users (for testing - open to all authenticated users)
export const getAll = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
      
    if (!currentUser) {
      throw new Error("User not found");
    }
    
    // For testing: allow all users to see user list
    return await ctx.db.query("users").collect();
  },
}); 