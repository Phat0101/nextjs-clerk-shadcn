# Product Requirements Document (PRD): CompileFlow

## 1. Vision & Goal

To create a real-time, outcome-based outsourcing platform that directly connects businesses needing document data extraction with a network of skilled freelance "Compilers". We will begin with the niche of Australian Customs Brokerage invoice extraction, productizing a BPO service into a scalable, on-demand "pay-per-outcome" model with minimal administrative friction.

## 2. User Personas

| Persona          | Description                                                                     | Goals                                                                                              | Frustrations (with traditional methods)                                                                  |
| ---------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Client (Catherine)** | A logistics manager at an import company. Tech-savvy but time-poor.               | - Get accurate data from invoices quickly. <br>- Pay a predictable price per document. <br>- Track job progress without constant emails. | - Opaque BPO pricing (per hour, high retainers). <br>- Slow turnaround times. <br>- Lack of visibility. |
| **Compiler (Chris)**   | A freelance data entry specialist with customs experience. Wants flexible work. | - Find a steady stream of small jobs. <br>- Work from anywhere, on his own schedule. <br>- Get paid quickly.      | - Finding clients is difficult. <br>- Chasing payments. <br>- Inefficient workflows.                      |
| **Admin (Alex)**       | The platform founder/operator.                                                  | - Ensure a smooth-running marketplace. <br>- Manage roles and quality. <br>- Handle financials.      | - Manual intervention is a bottleneck. <br>- Lack of automated oversight tools.                          |

## 3. System Architecture & Tech Stack

*   **Framework**: Next.js 14 (App Router)
*   **Styling**: Tailwind CSS
*   **Backend & Database**: Convex (for real-time database, serverless functions, and file storage)
*   **Authentication**: Clerk (for user management, roles, and seamless integration)

## 4. Condensed Core Logic & Components

This section outlines the core implementation steps, condensing the logic from a BPO Task Tracker prototype and adapting it to the CompileFlow requirements.

### Prompt 1: Project Setup & Authentication

**Action:** Initialize a new Next.js 14 App Router project with TypeScript and Tailwind. Integrate Convex and Clerk. In `app/layout.tsx`, wrap the application with the necessary providers, using `<ConvexProviderWithClerk>` to connect Convex and Clerk. Ensure all pages require authentication by default. Create a simple header component that displays the user's name and a `<SignOutButton>`.

### Prompt 2: Convex Schema & User Sync

**Action:** Create the Convex schema and a Clerk webhook to synchronize user data.

**`convex/schema.ts`**
This schema defines the core data models for the platform.

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users are synced from Clerk
  users: defineTable({
    name: v.string(),
    email: v.string(),
    clerkId: v.string(),
    role: v.union(v.literal("CLIENT"), v.literal("COMPILER"), v.literal("ADMIN")),
    clientId: v.optional(v.id("clients")),
  }).index("by_clerkId", ["clerkId"]),

  // Clients group users from the same company
  clients: defineTable({
    name: v.string(),
  }),

  // Jobs are the core unit of work
  jobs: defineTable({
    title: v.string(),
    status: v.union(v.literal("RECEIVED"), v.literal("IN_PROGRESS"), v.literal("COMPLETED")),
    clientId: v.id("clients"),
    compilerId: v.optional(v.id("users")),
    price: v.number(), // in cents
    sourceFileStorageId: v.string(),
    outputFileUrl: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_compilerId", ["compilerId"])
    .index("by_clientId", ["clientId"]),
});
```

**`convex/http.ts`**
This file configures an HTTP endpoint to handle the Clerk webhook for user creation and updates.

```typescript
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { Webhook } from "svix";
import { WebhookEvent } from "@clerk/nextjs/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/clerk",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Webhook validation logic...
    const event = await //... validate request
    
    // User sync logic
    switch (event.type) {
      case "user.created":
      case "user.updated": {
        await ctx.runMutation(internal.users.upsert, {
          clerkId: event.data.id,
          email: event.data.email_addresses[0]?.email_address,
          name: event.data.first_name || event.data.email_addresses[0]?.email_address,
        });
        break;
      }
    }
    return new Response(null, { status: 200 });
  }),
});

export default http;
```

**`convex/users.ts`**
This internal mutation handles creating or updating users from the webhook.

```typescript
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Get current user details from the DB
export const getCurrent = internalQuery({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
  },
});

// Create/update user from Clerk webhook
export const upsert = internalMutation({
    args: { clerkId: v.string(), email: v.string(), name: v.string() },
    handler: async (ctx, { clerkId, email, name }) => {
        const existingUser = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
            .unique();

        if (existingUser) {
            await ctx.db.patch(existingUser._id, { email, name });
        } else {
            // For new users, create a corresponding Client company
            const clientId = await ctx.db.insert("clients", { name: `${name}'s Company` });
            await ctx.db.insert("users", {
                clerkId,
                email,
                name,
                role: "CLIENT", // Default role
                clientId,
            });
        }
    },
});
```

### Prompt 3: The Main Dashboard with Role-Based Views

**Action:** Create a main dashboard at `app/dashboard/page.tsx` that conditionally renders views based on the user's role.

**`app/dashboard/page.tsx`**
This component fetches the user's role and displays the appropriate dashboard.

```typescript
"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// Simplified Dashboard Components
const CompilerDashboard = () => {
    const availableJobs = useQuery(api.jobs.getAvailable);
    const myActiveJobs = useQuery(api.jobs.getMyActive);
    // ... JSX to render two lists of JobCards
    return <div>Compiler Dashboard</div>
};

