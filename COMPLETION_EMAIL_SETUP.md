# Completion Email Setup

This document explains how to set up automatic completion emails that are sent to clients when their jobs are completed.

## Overview

When a compiler completes a job that originated from an inbox email (i.e., was created via the Postmark webhook), the system automatically sends a completion email back to the original sender with the extracted CSV data attached.

## Environment Variables Required

Add these environment variables to your `.env.local` file:

```bash
# Postmark configuration for sending completion emails
POSTMARK_SERVER_TOKEN=your_postmark_server_token_here
POSTMARK_FROM_EMAIL=noreply@yourdomain.com

# Application URL (used for internal API calls)
NEXT_PUBLIC_APP_URL=http://localhost:3000  # for development
# NEXT_PUBLIC_APP_URL=https://yourdomain.com  # for production
```

## How It Works

1. **Job Completion**: When a compiler clicks "Complete Job" for a job that was created from an inbox email
2. **Email Check**: The system checks if the job is linked to an inbox email
3. **Email Sending**: If linked, it automatically:
   - Downloads the generated CSV file
   - Sends an email to the original sender
   - Includes the CSV as an attachment
   - Uses a professional email template

## Email Template

The completion email includes:
- A friendly greeting using the sender's name (if available)
- Job completion confirmation
- Job details (title, completion date)
- CSV attachment with extracted data
- Professional closing

## Postmark Configuration

1. **Server Token**: Get this from your Postmark account under "Servers" → "API Tokens"
2. **From Email**: Must be a verified sender signature in Postmark
3. **Webhook Setup**: Make sure your inbound webhook is configured (see POSTMARK_WEBHOOK_SETUP.md)

## Testing

To test the completion email functionality:

1. Send an email with an invoice attachment to your webhook address (e.g., `test+invoice@yourdomain.com`)
2. Check that the job appears in the admin inbox and compiler queue
3. As a compiler, complete the job by uploading a CSV
4. Verify that the completion email is sent to the original sender

## Troubleshooting

### Email Not Sending
- Check that `POSTMARK_SERVER_TOKEN` is valid
- Verify `POSTMARK_FROM_EMAIL` is a verified sender in Postmark
- Check the application logs for API errors

### Job Not Linked to Email
- Ensure the job was created via the webhook (not manually)
- Check that the inbox email has the correct `jobId` field

### File Attachment Issues
- Verify the CSV file was properly generated and stored
- Check Convex storage permissions
- Monitor file size limits (Postmark has a 10MB attachment limit)

## API Endpoint

The completion email is sent via the `/api/send-completion-email` endpoint, which:
- Gets the CSV file from Convex storage
- Downloads and converts it to base64
- Sends via Postmark SDK (using the official `postmark` npm package) with attachment
- Returns success/error status

## Dependencies

The system uses the official Postmark Node.js SDK:
```bash
npm install postmark
```

This provides better error handling, TypeScript support, and cleaner integration compared to direct API calls.

## Security Notes

- Only jobs linked to inbox emails trigger completion emails
- The system automatically determines the recipient from the original email
- CSV files are securely downloaded from Convex storage
- All email sending is logged for troubleshooting 