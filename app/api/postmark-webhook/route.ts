import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Postmark webhook interface
interface PostmarkAttachment {
  Name: string;
  Content: string; // base64 encoded
  ContentType: string;
  ContentLength: number;
}

interface PostmarkInboundEmail {
  From: string;
  FromName: string;
  To: string;
  ToFull: Array<{
    Email: string;
    Name: string;
    MailboxHash: string;
  }>;
  Subject: string;
  TextBody: string;
  HtmlBody: string;
  MessageID: string;
  Date: string;
  Attachments: PostmarkAttachment[];
}

export async function POST(request: NextRequest) {
  try {
    // Parse the incoming webhook data
    const webhookData: PostmarkInboundEmail = await request.json();
    
    console.log('Received Postmark webhook:', {
      from: webhookData.From,
      to: webhookData.To,
      subject: webhookData.Subject,
      attachmentCount: webhookData.Attachments?.length || 0
    });

    // Parse the recipient email to determine job type
    const recipientInfo = webhookData.ToFull?.[0];
    if (!recipientInfo) {
      console.error('No recipient information found');
      return NextResponse.json({ error: 'No recipient found' }, { status: 400 });
    }

    const mailboxHash = recipientInfo.MailboxHash.toLowerCase();
    let jobType: "INVOICE" | "SHIPMENT" | "N10";
    
    if (mailboxHash.includes('invoice')) {
      jobType = 'INVOICE';
    } else if (mailboxHash.includes('shipment')) {
      jobType = 'SHIPMENT';
    } else if (mailboxHash.includes('n10')) {
      jobType = 'N10';
    } else {
      console.error('No mailbox hash found', mailboxHash);
      return NextResponse.json({ error: 'No mailbox hash found' }, { status: 200 });
    }

    // Check if there are attachments
    if (!webhookData.Attachments || webhookData.Attachments.length === 0) {
      console.error('No attachments found in email');
      return NextResponse.json({ error: 'No attachments found' }, { status: 400 });
    }

    // Find or create user by email
    let user = await convex.action(api.users.findByEmailAction, { email: webhookData.From });
    if (!user) {
      user = await convex.action(api.users.createFromEmailAction, { 
        email: webhookData.From,
        name: webhookData.FromName || undefined
      });
    }

    if (!user || !user.clientId) {
      console.error('Failed to create or find user');
      return NextResponse.json({ error: 'User creation failed' }, { status: 500 });
    }

    // Get or create system user for price units
    const systemUserId = await convex.action(api.priceUnits.getOrCreateSystemUserAction, {});
    
    // Get or create $0 price unit for this job type
    const priceUnitId = await convex.action(api.priceUnits.getOrCreateWebhookPriceUnitAction, {
      jobType,
      systemUserId
    });

    // Upload attachments to Convex storage
    const uploadedFiles = [];
    
    for (const attachment of webhookData.Attachments) {
      try {
        // Get upload URL from Convex
        const uploadUrl = await convex.action(api.jobs.generateUploadUrlForAutoProcessing, {});
        
        // Convert base64 to blob
        const base64Data = attachment.Content;
        const binaryData = Buffer.from(base64Data, 'base64');
        
        // Upload to Convex
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': attachment.ContentType
          },
          body: binaryData
        });

        if (!uploadResponse.ok) {
          console.error('Failed to upload attachment:', attachment.Name);
          continue;
        }

        const { storageId } = await uploadResponse.json();
        
        uploadedFiles.push({
          fileName: attachment.Name,
          fileStorageId: storageId,
          fileSize: attachment.ContentLength,
          fileType: attachment.ContentType,
        });

        console.log('Successfully uploaded attachment:', attachment.Name);
      } catch (error) {
        console.error('Error uploading attachment:', attachment.Name, error);
        // Continue with other attachments
      }
    }

    if (uploadedFiles.length === 0) {
      console.error('No attachments were successfully uploaded');
      return NextResponse.json({ error: 'Failed to upload attachments' }, { status: 500 });
    }

    // Save email to inbox first
    const emailId = await convex.action(api.inbox.createFromWebhookAction, {
      from: webhookData.From,
      fromName: webhookData.FromName,
      to: webhookData.To,
      toFull: webhookData.ToFull.map(tf => ({
        email: tf.Email,
        name: tf.Name,
        mailboxHash: tf.MailboxHash,
      })),
      subject: webhookData.Subject,
      textBody: webhookData.TextBody,
      htmlBody: webhookData.HtmlBody,
      messageId: webhookData.MessageID,
      date: webhookData.Date,
      attachments: uploadedFiles.map(file => ({
        name: file.fileName,
        contentType: file.fileType || 'application/octet-stream',
        contentLength: file.fileSize || 0,
        storageId: file.fileStorageId,
      })),
    });

    console.log('Saved email to inbox:', emailId);

    // Create the job
    const jobTitle = `Email ${jobType} - ${webhookData.Subject || 'No Subject'}`;
    const deadlineHours = 24; // Default 24 hour deadline

    const jobId = await convex.action(api.jobs.createJobForWebhook, {
      title: jobTitle,
      priceUnitId,
      deadlineHours,
      clientId: user.clientId,
      files: uploadedFiles
    });

    console.log('Created job successfully:', jobId);

    // Link the job to the email in inbox
    await convex.action(api.inbox.linkJobAction, {
      emailId,
      jobId,
    });

    // Return success immediately to Postmark to prevent timeout
    const response = NextResponse.json({ 
      success: true, 
      jobId,
      jobType,
      attachmentCount: uploadedFiles.length,
      message: `Created ${jobType} job from email`
    });

    // Trigger auto-processing asynchronously (don't await)
    if (jobType === 'INVOICE') {
      // Fire and forget - don't block the webhook response
      setImmediate(async () => {
      try {
          const autoProcessResponse = await fetch(new URL("/api/agent/invoice/auto", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").toString(), {
            method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId }),
        });
        
          if (autoProcessResponse.ok) {
          console.log('Auto-processing triggered for invoice job:', jobId);
        } else {
          console.warn('Auto-processing failed for invoice job:', jobId);
        }
      } catch (error) {
        console.error('Error triggering auto-processing:', error);
      }
      });
    }

    return response;

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 