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

    // Helper to recursively flatten nested objects using dot notation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flatten = (obj: any, prefix = ""): Record<string, unknown> => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
          Object.assign(out, flatten(v, key));
        } else {
          out[key] = v;
        }
      }
      return out;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isHeaderLineItem = (datum: any): datum is { header: Record<string, unknown>; lineItems: unknown[] } => {
      return datum && 'header' in datum && 'lineItems' in datum;
    };

    // Detect shipment 5-section structure
    const SECTION_ORDER = ['mode','consignor','consignee','customs_fields','details'];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isShipmentObject = (datum: any): boolean => {
      return datum && SECTION_ORDER.every(k => k in datum);
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
    } else if (isShipmentObject(data)) {
      // 5-section shipment object
      SECTION_ORDER.forEach(sectionKey => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const section = (data as any)[sectionKey] as Record<string, unknown>;
        if (!section) return;
        // Section title row
        csvContent += `"${sectionKey.toUpperCase()}"\n`;
        csvContent += 'Field,Value\n';
        Object.entries(section).forEach(([k,v])=>{
          const label = labelMap[k]||k;
          csvContent += `"${label}","${v ?? ''}"\n`;
        });
        csvContent += '\n';
      });
    } else if (
      // N10 6-section structure detection
      data &&
      'declarationHeader' in data &&
      'ownerDetails' in data &&
      'senderDetails' in data &&
      'transportInformation' in data &&
      'goodsDeclaration' in data
    ) {
      // N10 object
      const N10_SECTION_ORDER: Array<{ key: string; title: string; type: 'object' | 'array' }> = [
        { key: 'declarationHeader', title: 'Declaration Header', type: 'object' },
        { key: 'ownerDetails', title: 'Owner Details', type: 'object' },
        { key: 'senderDetails', title: 'Sender Details', type: 'object' },
        { key: 'transportInformation', title: 'Transport Information', type: 'object' },
        { key: 'goodsDeclaration', title: 'Goods Declaration', type: 'array' },
        { key: 'declarationStatement', title: 'Declaration Statement', type: 'object' },
      ];

      N10_SECTION_ORDER.forEach(({ key, title, type }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const section = (data as any)[key];
        if (!section) return;

        csvContent += `"${title.toUpperCase()}"\n`;

        if (type === 'object') {
          csvContent += 'Field,Value\n';
          const flat = flatten(section);
          Object.entries(flat).forEach(([k, v]) => {
            const label = labelMap[k] || k;
            csvContent += `"${label}","${v ?? ''}"\n`;
          });
          csvContent += '\n';
        } else if (type === 'array' && Array.isArray(section)) {
          if (section.length === 0) return;
          // Flatten each row and build header union
          const flattenedRows = (section as Array<Record<string, unknown>>).map(r => flatten(r));
          const headersSet = new Set<string>();
          flattenedRows.forEach(r => Object.keys(r).forEach(k => headersSet.add(k)));
          const headers = Array.from(headersSet);
          csvContent += headers.map(h => `"${labelMap[h] || h}"`).join(',') + '\n';
          flattenedRows.forEach(row => {
            const rowVals = headers.map(h => `"${row[h] ?? ''}"`);
            csvContent += rowVals.join(',') + '\n';
          });
          csvContent += '\n';
        }
      });
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
      // Fallback: recursively flatten nested objects so we don't get [object Object]
      const flat = flatten(data);
      const headers = Object.keys(flat);
      csvContent = 'Field,Value\n';
      headers.forEach(h=>{
        csvContent += `"${h}","${flat[h] ?? ''}"\n`;
      });
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