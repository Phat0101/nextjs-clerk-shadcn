import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

const suggestedFieldsSchema = z.object({
  headerFields: z.array(z.object({
    name: z.string().describe('Field name in camelCase (e.g., invoiceNumber)'),
    label: z.string().describe('Human readable label (e.g., Invoice Number)'),
    type: z.enum(['string', 'number', 'date']).describe('Data type of the field'),
    description: z.string().describe('Brief description of what this field contains'),
    required: z.boolean().describe('Whether this field is typically required'),
    example: z.string().optional().describe('Example value if visible in document')
  })).describe('Fields representing high-level invoice header information'),
  lineItemFields: z.array(z.object({
    name: z.string().describe('Field name in camelCase (e.g., invoiceNumber)'),
    label: z.string().describe('Human readable label (e.g., Invoice Number)'),
    type: z.enum(['string', 'number', 'date']).describe('Data type of the field'),
    description: z.string().describe('Brief description of what this field contains'),
    required: z.boolean().describe('Whether this field is typically required'),
    example: z.string().optional().describe('Example value if visible in document')
  })).describe('Fields representing columns for each line-item row'),
  documentType: z.string().describe('Type of document detected (e.g., Invoice, Receipt, Purchase Order)'),
  confidence: z.number().min(0).max(1).describe('Confidence level in the analysis'),
  notes: z.string().optional().describe('Any additional notes about the document structure')
});

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    const filesData: Array<{ data: ArrayBuffer; mimeType: string; filename?: string }> = [];
    let fileUrls: string[] = [];

    if (contentType.includes('multipart/form-data')) {
      // Handle multiple file uploads via FormData
      const formData = await request.formData();
      const files = formData.getAll('files') as File[];
      
      if (!files || files.length === 0) {
        return NextResponse.json({ error: 'No files provided' }, { status: 400 });
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
    } else {
      // Handle URL-based files (backward compatibility)
      const { fileUrls: urls } = await request.json();
      
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return NextResponse.json({ error: 'Files or fileUrls are required' }, { status: 400 });
      }
      
      fileUrls = urls;
    }

    // Prepare the content for the AI model
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messageContent: Array<any> = [
      {
        type: 'text',
        text: `Analyze ${filesData.length > 0 ? filesData.length : fileUrls.length} document${filesData.length > 1 || fileUrls.length > 1 ? 's' : ''} and suggest the most relevant fields for an invoice extraction workflow.

        Separate your suggestions into **two groups**:

        1. Invoice Header Fields – single-value attributes that appear once per invoice (e.g. invoiceNumber, invoiceDate, supplierName, totalAmount).
        2. Invoice Line-Item Fields – columns that repeat for each line-item row in the invoice table (e.g. itemDescription, quantity, unitPrice, lineTotal).

        Return your response using exactly the JSON schema provided (headerFields and lineItemFields arrays). Each field object must include \"name\", \"label\", \"type\", \"description\", \"required\", and optional \"example\" properties.

        When analyzing multiple documents, focus on the common denominators – propose a single shared header and line-item schema that works across all of them.`
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

    const { object: analysis } = await generateObject({
      model: google('gemini-2.5-flash'),
      messages: [
        {
          role: 'user',
          content: messageContent,
        },
      ],
      schema: suggestedFieldsSchema,
      temperature: 0.0,
    });

    return NextResponse.json({
      ...analysis,
      filesAnalyzed: filesData.length > 0 ? filesData.length : fileUrls.length
    });
  } catch (error) {
    console.error('Error analyzing documents:', error);
    return NextResponse.json(
      { error: 'Failed to analyze documents' },
      { status: 500 }
    );
  }
} 