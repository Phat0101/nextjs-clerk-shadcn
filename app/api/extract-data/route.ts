import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

interface ConfirmedField {
  name: string;
  label: string;
  type: 'string' | 'number' | 'date';
  description: string;
  required: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    const filesData: Array<{ data: ArrayBuffer; mimeType: string; filename?: string }> = [];
    let fileUrls: string[] = [];
    let headerFieldsInput: ConfirmedField[] = [];
    let lineItemFieldsInput: ConfirmedField[] = [];

    if (contentType.includes('multipart/form-data')) {
      // Handle multiple file uploads via FormData
      const formData = await request.formData();
      const files = formData.getAll('files') as File[];
      const headerJson = formData.get('headerFields') as string;
      const lineItemJson = formData.get('lineItemFields') as string;
      
      if (!files || files.length === 0 || !headerJson || !lineItemJson) {
        return NextResponse.json({ error: 'Files and confirmed header/lineItem fields are required' }, { status: 400 });
      }

      // Process each file
      for (const file of files) {
        // Validate file type
        if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
          return NextResponse.json({ 
            error: `File "${file.name}" is not supported. Only image files (PNG, JPG, etc.) and PDF files are supported.` 
          }, { status: 400 });
        }

        const fileData = await file.arrayBuffer();
        filesData.push({
          data: fileData,
          mimeType: file.type,
          filename: file.name
        });
      }

      try {
        headerFieldsInput = JSON.parse(headerJson);
        lineItemFieldsInput = JSON.parse(lineItemJson);
      } catch {
        return NextResponse.json({ error: 'Invalid confirmed fields format' }, { status: 400 });
      }
    } else {
      // Handle URL-based files (backward compatibility)
      const { fileUrls: urls, headerFields: hdr, lineItemFields: li } = await request.json();
      
      if (!urls || !Array.isArray(urls) || urls.length === 0 || !hdr || !Array.isArray(hdr) || !li || !Array.isArray(li)) {
        return NextResponse.json({ error: 'Files/fileUrls and confirmed header/lineItem fields are required' }, { status: 400 });
      }
      
      fileUrls = urls;
      headerFieldsInput = hdr;
      lineItemFieldsInput = li;
    }

    // Build header schema
    const headerSchemaFields: Record<string, z.ZodTypeAny> = {};
    headerFieldsInput.forEach((field: ConfirmedField) => {
      let zodType: z.ZodTypeAny;
      
      switch (field.type) {
        case 'number':
          zodType = z.number().describe(field.description);
          break;
        case 'date':
          zodType = z.string().describe(`${field.description} (format: YYYY-MM-DD)`);
          break;
        default:
          zodType = z.string().describe(field.description);
      }
      
      // Make field optional if not required
      if (!field.required) {
        zodType = zodType.optional();
      }
      headerSchemaFields[field.name] = zodType;
    });

    // Build line item schema
    const lineItemSchemaFields: Record<string, z.ZodTypeAny> = {};
    lineItemFieldsInput.forEach((field: ConfirmedField) => {
      let zodType: z.ZodTypeAny;
      switch (field.type) {
        case 'number':
          zodType = z.number().describe(field.description);
          break;
        case 'date':
          zodType = z.string().describe(`${field.description} (format: YYYY-MM-DD)`);
          break;
        default:
          zodType = z.string().describe(field.description);
      }
      if (!field.required) {
        zodType = zodType.optional();
      }
      lineItemSchemaFields[field.name] = zodType;
    });

    const headerSchema = z.object(headerSchemaFields);
    const lineItemSchema = z.object(lineItemSchemaFields);

    const singleDocumentSchema = z.object({
      header: headerSchema,
      lineItems: z.array(lineItemSchema).describe('Array of invoice line items')
    });
    const totalFiles = filesData.length > 0 ? filesData.length : fileUrls.length;
    
    const dynamicSchema = totalFiles > 1 
      ? z.object({
          documents: z.array(singleDocumentSchema).length(totalFiles).describe('Extracted data from each document in order')
        })
      : singleDocumentSchema;

    // Create field descriptions for the prompt
    const headerDescriptions = headerFieldsInput.map((field: ConfirmedField) => 
      `- ${field.label} (${field.name}): ${field.description} [Type: ${field.type}${field.required ? ', Required' : ', Optional'}]`
    ).join('\n');

    const lineItemDescriptions = lineItemFieldsInput.map((field: ConfirmedField) =>
      `- ${field.label} (${field.name}): ${field.description} [Type: ${field.type}${field.required ? ', Required' : ', Optional'}]`
    ).join('\n');

    // Prepare the content for the AI model
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messageContent: Array<any> = [
      {
        type: 'text',
        text: `Extract the following information from ${totalFiles} invoice document${totalFiles > 1 ? 's' : ''}. Be precise and accurate.

Header fields (single occurrence per invoice):
${headerDescriptions}

Line-item fields (repeat for each row in the invoice table):
${lineItemDescriptions}

Return the result using exactly this JSON structure for each document:
{
  "header": { ...header fields... },
  "lineItems": [ { ...line-item fields... }, ... ]
}

Instructions:
- Extract exact values as they appear in each document.
- Dates: YYYY-MM-DD format.
- Numbers: raw numeric values without currency symbols or formatting.
- If a field is missing or unclear, leave it null/empty.
- Be conservative: only extract data that is clearly visible and verifiable.
${totalFiles > 1 ? '- Process each document separately and keep the same order as provided.' : ''}`
      }
    ];

    // Add file parts based on input type
    if (filesData.length > 0) {
      // Add each uploaded file
      filesData.forEach((file, index) => {
        messageContent.push({
          type: 'file',
          data: file.data,
          mimeType: file.mimeType,
          filename: file.filename || `document-${index + 1}`
        });
      });
    } else if (fileUrls.length > 0) {
      // Add each URL-based file
      fileUrls.forEach((url, index) => {
        const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)(\?|$)/i.test(url);
        if (isImage) {
          messageContent.push({
            type: 'image',
            image: new URL(url)
          });
        } else {
          messageContent.push({
            type: 'file',
            data: new URL(url),
            mimeType: 'application/pdf',
            filename: `document-${index + 1}`
          });
        }
      });
    }

    const { object: extractedData } = await generateObject({
      model: google('gemini-2.5-pro'),
      messages: [
        {
          role: 'user',
          content: messageContent,
        },
      ],
      schema: dynamicSchema as z.ZodTypeAny,
      temperature: 0.0,
    });

    return NextResponse.json({
      extractedData,
      headerFields: headerFieldsInput.length,
      lineItemFields: lineItemFieldsInput.length,
      filesProcessed: totalFiles,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error extracting data:', error);
    return NextResponse.json(
      { error: 'Failed to extract data from documents' },
      { status: 500 }
    );
  }
} 