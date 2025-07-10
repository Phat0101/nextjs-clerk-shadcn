import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import * as postmark from 'postmark';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Initialize Postmark client
const postmarkClient = new postmark.ServerClient(process.env.POSTMARK_SERVER_TOKEN!);

interface CompletionEmailRequest {
  jobId: string;
  csvStorageId: string;
  inboxEmailId: string;
  recipientEmail: string;
  recipientName?: string;
  subject?: string;
  jobTitle: string;
}

export async function POST(request: NextRequest) {
  try {
    const data: CompletionEmailRequest = await request.json();
    
    console.log('📧 API: Received completion email request for job:', data.jobId);
    console.log('📧 API: Email details:', {
      recipient: data.recipientEmail,
      subject: data.subject,
      jobTitle: data.jobTitle
    });

    // Get the CSV file URL from Convex storage
    const csvUrl = await convex.query(api.inbox.getFileUrl, { storageId: data.csvStorageId });
    
    if (!csvUrl) {
      console.error('Could not get CSV file URL');
      return NextResponse.json({ error: 'Could not get CSV file URL' }, { status: 500 });
    }

    // Download the CSV file to include as attachment
    const csvResponse = await fetch(csvUrl);
    if (!csvResponse.ok) {
      console.error('Failed to download CSV file');
      return NextResponse.json({ error: 'Failed to download CSV file' }, { status: 500 });
    }

    const csvBuffer = await csvResponse.arrayBuffer();
    const csvBase64 = Buffer.from(csvBuffer).toString('base64');

    // Prepare email content
    const replySubject = data.subject ? `Re: ${data.subject}` : 'Invoice Processing Complete';
    const emailBody = `
Hello ${data.recipientName || 'there'},

Your invoice has been successfully processed.

Job Details:
- Job Title: ${data.jobTitle}
- Processing Date: ${new Date().toLocaleDateString()}

Please find the extracted data attached as a CSV file.

If you have any questions about the extracted data or need any modifications, please don't hesitate to contact us.

Cheers,
Clear.ai
    `.trim();

    const fromEmail = process.env.POSTMARK_FROM_EMAIL || 'noreply@compileflow.com';
    const csvFileName = `invoice_data_${data.jobId.slice(-6)}.csv`;

    try {
      // Send email via Postmark SDK
      const postmarkResult = await postmarkClient.sendEmail({
        From: fromEmail,
        To: data.recipientEmail,
        Subject: replySubject,
        TextBody: emailBody,
        Attachments: [
          {
            Name: csvFileName,
            Content: csvBase64,
            ContentType: 'text/csv',
            ContentID: `invoice-${data.jobId.slice(-6)}`,
          }
        ],
      });

      console.log('✅ API: Completion email sent successfully:', postmarkResult.MessageID);

      // Track the sent email in the inbox system
      try {
        await convex.action(api.inbox.createOutboundEmailAction, {
          from: fromEmail,
          fromName: 'CompileFlow Team',
          to: data.recipientEmail,
          recipientEmail: data.recipientEmail,
          subject: replySubject,
          textBody: emailBody,
          messageId: postmarkResult.MessageID,
          jobId: data.jobId as Id<"jobs">,
          attachments: [
            {
              name: csvFileName,
              contentType: 'text/csv',
              contentLength: csvBuffer.byteLength,
              storageId: data.csvStorageId,
            }
          ],
          emailService: 'postmark',
          status: 'sent',
        });

        console.log('📧 API: Sent email tracked in inbox system');
      } catch (trackingError) {
        console.error('⚠️ API: Failed to track sent email in inbox:', trackingError);
        // Don't fail the whole request if tracking fails
      }

      return NextResponse.json({ 
        success: true, 
        messageId: postmarkResult.MessageID,
        recipient: data.recipientEmail,
        tracked: true,
      });

    } catch (emailError) {
      console.error('❌ API: Failed to send completion email:', emailError);
      
      // Track the failed email in the inbox system
      try {
        await convex.action(api.inbox.createOutboundEmailAction, {
          from: fromEmail,
          fromName: 'CompileFlow Team',
          to: data.recipientEmail,
          recipientEmail: data.recipientEmail,
          subject: replySubject,
          textBody: emailBody,
          messageId: `failed-${Date.now()}-${data.jobId.slice(-6)}`,
          jobId: data.jobId as Id<"jobs">,
          attachments: [
            {
              name: csvFileName,
              contentType: 'text/csv',
              contentLength: csvBuffer.byteLength,
              storageId: data.csvStorageId,
            }
          ],
          emailService: 'postmark',
          status: 'failed',
          errorMessage: emailError instanceof Error ? emailError.message : 'Unknown error',
        });

        console.log('📧 API: Failed email tracked in inbox system');
      } catch (trackingError) {
        console.error('⚠️ API: Failed to track failed email in inbox:', trackingError);
      }

      // Handle any errors from the Postmark SDK
      if (emailError instanceof Error) {
        return NextResponse.json({ 
          error: 'Failed to send completion email',
          details: emailError.message,
          tracked: true,
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        error: 'Internal server error',
        details: 'Unknown error occurred',
        tracked: true,
      }, { status: 500 });
    }

  } catch (error) {
    console.error('💥 API: Completion email endpoint error:', error);
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
} 