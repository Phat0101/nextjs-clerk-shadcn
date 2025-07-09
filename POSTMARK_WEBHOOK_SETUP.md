# Postmark Webhook Setup Guide

This system automatically creates jobs from emails sent to specific addresses with job type suffixes.

## Email Addresses

Send emails with attachments to these addresses to automatically create jobs:

- **Invoice Processing**: `dfd3ff40ad178d1a37bddca382543803+invoice@inbound.postmarkapp.com`
- **Shipment Registration**: `dfd3ff40ad178d1a37bddca382543803+shipment@inbound.postmarkapp.com`  
- **N10 Registration**: `dfd3ff40ad178d1a37bddca382543803+n10@inbound.postmarkapp.com`

## How It Works

1. **Email Reception**: Postmark receives emails sent to the above addresses
2. **Webhook Processing**: Postmark sends the email data to `/api/postmark-webhook`
3. **User Management**: If the sender doesn't exist, creates a new user and client
4. **File Upload**: Email attachments are uploaded to Convex storage
5. **Job Creation**: Creates a job with $0 pricing and 24-hour deadline
6. **Auto-Processing**: Invoice jobs automatically trigger AI processing

## Setup Instructions

### 1. Configure Postmark Webhook

1. Log into your Postmark account
2. Go to your inbound message stream settings
3. Set the webhook URL to: `https://your-domain.com/api/postmark-webhook`
4. Save the configuration

### 2. Test the System

#### Option A: Send Real Email
Send an email with a PDF attachment to:
```
dfd3ff40ad178d1a37bddca382543803+invoice@inbound.postmarkapp.com
```

#### Option B: Use Test Script
Run the included test script:
```bash
node test-webhook.js
```

### 3. Verify Results

1. Check your dashboard at `/dashboard` to see the created job
2. For invoice jobs, auto-processing should begin automatically
3. Check the server logs for webhook processing details

## Features

### Automatic User Creation
- Creates users based on email addresses
- Generates client company automatically
- Assigns CLIENT role by default

### Smart Job Type Detection
- `+invoice` → INVOICE job type
- `+shipment` → SHIPMENT job type  
- `+n10` → N10 job type

### File Processing
- Supports all email attachment types
- Uploads to Convex storage
- Preserves original filenames and metadata

### Zero-Cost Processing
- Creates $0 price units automatically
- No charges for email-triggered jobs
- Full processing capabilities maintained

## API Response

Successful webhook processing returns:
```json
{
  "success": true,
  "jobId": "k171234567890abcd",
  "jobType": "INVOICE", 
  "attachmentCount": 1,
  "message": "Created INVOICE job from email"
}
```

## Error Handling

The webhook handles these scenarios:
- Missing attachments → Returns 400 error
- Unknown job type → Returns 400 error  
- File upload failures → Continues with successful uploads
- User creation failures → Returns 500 error

## Security

- Webhook validates Postmark request format
- Only processes emails with valid job type suffixes
- Creates isolated users per email address
- All files stored securely in Convex

## Monitoring

Check these logs for webhook activity:
- Server console output
- Postmark webhook delivery logs
- Convex function execution logs
- Job creation timestamps in dashboard

## Troubleshooting

### Webhook Not Receiving Data
1. Verify Postmark webhook URL is correct
2. Check that your server is publicly accessible
3. Ensure webhook endpoint returns 200 status

### Jobs Not Created
1. Check server logs for error messages
2. Verify email has attachments
3. Confirm job type suffix is correct (+invoice, +shipment, +n10)

### Auto-Processing Not Starting
1. Only applies to INVOICE job types
2. Check that `/api/agent/invoice/auto` endpoint exists
3. Verify server has network access for internal API calls

## Development

To modify the webhook behavior:

1. Edit `/app/api/postmark-webhook/route.ts`
2. Modify job creation parameters
3. Add custom processing logic
4. Update user creation rules

The webhook integrates with existing:
- User management system
- Job creation workflow  
- File upload mechanisms
- Auto-processing pipelines 