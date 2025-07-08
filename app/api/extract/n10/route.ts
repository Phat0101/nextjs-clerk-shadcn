import { NextRequest, NextResponse } from 'next/server';
import { google } from '@ai-sdk/google';
import { streamObject, createDataStreamResponse } from 'ai';
import { z } from 'zod';
import { fetchAction } from 'convex/nextjs';
import { api as convexApi } from '@/convex/_generated/api';
import { n10Schema } from '@/lib/n10Schema';

// --------------------------------------------------
// System Prompt for N10 Document Processing
// --------------------------------------------------

const SYSTEM_PROMPT = `# N10 Customs Declaration Document Processing Instructions
You will receive N10 customs declaration documents and must extract/analyze data according to the provided JSON schema.

## Processing Rules:

### EXTRACT ONLY Fields (never analyze/deduce):
- **Importer Information**: importer_abn_ccid, importer_cac, importer_ref, importer_declaration_identifer
- **Broker Information**: broker_ref, broker_license_number, branch_id
- **Transport Details**: airline_code, vessel_id, voyage_number, loading_port, discharge_port, first_arrival_port, destination_port
- **Dates**: arrival_date, first_arrival_date, valuation_date (extract in YYYY-MM-DD format)
- **Weight/Measurements**: gross_weight, gross_weight_unit
- **Financial Amounts**: All amount fields (invoice_total_amount, overseas_freight_amount, etc.) and their currencies
- **Delivery Address**: All delivery address fields (name, address_1, address_2, suburb, state, postcode, country_code, phone_number)
- **Transport Lines**: container_number, masterbill, housebill, number_of_packages, packing_unit_count, marks_and_desc, consignment_reference
- **Tariff Lines**: supplier_id, tariff_class_number, stat_code, tariff_class_rate_number, good_desc, country_of_origin, quantity_1, quantity_1_unit, type_price_amount, type_price_currency, import_permit_number
- **Bank Details**: bank_account_owner_type, bank_account_number, bank_account_name, bank_account_bsb
- **Text Fields**: aqis_concern_type, quarantine_inspection_location
**Rule**: Extract these fields directly from document text or leave as null. Never deduce or analyze.

### ANALYZE/DEDUCE Fields (when not explicitly stated):
- **Mode of Transport**: mode_of_transport - can be deduced from document context (air/sea)
- **Boolean Fields**: is_eft_payment, is_sac_declaration, is_pay_duty, has_payrec_edi_message, is_visual_exam_indicator
- **Business Logic Fields**: valuation_basis_type, preference_origin, preference_scheme_type, preference_rule_type, is_related_transaction_yn, gst_exemption_code
- **Cargo Type**: cargo_type - can be deduced from transport context
**Rule**: Extract if explicitly stated, otherwise analyze document context to deduce values.

## Critical Validation Rules:
- **invoice_total_amount**: REQUIRED field, must be greater than 0
- **delivery_address**: REQUIRED field, must contain at least some address information
- **good_desc**: REQUIRED for each tariff line, maximum 250 characters
- **country_of_origin**: REQUIRED for each tariff line, must be valid 2-character country code
- **preference_scheme_type**: REQUIRED for each tariff line
- **Preference Logic**: If preference_scheme_type is "GEN", then preference_origin and preference_rule_type must be blank/null
- **Country Codes**: All country codes must be valid 2-character ISO codes
- **Numeric Fields**: Extract as strings but ensure they represent valid numbers
- **Date Format**: All dates must be in YYYY-MM-DD format

## Field Length Constraints:
- importer_abn_ccid: exactly 11 characters, numeric
- importer_cac: exactly 3 characters, numeric
- importer_ref: maximum 20 characters, alphanumeric
- branch_id: exactly 6 characters, alphanumeric
- broker_ref: maximum 20 characters, alphanumeric
- broker_license_number: maximum 5 characters, numeric
- airline_code: maximum 10 characters, alphanumeric
- vessel_id: maximum 8 characters, alphanumeric
- voyage_number: maximum 6 characters, alphanumeric
- Port codes: exactly 5 characters each
- container_number: maximum 17 characters, alphanumeric
- masterbill/housebill: maximum 35 characters each
- supplier_id: exactly 11 characters, alphanumeric
- tariff_class_number: exactly 8 characters, numeric
- stat_code: exactly 2 characters, numeric
- tariff_class_rate_number: maximum 3 characters, alphanumeric

## Array Processing:
- **transport_lines**: Extract multiple transport/container entries if present
- **tariff_lines**: Extract multiple goods/tariff entries if present
- **lodgement_questions**: Extract question-answer pairs if present
- **tariff_groups**: Extract group default settings if present
- **risk_answers**: Extract risk assessment responses if present
- **quarantine_premises/packages**: Extract quarantine-related information if present

## Output Requirements:
- Follow the JSON schema exactly (provided separately in the request)
- Dates: YYYY-MM-DD format
- Numbers: extract as strings but ensure they represent valid numbers
- Booleans: true/false values for checkbox/yes-no fields
- Arrays: include all relevant entries found in the document
- Required fields: invoice_total_amount, delivery_address, and for each tariff line: good_desc, country_of_origin, preference_scheme_type
- Output MUST be wrapped in a markdown code block (\`\`\`)
- Never add fields that are not in the schema`;

