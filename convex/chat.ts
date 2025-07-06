import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const addMessage = mutation({
  args: {
    jobId: v.id("jobs"),
    message: v.any(),
  },
  handler: async (ctx, { jobId, message }) => {
    await ctx.db.insert("chatMessages", {
      jobId,
      message,
      role: message.role ?? undefined,
      content: typeof message.content === "string" ? message.content : undefined,
      createdAt: Date.now(),
    });
  },
});

export const getForJob = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const rows = await ctx.db
      .query("chatMessages")
      .withIndex("by_jobId", (q) => q.eq("jobId", jobId))
      .order("asc")
      .collect();
    return rows.map((r) => r.message);
  },
}); 