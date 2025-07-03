import { mutation } from "./_generated/server";

// Seed function to create default price units - run this once in Convex dashboard
export const seedDefaultPriceUnits = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
      
    if (!user || user.role !== "ADMIN") {
      throw new Error("Only admins can seed data");
    }

    // Check if price units already exist
    const existingUnits = await ctx.db.query("priceUnits").collect();
    if (existingUnits.length > 0) {
      return "Price units already exist";
    }

    // Create default price units
    await ctx.db.insert("priceUnits", {
      name: "Standard Document Processing",
      description: "Basic document data extraction service for invoices and forms",
      amount: 3500, // $35.00 AUD
      currency: "AUD",
      isActive: true,
      createdBy: user._id,
    });

    await ctx.db.insert("priceUnits", {
      name: "Premium Document Processing", 
      description: "Advanced document processing with detailed field extraction",
      amount: 5000, // $50.00 AUD
      currency: "AUD",
      isActive: true,
      createdBy: user._id,
    });

    await ctx.db.insert("priceUnits", {
      name: "Bulk Document Processing",
      description: "Cost-effective processing for large volumes (10+ documents)",
      amount: 2500, // $25.00 AUD
      currency: "AUD", 
      isActive: true,
      createdBy: user._id,
    });

    return "Successfully created default price units";
  },
}); 