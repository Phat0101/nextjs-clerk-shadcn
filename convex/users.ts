import { query, mutation, internalQuery, internalMutation, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";

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

// Find user by email address (internal, used by webhooks)
export const findByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), email))
      .first();
  },
});

// Create user by email for webhook processing (internal)
export const createFromEmail = internalMutation({
  args: { 
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { email, name }) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), email))
      .first();
    
    if (existingUser) {
      return existingUser;
    }

    // Create client first
    const clientId = await ctx.db.insert("clients", { 
      name: `${name || email} Company PTY LTD` 
    });
    
    // Create user with a dummy clerkId since this comes from email
    const userId = await ctx.db.insert("users", {
      clerkId: `email:${email}:${Date.now()}`, // Unique identifier for email-created users
      email,
      name: name || email.split('@')[0], // Use email prefix as name if no name provided
      role: "CLIENT", // Default role
      clientId,
    });
    
    return await ctx.db.get(userId);
  },
});

// Public actions for webhook use
export const findByEmailAction = action({
  args: { email: v.string() },
  handler: async (ctx, { email }): Promise<Doc<"users"> | null> => {
    return await ctx.runQuery(internal.users.findByEmail, { email });
  },
});

export const createFromEmailAction = action({
  args: { 
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { email, name }): Promise<Doc<"users"> | null> => {
    return await ctx.runMutation(internal.users.createFromEmail, { email, name });
  },
}); 