const ClientDashboard = () => {
    const jobs = useQuery(api.jobs.getForClient);
    // ... JSX to render Kanban board with columns
    return <div>Client Dashboard</div>
};

export default function DashboardPage() {
  const currentUser = useQuery(api.users.getCurrent);

  if (currentUser === undefined) return <div>Loading...</div>;
  if (!currentUser) return <div>User not found.</div>;

  if (currentUser.role === "COMPILER") return <CompilerDashboard />;
  if (currentUser.role === "CLIENT") return <ClientDashboard />;
  
  return <div>Admin Dashboard</div>;
}
```

**`convex/jobs.ts` (Queries)**
Queries to power the role-based dashboards.

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

// For Compilers: Fetch jobs that are available to be taken
export const getAvailable = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "RECEIVED"))
      .collect();
  },
});

// For Compilers: Fetch jobs they are currently working on
export const getMyActive = query({
  handler: async (ctx) => {
    const user = await ctx.runQuery(api.users.getCurrent);
    if (!user) return [];
    
    return await ctx.db
      .query("jobs")
      .withIndex("by_compilerId", (q) => q.eq("compilerId", user._id))
      .filter((q) => q.eq(q.field("status"), "IN_PROGRESS"))
      .collect();
  },
});

// For Clients: Fetch all jobs associated with their company
export const getForClient = query({
    handler: async (ctx) => {
        const user = await ctx.runQuery(api.users.getCurrent);
        if (!user || !user.clientId) return [];

        return await ctx.db
            .query("jobs")
            .withIndex("by_clientId", (q) => q.eq("clientId", user.clientId))
            .collect();
    }
});
```

### Prompt 4: Job Action Mutations

**Action:** Create Convex mutations to handle job state transitions.

**`convex/jobs.ts` (Mutations)**
These mutations manage the lifecycle of a job.

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Called by a Compiler to claim an available job
export const acceptJob = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const user = await ctx.runQuery(api.users.getCurrent);
    if (!user || user.role !== "COMPILER") throw new Error("Unauthorized");
    
    const job = await ctx.db.get(jobId);
    if (!job || job.status !== "RECEIVED") throw new Error("Job not available");

    await ctx.db.patch(jobId, {
      status: "IN_PROGRESS",
      compilerId: user._id,
    });
  },
});

// Called by a Compiler to submit their work
export const completeJob = mutation({
  args: { jobId: v.id("jobs"), outputFileUrl: v.string() },
  handler: async (ctx, { jobId, outputFileUrl }) => {
    const user = await ctx.runQuery(api.users.getCurrent);
    if (!user) throw new Error("Unauthorized");

    const job = await ctx.db.get(jobId);
    if (!job || job.compilerId !== user._id) throw new Error("Not your job");

    await ctx.db.patch(jobId, {
      status: "COMPLETED",
      outputFileUrl: outputFileUrl,
    });
  },
});
```

### Prompt 5: Client's Job Creation Page & File Upload

**Action:** Build a form for Clients to upload a file and create a new job.

**`convex/jobs.ts` (File Upload & Creation)**
Mutations to handle file uploads and the final job creation.

```typescript
// 1. Generate a short-lived URL for the client to upload a file to
export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

// 2. Create the job record after the file is uploaded
export const createJob = mutation({
  args: { title: v.string(), sourceFileStorageId: v.string() },
  handler: async (ctx, { title, sourceFileStorageId }) => {
    const user = await ctx.runQuery(api.users.getCurrent);
    if (!user || !user.clientId) throw new Error("Client not found");

    await ctx.db.insert("jobs", {
      title,
      sourceFileStorageId,
      clientId: user.clientId,
      status: "RECEIVED",
      price: 3500, // Default price in cents ($35.00)
    });
  },
});
```

### Prompt 6: The Compiler's "Work View" Page

**Action:** Create a dynamic page for a Compiler to view a job's source file and complete the work.

**`app/jobs/[jobId]/page.tsx`**
The UI for a compiler to perform their task.

```typescript
"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export default function JobWorkPage({ params }: { params: { jobId: Id<"jobs"> } }) {
  const jobDetails = useQuery(api.jobs.getDetails, { jobId: params.jobId });
  // const completeJob = useMutation(api.jobs.completeJob);

  if (!jobDetails) return <div>Loading or unauthorized...</div>;

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ flex: 1, borderRight: '1px solid #ccc' }}>
        {/* The iframe displays the source document for the compiler to work from */}
        <iframe src={jobDetails.sourceFileUrl} width="100%" height="100%" />
      </div>
      <div style={{ flex: 1, padding: '20px' }}>
        <h2>{jobDetails.job.title}</h2>
        {/* The form where the compiler inputs the extracted data */}
        <form onSubmit={() => { /* ... call completeJob mutation ... */ }}>
          {/* ... form fields for data extraction ... */}
          <button type="submit">Mark as Complete</button>
        </form>
      </div>
    </div>
  );
}
```

**`convex/jobs.ts` (Details Query)**
A secure query to fetch job details, including the private source file URL.

```typescript
export const getDetails = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const user = await ctx.runQuery(api.users.getCurrent);
    if (!user) return null;

    const job = await ctx.db.get(jobId);
    if (!job) return null;

    // Security check: Only the assigned compiler or an admin can view the job
    if (user.role !== "ADMIN" && job.compilerId !== user._id) {
      return null;
    }
    
    const sourceFileUrl = await ctx.storage.getUrl(job.sourceFileStorageId);
    if (!sourceFileUrl) return null;

    return { job, sourceFileUrl };
  },
});
```