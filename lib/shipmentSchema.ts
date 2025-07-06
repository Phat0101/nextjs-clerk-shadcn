export const TRANSPORT_ENUM = ['SEA', 'AIR', 'FSA', 'FAS', 'RAI', 'COU'] as const;
export const CONTAINER_ENUM = ['FCL', 'LCL', 'BLK', 'EBK', 'BCN', 'SCN', 'HCK', 'MCK'] as const;
export const TYPE_ENUM = ['STD', 'CLM', 'BCL', 'BCN', 'HVL', 'HCK', 'SCN'] as const;
export const WEIGHT_UNIT_ENUM = ['KG', 'DT', 'PH', 'GT', 'KT', 'LT', 'MT', 'OT', 'Decitons', 'Grams', 'Hectograms', 'Kilotons', 'Pounds', 'Pounds Troy', 'Metric Tons', 'Ounces Troy'] as const;
export const VOLUME_UNIT_ENUM = ['M3', 'CC', 'CF', 'CI', 'CY', 'GA', 'GI', 'ML', 'Cubic Centimetres', 'Cubic Feet', 'Cubic Inches', 'Cubic Yards', 'US Gallons', 'Imperial Gallons', 'Litre', 'Cubic Metres'] as const;
export const PACKAGES_ENUM = ['BAG', 'BBG', 'BSK', 'BLU', 'BOT', 'BOX', 'CAS', 'COI', 'CRT', 'CTN', 'CYL', 'DOZ', 'DRM', 'ENV', 'GRS', 'KEG', 'MIX', 'PAI', 'PCE', 'PKG', 'PLT', 'REL', 'RLL', 'ROL', 'SHT', 'SKD', 'SPL', 'TOT', 'TUB', 'UNT'] as const;
export const CURRENCY_ENUM = ['AUD', 'USD', 'EUR', 'CNY', 'GBP'] as const;
export const INCOTERM_ENUM = ['FOB', 'CFR', 'CIF', 'CIP', 'CPT', 'DAP', 'DAT', 'DDP', 'DPU', 'EXW', 'FAS', 'FC1', 'FC2', 'FCA'] as const;
export const SPOT_RATE_TYPE_ENUM = ['STD', 'FRT', 'FPR'] as const;
export const SERVICE_LEVEL_ENUM = ['STD', 'Standard'] as const;
export const RELEASE_TYPE_ENUM = ['EBL', 'BSD', 'BTD', 'CSH', 'CAD', 'ERC', 'LCR', 'NON', 'OBL', 'OBR', 'Express Bill of Lading', 'Sight Draft (Bank Release)', 'Time Draft (Bank Release)', 'Company/Cash/Cheque', 'Cash Against Documents', 'Express Release', 'Letter of Credit (Bank Release)', 'Not Negotiable unless consigned to Order', 'Original Bill - Surrender at Origin', 'Original Bill Required at Destination'] as const;
export const CHARGES_APPLY_ENUM = ['SHW', 'NON', 'PPD', 'AGR', 'ALL', 'OPC', 'CPP', 'CAL', 'Show Collect Charges', 'No Charges showing', 'Show Prepaid Charges', 'Show As Agreed in the charges section', 'Show Prepaid & Collect Charges', 'Show Original As Agreed & Copy with Collect Charges', 'Show Original As Agreed & Copy with Prepaid Charges', 'Show Original As Agreed & Copy with Prepaid & Collect Charges'] as const;
export const PHASE_ENUM = ['ALL', 'Open Security'] as const;

import { z } from 'zod';

export const shipmentSchema = z.object({
  mode: z.object({
    transport: z.enum(TRANSPORT_ENUM).describe('SEA means Sea Freight, AIR means Air Freight, FSA means First by Sea then by Air Freight, FAS means First by Air then by Sea Freight, RAI means Rail Freight, COU means Courier'),
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