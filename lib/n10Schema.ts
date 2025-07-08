// N10 schema enums and types for use across the application
import { z } from 'zod';

// Enums based on N10 field specifications
export const MODE_OF_TRANSPORT_ENUM = ['air', 'sea'] as const;
export const GROSS_WEIGHT_UNIT_ENUM = ['KG', 'LB'] as const;
export const PREFERENCE_SCHEME_TYPE_ENUM = ['GEN'] as const; // Can be extended with other schemes
export const RELATED_TRANSACTION_ENUM = ['Y', 'N'] as const;

// N10 Delivery Address Schema
const n10DeliveryAddressSchema = z.object({
  id: z.number().nullable().optional(),
  name: z.string().max(200).nullable().optional(),
  address_1: z.string().max(40).nullable().optional(),
  address_2: z.string().max(40).nullable().optional(),
  suburb: z.string().max(46).nullable().optional().describe("also known as locality"),
  state: z.string().max(10).nullable().optional(),
  postcode: z.string().max(12).nullable().optional(),
  country_code: z.string().length(2).nullable().optional(),
  phone_number: z.string().nullable().optional(),
});

// N10 Transport Line Schema
const n10TransportLineSchema = z.object({
  id: z.number().nullable().optional(),
  cargo_type: z.string().nullable().optional(),
  container_number: z.string().max(17).nullable().optional(),
  masterbill: z.string().max(35).nullable().optional().describe("also known as oceanbill in sea transport"),
  housebill: z.string().max(35).nullable().optional().describe("House Air Waybill No"),
  number_of_packages: z.string().nullable().optional(),
  packing_unit_count: z.string().nullable().optional(),
  marks_and_desc: z.string().nullable().optional(),
  consignment_reference: z.string().nullable().optional(),
  is_visual_exam_indicator: z.boolean().default(false),
});

// N10 Risk Answer Schema
const n10RiskAnswerSchema = z.object({
  id: z.number().nullable().optional(),
  risk_identifier: z.string().nullable().optional(),
  risk_answer: z.string().nullable().optional(),
  permit_license: z.string().nullable().optional(),
});

// N10 Quarantine Premise Schema
const n10QuarantinePremiseSchema = z.object({
  id: z.number().nullable().optional(),
  premises_id: z.string().nullable().optional(),
  aep_processing: z.string().nullable().optional(),
});

// N10 Quarantine Package Schema
const n10QuarantinePackageSchema = z.object({
  id: z.number().nullable().optional(),
  number: z.string().nullable().optional(),
  package_type: z.string().nullable().optional(),
});

// N10 Tariff Line Schema
const n10TariffLineSchema = z.object({
  id: z.number().nullable().optional(),
  tariff_group_id: z.number().nullable().optional(),
  supplier_id: z.string().length(11).nullable().optional(),
  tariff_class_number: z.string().length(8).nullable().optional(),
  stat_code: z.string().length(2).nullable().optional(),
  tariff_class_rate_number: z.string().max(3).nullable().optional(),
  valuation_basis_type: z.string().nullable().optional(),
  good_desc: z.string().max(250).describe("Required field - description of goods"),
  country_of_origin: z.string().length(2).describe("Required field - must be valid country code"),
  quantity_1: z.string().nullable().optional(),
  quantity_1_unit: z.string().nullable().optional(),
  type_price_amount: z.string().nullable().optional(),
  type_price_currency: z.string().nullable().optional(),
  preference_origin: z.string().nullable().optional(),
  preference_scheme_type: z.string().describe("Required field - if GEN, preference_origin and preference_rule_type must be blank"),
  preference_rule_type: z.string().nullable().optional(),
  is_related_transaction_yn: z.enum(RELATED_TRANSACTION_ENUM).nullable().optional(),
  gst_exemption_code: z.string().nullable().optional(),
  import_permit_number: z.string().nullable().optional(),
  container_numbers: z.array(z.string()).optional(),
  risk_answers: z.array(n10RiskAnswerSchema).optional(),
  quarantine_premises: z.array(n10QuarantinePremiseSchema).optional(),
  quarantine_packages: z.array(n10QuarantinePackageSchema).optional(),
  additional_fields: z.object({
    amber_reason_type: z.string().nullable().optional(),
    multiple_clearance_code: z.string().nullable().optional(),
    tariff_classification_instrument_no: z.string().nullable().optional(),
    tariff_classification_instrument_type: z.string().nullable().optional(),
    drawback_claim_id: z.string().nullable().optional(),
    dcx: z.string().nullable().optional().describe("Dumping export country code"),
    other_duty_factor: z.number().nullable().optional(),
    dumping_duty: z.number().nullable().optional(),
    dumping_rate_of_exchange: z.number().nullable().optional(),
    dumping_exemption_type: z.string().nullable().optional(),
    dumping_specification_number: z.string().nullable().optional(),
    dumping_export_price: z.string().nullable().optional(),
    dumping_export_price_currency: z.string().nullable().optional(),
    duty: z.number().nullable().optional(),
    effective_duty_date: z.string().nullable().optional(),
    firm_order_date: z.string().nullable().optional(),
  }).optional(),
});

