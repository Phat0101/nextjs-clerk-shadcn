import { NextRequest, NextResponse } from 'next/server';
import { google } from '@ai-sdk/google';
import { streamObject, createDataStreamResponse } from 'ai';
import { z } from 'zod';
import { fetchAction } from 'convex/nextjs';
import { api as convexApi } from '@/convex/_generated/api';

// Enumerations from shipment_registration.md
const TRANSPORT_ENUM = ['SEA', 'AIR', 'FSA', 'FAS', 'RAI', 'COU'] as const;
const CONTAINER_ENUM = ['FCL', 'LCL', 'BLK', 'EBK', 'BCN', 'SCN', 'HCK', 'MCK'] as const;
const TYPE_ENUM = ['STD', 'CLM', 'BCL', 'BCN', 'HVL', 'HCK', 'SCN'] as const;
// const FREIGHT_TYPE_ENUM = ['Sea Freight','Air Freight','First by Sea then by Air Freight','First by Air then by Sea Freight','Local Freight','Rail Freight','Courier'] as const; // replaced by TRANSPORT_DESCRIPTIONS mapping

const WEIGHT_UNIT_ENUM = ['KG', 'DT', 'PH', 'GT', 'KT', 'LT', 'MT', 'OT', 'Decitons', 'Grams', 'Hectograms', 'Kilotons', 'Pounds', 'Pounds Troy', 'Metric Tons', 'Ounces Troy'] as const;

const VOLUME_UNIT_ENUM = ['M3', 'CC', 'CF', 'CI', 'CY', 'GA', 'GI', 'ML', 'Cubic Centimetres', 'Cubic Feet', 'Cubic Inches', 'Cubic Yards', 'US Gallons', 'Imperial Gallons', 'Litre', 'Cubic Metres'] as const;

const PACKAGES_ENUM = ['BAG', 'BBG', 'BSK', 'BLU', 'BOT', 'BOX', 'CAS', 'COI', 'CRT', 'CTN', 'CYL', 'DOZ', 'DRM', 'ENV', 'GRS', 'KEG', 'MIX', 'PAI', 'PCE', 'PKG', 'PLT', 'REL', 'RLL', 'ROL', 'SHT', 'SKD', 'SPL', 'TOT', 'TUB', 'UNT'] as const;

const CURRENCY_ENUM = ['AUD', 'USD', 'EUR', 'CNY', 'GBP'] as const;

const INCOTERM_ENUM = ['FOB', 'CFR', 'CIF', 'CIP', 'CPT', 'DAP', 'DAT', 'DDP', 'DPU', 'EXW', 'FAS', 'FC1', 'FC2', 'FCA'] as const;

const SPOT_RATE_TYPE_ENUM = ['STD', 'FRT', 'FPR'] as const;

const SERVICE_LEVEL_ENUM = ['STD', 'Standard'] as const;

const RELEASE_TYPE_ENUM = ['EBL', 'BSD', 'BTD', 'CSH', 'CAD', 'ERC', 'LCR', 'NON', 'OBL', 'OBR', 'Express Bill of Lading', 'Sight Draft (Bank Release)', 'Time Draft (Bank Release)', 'Company/Cash/Cheque', 'Cash Against Documents', 'Express Release', 'Letter of Credit (Bank Release)', 'Not Negotiable unless consigned to Order', 'Original Bill - Surrender at Origin', 'Original Bill Required at Destination'] as const;

const CHARGES_APPLY_ENUM = ['SHW', 'NON', 'PPD', 'AGR', 'ALL', 'OPC', 'CPP', 'CAL', 'Show Collect Charges', 'No Charges showing', 'Show Prepaid Charges', 'Show As Agreed in the charges section', 'Show Prepaid & Collect Charges', 'Show Original As Agreed & Copy with Collect Charges', 'Show Original As Agreed & Copy with Prepaid Charges', 'Show Original As Agreed & Copy with Prepaid & Collect Charges'] as const;

const PHASE_ENUM = ['ALL', 'Open Security'] as const;

// --------------------------------------------------
// Zod schema matching the Shipment JSON structure
// (Fields are typed broadly – AI output is validated for shape not enum values)
// --------------------------------------------------

