import { NextRequest, NextResponse } from 'next/server';

interface FieldLabel { name: string; label?: string }

export async function POST(request: NextRequest) {
  try {
    const { data, jobTitle, fields } = await request.json();
    
    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'Data is required' }, { status: 400 });
    }

    let csvContent = '';

    const labelMap: Record<string,string> = {};
    if (Array.isArray(fields)) {
      (fields as FieldLabel[]).forEach((f)=>{labelMap[f.name]=f.label||f.name;});
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isHeaderLineItem = (datum: any): datum is { header: Record<string, unknown>; lineItems: unknown[] } => {
      return datum && 'header' in datum && 'lineItems' in datum;
    };

    if (isHeaderLineItem(data)) {
      // Single document with header + line items
      const headerKeys = Object.keys(data.header as Record<string, unknown>);
      const lineItemKeys = data.lineItems.length > 0 ? Object.keys(data.lineItems[0] as Record<string, unknown>) : [];

      // Header table
      csvContent += 'Header Field,Header Value\n';
      headerKeys.forEach(k => {
        const label = labelMap[k] || k;
        csvContent += `"${label}","${data.header[k] ?? ''}"\n`;
      });

      // Separator blank line
      csvContent += '\n';

      // Line items table
      if (lineItemKeys.length) {
        csvContent += lineItemKeys.map(k => `"${labelMap[k]||k}"`).join(',') + '\n';
        (data.lineItems as Array<Record<string, unknown>>).forEach((row) => {
          const rowValues = lineItemKeys.map(k => `"${row[k] ?? ''}"`);
          csvContent += rowValues.join(',') + '\n';
        });
      }
    } else if (Array.isArray(data?.documents)) {
      // Multiple documents scenario
      // Assume each document has header + lineItems
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const firstDoc = data.documents[0] as any;
      const headerKeys = Object.keys(firstDoc.header || {});
      const lineItemKeys = firstDoc.lineItems && firstDoc.lineItems.length > 0 ? Object.keys(firstDoc.lineItems[0] as Record<string, unknown>) : [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data.documents as Array<any>).forEach((doc, idx) => {
        csvContent += `Document ${idx + 1} Header\n`;
        headerKeys.forEach(k => {
          const label = labelMap[k] || k;
          csvContent += `"${label}","${doc.header[k] ?? ''}"\n`;
        });
        csvContent += '\n';

        if (lineItemKeys.length) {
          csvContent += lineItemKeys.map(k => `"${labelMap[k]||k}"`).join(',') + '\n';
          if (doc.lineItems && doc.lineItems.length) {
            (doc.lineItems as Array<Record<string, unknown>>).forEach((row) => {
              const rowValues = lineItemKeys.map(k => `"${row[k] ?? ''}"`);
              csvContent += rowValues.join(',') + '\n';
            });
          }
        }
        csvContent += '\n';
      });
    } else {
      // Fallback to previous flat object behaviour
      const headers = Object.keys(data);
      const values = Object.values(data);
      csvContent = [
        headers.map(h => `"${h}"`).join(','),
        values.map(v => `"${v ?? ''}"`).join(',')
      ].join('\n');
    }

    // Create filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${(jobTitle || 'invoice_extraction').replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating CSV:', error);
    return NextResponse.json({ error: 'Failed to generate CSV' }, { status: 500 });
  }
}