export async function POST(request: NextRequest) {
    // Parse body
    const { fileUrls, jobId, shipmentContext } = await request.json();
    if (!Array.isArray(fileUrls) || !fileUrls.length) {
        return NextResponse.json({ error: 'fileUrls array is required' }, { status: 400 });
    }

    // Build context-aware system prompt
    let contextualPrompt = SYSTEM_PROMPT;
    if (shipmentContext) {
        contextualPrompt += `\n\n## SHIPMENT CONTEXT PROVIDED
The following shipment form data has been extracted from the same documents and should be used as context to help with N10 extraction:

**Consignor Information:**
- Company: ${shipmentContext.consignor?.company || 'Not specified'}
- Address: ${shipmentContext.consignor?.address || 'Not specified'}
- City/State: ${shipmentContext.consignor?.city_state || 'Not specified'}
- Country: ${shipmentContext.consignor?.country || 'Not specified'}

**Consignee Information:**
- Company: ${shipmentContext.consignee?.company || 'Not specified'}
- Address: ${shipmentContext.consignee?.address || 'Not specified'}
- City/State: ${shipmentContext.consignee?.city_state || 'Not specified'}
- Country: ${shipmentContext.consignee?.country || 'Not specified'}

**Transport Details:**
- Mode: ${shipmentContext.mode?.transport || 'Not specified'}
- Origin: ${shipmentContext.details?.origin || 'Not specified'}
- Destination: ${shipmentContext.details?.destination || 'Not specified'}
- House Bill: ${shipmentContext.details?.house_bill || 'Not specified'}
- Weight: ${shipmentContext.details?.weight_value || 'Not specified'} ${shipmentContext.details?.weight_unit || ''}
- Goods Description: ${shipmentContext.details?.description || 'Not specified'}
- Goods Value: ${shipmentContext.details?.goods_value_amount || 'Not specified'} ${shipmentContext.details?.goods_value_currency || ''}

Use this context to:
1. Pre-populate delivery address from consignee information
2. Set transport mode and details consistently
3. Use goods description and value for tariff lines
4. Ensure consistency between shipment and N10 data
5. Map house bill numbers appropriately`;
    }

    // Build multimodal message content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = [
        { type: 'text', text: contextualPrompt },
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
                filename: `n10-document-${idx + 1}.pdf`,
            });
        }
    });

    // Prepare streamObject call
    const { partialObjectStream, object } = streamObject({
        model: google('gemini-2.5-flash'),
        messages: [{ role: 'user', content }],
        schema: n10Schema as z.ZodTypeAny,
        temperature: 0,
    });

    // Function to write to Convex (lazy import to avoid esm in edge)
    async function persistPartial(partialData: unknown) {
        if (!jobId) return;
        try {
            await fetchAction(convexApi.jobs.saveN10ExtractedData, {
                jobId,
                data: partialData,
            });
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('Failed to save N10 extracted data', err);
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
}