const shipmentSchema = z.object({
    mode: z.object({
        transport: z.enum(TRANSPORT_ENUM).describe("SEA means Sea Freight, AIR means Air Freight, FSA means First by Sea then by Air Freight, FAS means First by Air then by Sea Freight, RAI means Rail Freight, COU means Courier"),
        container: z.enum(CONTAINER_ENUM),
        type: z.enum(TYPE_ENUM),
    }),
    consignor: z.object({
        company: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
        city_state: z.string().nullable().optional(),
        country: z.string().nullable().optional(),
    }),
    consignee: z.object({
        company: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
        city_state: z.string().nullable().optional(),
        country: z.string().nullable().optional(),
    }),
    details: z.object({
        house_bill: z.string().nullable().optional(),
        domestic: z.boolean().nullable().optional(),
        origin: z.string().nullable().optional(),
        destination: z.string().nullable().optional(),
        etd: z.string().nullable().optional(),
        eta: z.string().nullable().optional(),
        weight_value: z.number().nullable().optional(),
        weight_unit: z.enum(WEIGHT_UNIT_ENUM).nullable().optional(),
        volume_value: z.number().nullable().optional(),
        volume_unit: z.enum(VOLUME_UNIT_ENUM).nullable().optional(),
        chargeable_value: z.number().nullable().optional(),
        chargeable_unit: z.enum(VOLUME_UNIT_ENUM).nullable().optional(),
        packages_count: z.number().nullable().optional(),
        packages_type: z.enum(PACKAGES_ENUM).nullable().optional(),
        wv_ratio: z.number().nullable().optional(),
        inners_count: z.number().nullable().optional(),
        inners_type: z.enum(PACKAGES_ENUM).nullable().optional(),
        goods_value_amount: z.number().nullable().optional(),
        goods_value_currency: z.enum(CURRENCY_ENUM).nullable().optional(),
        insurance_value_amount: z.number().nullable().optional(),
        insurance_value_currency: z.enum(CURRENCY_ENUM).nullable().optional(),
        description: z.string().nullable().optional(),
        marks_numbers: z.string().nullable().optional(),
        incoterm: z.enum(INCOTERM_ENUM).nullable().optional(),
        free_on_board: z.boolean().nullable().optional(),
        spot_rate: z.number().nullable().optional(),
        spot_rate_type: z.enum(SPOT_RATE_TYPE_ENUM).nullable().optional(),
        use_standard_rate: z.boolean().nullable().optional(),
        service_level: z.enum(SERVICE_LEVEL_ENUM).nullable().optional(),
        release_type: z.enum(RELEASE_TYPE_ENUM).nullable().optional(),
        charges_apply: z.enum(CHARGES_APPLY_ENUM).nullable().optional(),
        phase: z.enum(PHASE_ENUM).nullable().optional(),
        order_refs: z.string().nullable().optional(),
    }),
    customs_fields: z.object({
        aqis_status: z.string().nullable().optional(),
        customs_status: z.string().nullable().optional(),
        subject_to_aqis: z.boolean().nullable().optional(),
        subject_to_jfis: z.boolean().nullable().optional(),
    }),
});

// --------------------------------------------------
// Prompt (taken from shipment_registration.md)
// --------------------------------------------------

// Full instructions sourced from shipment_registration.md so the LLM has explicit extraction rules
const SYSTEM_PROMPT = `# Shipment Document Processing Instructions
You will receive shipment documents and must extract/analyze data according to the provided JSON schema.

## Processing Rules:

### EXTRACT ONLY Fields (never analyze/deduce):
- **Company Information**: consignor/consignee company, address, city_state, country
- **Document Identifiers**: house_bill, origin, destination, etd, eta
- **Physical Measurements**: weight_value, weight_unit, volume_value, volume_unit, packages_count, packages_type, inners_count, inners_type
- **Financial Data**: goods_value_amount, goods_value_currency, insurance_value_amount, insurance_value_currency, spot_rate
- **Text Fields**:  marks_numbers, order_refs
- **Status Fields**: aqis_status, customs_status
**Rule**: Extract these fields directly from document text or leave as null. Never deduce or analyze.

### ANALYZE/DEDUCE Fields (when not explicitly stated):
- **Mode fields**: transport, container, type, freight_type - can be deduced from document context
- **Calculated fields**: domestic, chargeable_value, chargeable_unit, wv_ratio - can be calculated from other data
- **Business logic fields**: override flags, incoterm, free_on_board, use_standard_rate, service_level, release_type, charges_apply, phase, subject_to_aqis, subject_to_jfis
- Description should be summarised. (For example, chair parts)
**Rule**: Extract if explicitly stated, otherwise analyze document context to deduce values.

## Output Requirements:
- Follow the JSON schema exactly (provided separately in the request)
- Dates: YYYY-MM-DD format
- Numbers: numeric values only (no formatting or symbols)
- Output MUST be wrapped in a markdown code block (\`\`\`)
- Never add fields that are not in the schema`;

export async function POST(request: NextRequest) {
    // Parse body
    const { fileUrls, jobId } = await request.json();
    if (!Array.isArray(fileUrls) || !fileUrls.length) {
        return NextResponse.json({ error: 'fileUrls array is required' }, { status: 400 });
    }

    // Build multimodal message content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = [
        { type: 'text', text: SYSTEM_PROMPT },
    ];
    fileUrls.forEach((url: string, idx: number) => {
        const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)(\?|$)/i.test(url);
        if (isImage) {
            content.push({ type: 'image', image: new URL(url) });
        } else {
            content.push({
                type: 'file',
                data: new URL(url),
                mimeType: 'application/pdf',
                filename: `document-${idx + 1}.pdf`,
            });
        }
    });

    // Prepare streamObject call
    const { partialObjectStream, object } = streamObject({
        model: google('gemini-2.5-flash'),
        messages: [{ role: 'user', content }],
        schema: shipmentSchema as z.ZodTypeAny,
        temperature: 0,
    });

    // Function to write Convex (lazy import to avoid esm in edge)
    async function persistPartial(partialData: unknown) {
        if (!jobId) return;
        try {
            await fetchAction(convexApi.jobs.saveExtractedData, {
                jobId,
                data: partialData,
            });
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('Failed to save extracted data', err);
        }
    }

    // Build streaming response
      return createDataStreamResponse({
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        execute: async (writer) => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for await (const partial of partialObjectStream as any) {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/await-thenable, @typescript-eslint/no-unsafe-argument
              // @ts-expect-error writer typing mismatch – accepts Uint8Array but string works in runtime
              writer.write(JSON.stringify({ type: 'partial', data: partial }));
              await persistPartial(partial);
            }

            const finalObj = await object;
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error writer typing mismatch – accepts Uint8Array but string works in runtime
            writer.write(JSON.stringify({ type: 'result', data: finalObj }));
            await persistPartial({ extracted: finalObj });
          } catch (err) {
            writer.onError?.(err);
          }
        },
      });
    //return NextResponse.json({ extracted: object }, { status: 200 });
}
