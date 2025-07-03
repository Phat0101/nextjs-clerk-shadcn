import { query } from "./_generated/server";

// Get dashboard stats for different user types
export const getDashboardStats = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
      
    if (!user) return null;

    if (user.role === "CLIENT") {
      // Stats for clients
      const totalJobs = await ctx.db
        .query("jobs")
        .withIndex("by_clientId", (q) => q.eq("clientId", user.clientId!))
        .collect();
        
      const completedJobs = totalJobs.filter(job => job.status === "COMPLETED");
      const inProgressJobs = totalJobs.filter(job => job.status === "IN_PROGRESS");
      const pendingJobs = totalJobs.filter(job => job.status === "RECEIVED");
      
      // Calculate financial metrics
      const totalCost = completedJobs.reduce((sum, job) => sum + job.totalPrice, 0);
      const averageCost = completedJobs.length > 0 ? Math.round(totalCost / completedJobs.length) : 0;
      
      // Calculate average completion time (in hours)
      let averageCompletionTime = 0;
      if (completedJobs.length > 0) {
        const totalCompletionTime = completedJobs.reduce((sum, job) => {
          // Calculate time from creation to completion (assuming completed jobs have completion timestamp)
          // For now, we'll estimate based on deadline vs creation time as a proxy
          const timeTaken = job.deadline - job._creationTime;
          return sum + Math.abs(timeTaken);
        }, 0);
        averageCompletionTime = Math.round(totalCompletionTime / (completedJobs.length * 60 * 60 * 1000)); // Convert to hours
      }
      
      return {
        userRole: user.role,
        totalJobs: totalJobs.length,
        completedJobs: completedJobs.length,
        inProgressJobs: inProgressJobs.length,
        pendingJobs: pendingJobs.length,
        totalCost,
        averageCost,
        averageCompletionTime,
      };
    }
    
    if (user.role === "COMPILER") {
      // Stats for compilers
      const myJobs = await ctx.db
        .query("jobs")
        .withIndex("by_compilerId", (q) => q.eq("compilerId", user._id))
        .collect();
        
      const availableJobs = await ctx.db
        .query("jobs")
        .withIndex("by_status", (q) => q.eq("status", "RECEIVED"))
        .collect();
        
      const completedJobs = myJobs.filter(job => job.status === "COMPLETED");
      const activeJobs = myJobs.filter(job => job.status === "IN_PROGRESS");
      
      // Get commission settings
      const settings = await ctx.db.query("systemSettings").collect();
      let compilerCommission = 70; // default
      
      const commissionSetting = settings.find(s => s.key === "compilerCommission");
      if (commissionSetting) {
        compilerCommission = commissionSetting.value;
      }
      
      // Calculate earnings with commission (only for completed jobs)
      const totalEarned = completedJobs.reduce((sum, job) => {
        return sum + Math.round((job.totalPrice * compilerCommission) / 100);
      }, 0);
      
      return {
        userRole: user.role,
        totalEarned,
        completedJobs: completedJobs.length,
        activeJobs: activeJobs.length,
        availableJobs: availableJobs.length,
      };
    }
    
    if (user.role === "ADMIN") {
      // Stats for admins
      const allJobs = await ctx.db.query("jobs").collect();
      const allUsers = await ctx.db.query("users").collect();
      const allClients = await ctx.db.query("clients").collect();
      
      // Only calculate revenue from completed jobs
      const completedJobs = allJobs.filter(job => job.status === "COMPLETED");
      const inProgressJobs = allJobs.filter(job => job.status === "IN_PROGRESS");
      const pendingJobs = allJobs.filter(job => job.status === "RECEIVED");
      
      // Get commission settings
      const settings = await ctx.db.query("systemSettings").collect();
      let compilerCommission = 70; // default
      let companyCommission = 30; // default
      
      const compilerSetting = settings.find(s => s.key === "compilerCommission");
      const companySetting = settings.find(s => s.key === "companyCommission");
      
      if (compilerSetting) compilerCommission = compilerSetting.value;
      if (companySetting) companyCommission = companySetting.value;
      
      // Calculate revenue breakdown
      const grossRevenue = completedJobs.reduce((sum, job) => sum + job.totalPrice, 0); // Total paid by clients
      const compilerRevenue = completedJobs.reduce((sum, job) => {
        return sum + Math.round((job.totalPrice * compilerCommission) / 100);
      }, 0);
      const companyRevenue = completedJobs.reduce((sum, job) => {
        return sum + Math.round((job.totalPrice * companyCommission) / 100);
      }, 0); // Net revenue after paying compilers
      
      // Calculate averages (only based on completed jobs)
      const averageJobValue = completedJobs.length > 0 ? Math.round(grossRevenue / completedJobs.length) : 0;
      const averageCompanyRevenue = completedJobs.length > 0 ? Math.round(companyRevenue / completedJobs.length) : 0;
      
      return {
        userRole: user.role,
        totalJobs: allJobs.length,
        completedJobs: completedJobs.length,
        inProgressJobs: inProgressJobs.length,
        pendingJobs: pendingJobs.length,
        totalUsers: allUsers.length,
        totalClients: allClients.length,
        grossRevenue, // Total revenue from all completed jobs (what clients paid)
        companyRevenue, // Net revenue for company (after paying compiler commissions)
        compilerRevenue, // Total paid to compilers
        averageJobValue, // Average gross value per completed job
        averageCompanyRevenue, // Average net revenue per completed job for company
        compilerCommission,
        companyCommission,
      };
    }
    
    return { userRole: user.role };
  },
});
