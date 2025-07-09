import { fetchAction } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { NextRequest, NextResponse } from "next/server";
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const runtime = "nodejs";

const supplierExtractionSchema = z.object({
  supplier: z.string().nullable().describe('The supplier/company name from the invoice header'),
});

export async function POST(req: NextRequest) {
  let jobId: string | undefined;
  
  try {
    const requestBody = await req.json();
    jobId = requestBody.jobId;
    
    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    console.log("Auto-processing invoice job:", jobId);

    // Get job details using the internal query via action
    let jobDetails = null;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!jobDetails && attempts < maxAttempts) {
      try {
        // Use the internal query via action to bypass auth
        jobDetails = await fetchAction(api.jobs.getJobDetailsForAutoProcessing, { jobId: jobId as Id<"jobs"> });
        if (jobDetails) break;
      } catch (error) {
        console.log(`Attempt ${attempts + 1} failed to fetch job:`, error);
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        const delay = Math.pow(2, attempts) * 1000; // 2s, 4s, 8s, 16s, 32s
        console.log(`Job not found, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    if (!jobDetails) {
      console.error("Job not found after retries:", jobId);
      return NextResponse.json({ error: "Job not found after retries" }, { status: 404 });
    }

    console.log("Job details found:", { 
      jobId, 
      status: jobDetails.job.status, 
      filesCount: jobDetails.files?.length || 0 
    });

    // Mark job as in progress using the action that bypasses auth
    await fetchAction(api.jobs.updateCompilerStepForAutoProcessing, {
      jobId: jobId as Id<"jobs">,
      step: "selecting",
      status: "IN_PROGRESS",
    });

    console.log("Auto mark job as analyzing");
    // Get file URLs for processing
    const fileUrls = (jobDetails.files as any[])
      .map(f => f.fileUrl)
      .filter(Boolean) as string[];

    if (fileUrls.length === 0) {
      throw new Error("No files found for processing");
    }

    // Step 1: Extract supplier name from documents
    const supplierResult = await extractSupplierName(fileUrls);
    if (!supplierResult.supplier) {
      console.log("Could not extract supplier name, marking for manual processing");
      await markJobForManualProcessing(jobId);
      return NextResponse.json({ 
        success: true, 
        action: "manual_processing",
        reason: "Could not extract supplier name"
      });
    }

    await fetchAction(api.jobs.updateCompilerStepForAutoProcessing, {
      jobId: jobId as Id<"jobs">,
      step: "analyzing",
      status: "IN_PROGRESS",
    });

    console.log("Extracted supplier:", supplierResult.supplier);

    // Step 2: Match template
    const templates = await fetchAction(api.templates.matchTemplate, {
      supplier: supplierResult.supplier,
      clientName: jobDetails.client?.name,
    });

    if (!templates || templates.length === 0 || templates[0].score < 0.95) {
      console.log("No high-confidence template match, marking for manual processing");
      await markJobForManualProcessing(jobId);
      return NextResponse.json({ 
        success: true, 
        action: "manual_processing",
        reason: "No high-confidence template match",
        bestScore: templates?.[0]?.score || 0
      });
    }

    await fetchAction(api.jobs.updateCompilerStepForAutoProcessing, {
      jobId: jobId as Id<"jobs">,
      step: "extracting",
      status: "IN_PROGRESS",
    });

    const bestTemplate = templates[0];
    console.log("Found high-confidence template match:", bestTemplate.score);

    // Step 3: Auto-extract data using template
    const extractionResult = await extractInvoiceData(fileUrls, bestTemplate);

    await fetchAction(api.jobs.updateCompilerStepForAutoProcessing, {
      jobId: jobId as Id<"jobs">,
      step: "reviewing",
      status: "IN_PROGRESS",
    });
    
    // Step 4: Check processing mode and complete accordingly
    const processingMode = await fetchAction(api.systemSettings.getJobProcessingModeAction, {});
    
    if (processingMode === "auto-process") {
      // Complete job automatically
      await completeJobWithData(jobId, extractionResult, bestTemplate);
      
      return NextResponse.json({ 
        success: true, 
        action: "auto_completed",
        templateScore: bestTemplate.score,
        supplier: supplierResult.supplier
      });
    } else {
      // Save extracted data but leave for human review
      await saveExtractedDataForReview(jobId, extractionResult, bestTemplate);
      
      return NextResponse.json({ 
        success: true, 
        action: "ready_for_review",
        templateScore: bestTemplate.score,
        supplier: supplierResult.supplier
      });
    }

  } catch (error) {
    console.error("Auto-processing failed:", error);
    
    // Mark job for manual processing on error
    if (jobId) {
      try {
        await markJobForManualProcessing(jobId);
      } catch (e) {
        console.error("Failed to mark job for manual processing:", e);
      }
    }

    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Auto-processing failed",
      action: "manual_processing"
    }, { status: 500 });
  }
}

// Helper to extract supplier name from documents using LLM
async function extractSupplierName(fileUrls: string[]) {
  try {
    // Helper to detect images
    const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|bmp|webp)(\?|$)/i.test(url);

    // Prepare the content for the AI model
    const messageContent: Array<any> = [
      {
        type: 'text',
        text: `Extract the supplier/company name from the invoice document. Look for the company name in the header section that issued this invoice. Return the exact company name as it appears on the document.`
      }
    ];

    // Add each file to the message content
    fileUrls.forEach((url, index) => {
      if (isImageUrl(url)) {
        messageContent.push({
          type: 'image',
          image: new URL(url)
        });
      } else {
        messageContent.push({
          type: 'file',
          data: new URL(url),
          mimeType: 'application/pdf',
          filename: `invoice-${index + 1}.pdf`
        });
      }
    });

    const { object: result } = await generateObject({
      model: google('gemini-2.5-flash'),
      messages: [
        {
          role: 'user',
          content: messageContent,
        },
      ],
      schema: supplierExtractionSchema,
      temperature: 0.0,
    });

    return { supplier: result.supplier };
  } catch (error) {
    console.error('Error extracting supplier name:', error);
    return { supplier: null };
  }
}

// Helper to extract invoice data using template
async function extractInvoiceData(fileUrls: string[], template: any) {
  const response = await fetch(new URL("/api/extract/invoice", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileUrls,
      headerFields: template.headerFields,
      lineItemFields: template.lineItemFields,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to extract invoice data");
  }

  return await response.json();
}

// Helper to complete job with extracted data
async function completeJobWithData(jobId: string, extractionResult: any, template: any) {
  // Generate CSV from extracted data
  const csvResponse = await fetch(new URL("/api/export-csv", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: extractionResult.extractedData,
      jobTitle: `Auto-extracted Invoice`,
      fields: [...template.headerFields, ...template.lineItemFields],
    }),
  });

  if (!csvResponse.ok) {
    throw new Error("Failed to generate CSV");
  }

  const csvBlob = await csvResponse.blob();

  // Upload CSV to Convex storage
  const uploadUrl = await fetchAction(api.jobs.generateUploadUrlForAutoProcessing, {});
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "text/csv" },
    body: csvBlob,
  });

  if (!uploadResponse.ok) {
    throw new Error("Failed to upload CSV");
  }

  const { storageId } = await uploadResponse.json();

  // Auto-complete job using internal action that bypasses auth
  await fetchAction(api.jobs.autoCompleteJob, {
    jobId: jobId as Id<"jobs">,
    csvStorageId: storageId,
    headerFields: template.headerFields,
    lineItemFields: template.lineItemFields,
    extractedData: extractionResult.extractedData,
  });

  // Send completion email if this job is linked to an inbox email
  await sendCompletionEmailIfNeeded(jobId, storageId);
}

// Helper to mark job for manual processing
async function markJobForManualProcessing(jobId: string) {
  await fetchAction(api.jobs.updateCompilerStepForAutoProcessing, {
    jobId: jobId as Id<"jobs">,
    step: "selecting", // Reset to initial state for compiler pickup
    status: "RECEIVED", // Reset to initial status for compiler pickup
  });
}

// Helper to save extracted data for human review
async function saveExtractedDataForReview(jobId: string, extractionResult: any, template: any) {
  // Create analysisResult with template fields so compiler can see suggested fields
  const analysisResult = {
    headerFields: template.headerFields,
    lineItemFields: template.lineItemFields,
    documentType: 'Invoice',
    confidence: template.score || 1,
  };

  // Save the extracted data and analysis result to the job for later review
  await fetchAction(api.jobs.updateCompilerStepForAutoProcessing, {
    jobId: jobId as Id<"jobs">,
    step: "reviewing",
    status: "IN_PROGRESS", // Keep as IN_PROGRESS for compiler review
    analysisResult: analysisResult,
    extractedData: extractionResult.extractedData,
    supplierName: template.supplier,
    templateFound: true,
  });

  console.log("Extracted data and analysis result saved for human review");
}

// Helper to send completion email if job is linked to inbox email
async function sendCompletionEmailIfNeeded(jobId: string, csvStorageId: string) {
  try {
    console.log('🔍 Auto-processing: Checking if job is linked to inbox email:', jobId);
    
    // Get job details first for email context
    const jobDetails = await fetchAction(api.jobs.getJobDetailsForAutoProcessing, { jobId: jobId as Id<"jobs"> });
    
    if (!jobDetails) {
      console.log('❌ Auto-processing: Job details not found');
      return;
    }

    // Check if job is linked to an inbox email using internal action
    const linkedEmail = await fetchAction(api.inbox.checkJobLinkAction, { jobId: jobId as Id<"jobs"> });
    
    console.log('📧 Auto-processing: Linked email result:', linkedEmail ? 'Found' : 'Not found');
    
    if (linkedEmail) {
      console.log('✅ Auto-processing: Job is linked to inbox email, sending completion email to:', linkedEmail.from);
      
      // Send completion email
      const emailResponse = await fetch(new URL("/api/send-completion-email", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          csvStorageId,
          inboxEmailId: linkedEmail._id,
          recipientEmail: linkedEmail.from,
          recipientName: linkedEmail.fromName,
          subject: linkedEmail.subject,
          jobTitle: jobDetails.job.title,
        }),
      });
      
      if (emailResponse.ok) {
        console.log('✅ Auto-processing: Completion email sent successfully for auto-completed job:', jobId);
      } else {
        console.error('❌ Auto-processing: Failed to send completion email:', emailResponse.statusText);
      }
    } else {
      console.log('ℹ️ Auto-processing: Job is not linked to any inbox email, skipping completion email');
    }
  } catch (error) {
    console.error('💥 Auto-processing: Error checking/sending completion email:', error);
    // Don't throw - email sending failure shouldn't break the auto-processing
  }
}