// N10 Lodgement Question Schema
const n10LodgementQuestionSchema = z.object({
  id: z.number().nullable().optional(),
  question_identifier: z.string().nullable().optional(),
  answer: z.string().nullable().optional(),
});

// N10 Tariff Group Schema
const n10TariffGroupSchema = z.object({
  id: z.number().nullable().optional(),
  default_supplier_ccid: z.string().nullable().optional(),
  default_is_related_transaction_yn: z.string().nullable().optional(),
  default_valuation_basis_type: z.string().nullable().optional(),
  default_country_of_origin: z.string().nullable().optional(),
  default_gst_exemption_code: z.string().nullable().optional(),
  default_import_permit_number: z.string().nullable().optional(),
  default_preference_origin: z.string().nullable().optional(),
  default_preference_scheme_type: z.string().nullable().optional(),
  default_preference_rule_type: z.string().nullable().optional(),
});

// Main N10 Schema
export const n10Schema = z.object({
  mode_of_transport: z.enum(MODE_OF_TRANSPORT_ENUM).nullable().optional(),
  importer_abn_ccid: z.string().length(11).nullable().optional(),
  importer_cac: z.string().length(3).nullable().optional(),
  importer_ref: z.string().max(20).nullable().optional(),
  importer_declaration_identifer: z.string().nullable().optional(),
  branch_id: z.string().length(6).nullable().optional(),
  broker_ref: z.string().max(20).nullable().optional(),
  broker_license_number: z.string().max(5).nullable().optional(),
  airline_code: z.string().max(10).nullable().optional(),
  vessel_id: z.string().max(8).nullable().optional(),
  voyage_number: z.string().max(6).nullable().optional(),
  loading_port: z.string().length(5).nullable().optional(),
  discharge_port: z.string().length(5).nullable().optional(),
  first_arrival_port: z.string().length(5).nullable().optional(),
  destination_port: z.string().length(5).nullable().optional(),
  arrival_date: z.string().nullable().optional().describe("Date format: YYYY-MM-DD"),
  first_arrival_date: z.string().nullable().optional().describe("Date format: YYYY-MM-DD"),
  gross_weight: z.string().nullable().optional(),
  gross_weight_unit: z.enum(GROSS_WEIGHT_UNIT_ENUM).nullable().optional(),
  delivery_address: n10DeliveryAddressSchema.describe("Required field"),
  invoice_term_type: z.string().nullable().optional(),
  valuation_date: z.string().nullable().optional().describe("Date format: YYYY-MM-DD"),
  invoice_total_amount: z.string().describe("Required field - must be greater than 0"),
  invoice_total_currency: z.string().nullable().optional(),
  overseas_freight_amount: z.string().nullable().optional(),
  overseas_freight_currency: z.string().nullable().optional(),
  overseas_insurance_amount: z.string().nullable().optional(),
  overseas_insurance_currency: z.string().nullable().optional(),
  other_additional_amount: z.string().nullable().optional(),
  other_additional_currency: z.string().nullable().optional(),
  free_on_board_amount: z.string().nullable().optional(),
  free_on_board_currency: z.string().nullable().optional(),
  cost_insurance_freight_amount: z.string().nullable().optional(),
  cost_insurance_freight_currency: z.string().nullable().optional(),
  foreign_inland_freight_amount: z.string().nullable().optional(),
  foreign_inland_freight_currency: z.string().nullable().optional(),
  packing_cost_amount: z.string().nullable().optional(),
  packing_cost_currency: z.string().nullable().optional(),
  commision_amount: z.string().nullable().optional(),
  commision_currency: z.string().nullable().optional(),
  discount_amount: z.string().nullable().optional(),
  discount_currency: z.string().nullable().optional(),
  landing_charge_amount: z.string().nullable().optional(),
  landing_charge_currency: z.string().nullable().optional(),
  other_deduction_amount: z.string().nullable().optional(),
  other_deduction_currency: z.string().nullable().optional(),
  aqis_concern_type: z.string().nullable().optional(),
  is_eft_payment: z.boolean().default(false),
  is_sac_declaration: z.boolean().default(false),
  is_pay_duty: z.boolean().default(false),
  has_payrec_edi_message: z.boolean().default(false),
  quarantine_inspection_location: z.string().nullable().optional(),
  bank_account_owner_type: z.string().nullable().optional(),
  bank_account_number: z.string().nullable().optional(),
  bank_account_name: z.string().nullable().optional(),
  bank_account_bsb: z.string().nullable().optional(),
  transport_lines: z.array(n10TransportLineSchema).optional(),
  tariff_lines: z.array(n10TariffLineSchema).optional(),
  lodgement_questions: z.array(n10LodgementQuestionSchema).optional(),
  tariff_groups: z.array(n10TariffGroupSchema).optional(),
});

export type N10Schema = z.infer<typeof n10Schema>;
export type N10DeliveryAddress = z.infer<typeof n10DeliveryAddressSchema>;
export type N10TransportLine = z.infer<typeof n10TransportLineSchema>;
export type N10TariffLine = z.infer<typeof n10TariffLineSchema>;
export type N10LodgementQuestion = z.infer<typeof n10LodgementQuestionSchema>;
export type N10TariffGroup = z.infer<typeof n10TariffGroupSchema>;
