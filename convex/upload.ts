import { action } from "./_generated/server";
import { v } from "convex/values";

export const generateUploadUrl = action({
  args: {},
  handler: async (ctx) => {
    // Allows both authenticated and unauthenticated uploads (used by server pipeline)
    return await ctx.storage.generateUploadUrl();
  },
});

export const getPublicUrl = action({
  args: { storageId: v.string() },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
}); 