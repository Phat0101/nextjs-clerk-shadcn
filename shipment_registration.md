# Shipment Document Processing Instructions
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
## JSON Schema:
{
  “mode”: {
    “transport”: “enum [‘SEA’, ‘AIR’, ‘FSA’, ‘FAS’, ‘RAI’, ‘COU’]“,
    “container”: “enum [‘FCL’, ‘LCL’, ‘BLK’, ‘EBK’, ‘BCN’, ‘SCN’, ‘HCK’, ‘MCK’]“,
    “type”: “enum [‘STD’, ‘CLM’, ‘BCL’, ‘BCN’, ‘HVL’, ‘HCK’, ‘SCN’]“,
    “freight_type”: “enum [‘Sea Freight’, ‘Air Freight’, ‘First by Sea then by Air Freight’, ‘First by Air then by Sea Freight’, ‘Local Freight’, ‘Rail Freight’, ‘Courier’]”
  },
  “consignor”: {
    “company”: “string”,
    “address”: “string”,
    “country”: “enum [country_codes]“,
    “override”: “boolean”
  },
  “consignee”: {
    “company”: “string”,
    “address”: “string”,
    “city_state”: “string”,
    “country”: “enum [country_codes]“,
    “override”: “boolean”
  },
  “details”: {
    “house_bill”: “string”,
    “domestic”: “boolean”,
    “origin”: “enum [port_codes]“,
    “destination”: “enum [port_codes]“,
    “etd”: “date”,
    “eta”: “date”,
    “weight_value”: “number”,
    “weight_unit”: “enum [‘KG’, ‘DT’, ‘PH’, ‘GT’, ‘KT’, ‘LT’, ‘MT’, ‘OT’, ‘Decitons’, ‘Grams’, ‘Hectograms’, ‘Kilotons’, ‘Pounds’, ‘Pounds Troy’, ‘Metric Tons’, ‘Ounces Troy’]“,
    “volume_value”: “number”,
    “volume_unit”: “enum [‘M3’, ‘CC’, ‘CF’, ‘CI’, ‘CY’, ‘GA’, ‘GI’, ‘ML’, ‘Cubic Centimetres’, ‘Cubic Feet’, ‘Cubic Inches’, ‘Cubic Yards’, ‘US Gallons’, ‘Imperial Gallons’, ‘Litre’, ‘Cubic Metres’]“,
    “chargeable_value”: “number”,
    “chargeable_unit”: “enum [‘M3’, ‘CC’, ‘CF’, ‘CI’, ‘CY’, ‘GA’, ‘GI’, ‘ML’, ‘Cubic Centimetres’, ‘Cubic Feet’, ‘Cubic Inches’, ‘Cubic Yards’, ‘US Gallons’, ‘Imperial Gallons’, ‘Litre’, ‘Cubic Metres’]“,
    “packages_count”: “number”,
    “packages_type”: “enum [‘BAG’, ‘BBG’, ‘BSK’, ‘BLU’, ‘BOT’, ‘BOX’, ‘CAS’, ‘COI’, ‘CRT’, ‘CTN’, ‘CYL’, ‘DOZ’, ‘DRM’, ‘ENV’, ‘GRS’, ‘KEG’, ‘MIX’, ‘PAI’, ‘PCE’, ‘PKG’, ‘PLT’, ‘REL’, ‘RLL’, ‘ROL’, ‘SHT’, ‘SKD’, ‘SPL’, ‘TOT’, ‘TUB’, ‘UNT’]“,
    “wv_ratio”: “number”,
    “inners_count”: “number”,
    “inners_type”: “enum [‘BAG’, ‘BBG’, ‘BSK’, ‘BLU’, ‘BOT’, ‘BOX’, ‘CAS’, ‘COI’, ‘CRT’, ‘CTN’, ‘CYL’, ‘DOZ’, ‘DRM’, ‘ENV’, ‘GRS’, ‘KEG’, ‘MIX’, ‘PAI’, ‘PCE’, ‘PKG’, ‘PLT’, ‘REL’, ‘RLL’, ‘ROL’, ‘SHT’, ‘SKD’, ‘SPL’, ‘TOT’, ‘TUB’, ‘UNT’]“,
    “goods_value_amount”: “number”,
    “goods_value_currency”: “enum [‘AUD’, ‘USD’, ‘EUR’, ‘CNY’, ‘GBP’]“,
    “insurance_value_amount”: “number”,
    “insurance_value_currency”: “enum [‘AUD’, ‘USD’, ‘EUR’, ‘CNY’, ‘GBP’]“,
    “description”: “string”,
    “marks_numbers”: “string”,
    “incoterm”: “enum [‘FOB’, ‘CFR’, ‘CIF’, ‘CIP’, ‘CPT’, ‘DAP’, ‘DAT’, ‘DDP’, ‘DPU’, ‘EXW’, ‘FAS’, ‘FC1’, ‘FC2’, ‘FCA’]“,
    “free_on_board”: “boolean”,
    “spot_rate”: “number”,
    “spot_rate_type”: “enum [‘STD’, ‘FRT’, ‘FPR’]“,
    “use_standard_rate”: “boolean”,
    “service_level”: “enum [‘STD’, ‘Standard’]“,
    “release_type”: “enum [‘EBL’, ‘BSD’, ‘BTD’, ‘CSH’, ‘CAD’, ‘ERC’, ‘LCR’, ‘NON’, ‘OBL’, ‘OBR’, ‘Express Bill of Lading’, ‘Sight Draft (Bank Release)’, ‘Time Draft (Bank Release)’, ‘Company/Cash/Cheque’, ‘Cash Against Documents’, ‘Express Release’, ‘Letter of Credit (Bank Release)’, ‘Not Negotiable unless consigned to Order’, ‘Original Bill - Surrender at Origin’, ‘Original Bill Required at Destination’]“,
    “charges_apply”: “enum [‘SHW’, ‘NON’, ‘PPD’, ‘AGR’, ‘ALL’, ‘OPC’, ‘CPP’, ‘CAL’, ‘Show Collect Charges’, ‘No Charges showing’, ‘Show Prepaid Charges’, ‘Show As Agreed in the charges section’, ‘Show Prepaid & Collect Charges’, ‘Show Original As Agreed & Copy with Collect Charges’, ‘Show Original As Agreed & Copy with Prepaid Charges’, ‘Show Original As Agreed & Copy with Prepaid & Collect Charges’]“,
    “phase”: “enum [‘ALL’, ‘Open Security’]“,
    “aqis_status”: “string”,
    “customs_status”: “string”,
    “subject_to_aqis”: “boolean”,
    “subject_to_jfis”: “boolean”,
    “order_refs”: “string”
  }
}
## Example Output:
```json
{
  “mode”: {
    “transport”: “SEA”,
    “container”: “FCL”,
    “type”: “STD”,
    “freight_type”: “Sea Freight”
  },
  “consignor”: {
    “company”: “ABC Trading Co Ltd”,
    “address”: “123 Export Street, Shanghai 200001",
    “country”: “CN”,
    “override”: false
  },
  “consignee”: {
    “company”: “XYZ Import Pty Ltd”,
    “address”: “456 Harbour Rd”,
    “city_state”: “Sydney NSW 2000",
    “country”: “AU”,
    “override”: false
  },
  “details”: {
    “house_bill”: “HBL-2024-001234",
    “domestic”: false,
    “origin”: “CNSHA”,
    “destination”: “AUSYD”,
    “etd”: “2024-03-15”,
    “eta”: “2024-03-28”,
    “weight_value”: 15000,
    “weight_unit”: “KG”,
    “volume_value”: 25.5,
    “volume_unit”: “M3”,
    “chargeable_value”: 25.5,
    “chargeable_unit”: “M3",
    “packages_count”: 100,
    “packages_type”: “CTN”,
    “wv_ratio”: 588.24,
    “inners_count”: null,
    “inners_type”: null,
    “goods_value_amount”: 50000,
    “goods_value_currency”: “USD”,
    “insurance_value_amount”: 52000,
    “insurance_value_currency”: “USD”,
    “description”: “Electronic Components - Various Models”,
    “marks_numbers”: “ABC-2024-ELEC”,
    “incoterm”: “FOB”,
    “free_on_board”: true,
    “spot_rate”: 1250,
    “spot_rate_type”: “STD”,
    “use_standard_rate”: false,
    “service_level”: “STD”,
    “release_type”: “EBL”,
    “charges_apply”: “PPD”,
    “phase”: “ALL”,
    “aqis_status”: “Cleared”,
    “customs_status”: “Pending”,
    “subject_to_aqis”: true,
    “subject_to_jfis”: false,
    “order_refs”: “PO-2024-5678”
  }
}
```
## Output Requirements:
- Follow JSON schema format exactly
- Use specified enums precisely
- Output in markdown code block (```)
- Never deviate from schema structure
- All dates in YYYY-MM-DD format
- Numbers as numeric values, not strings
Process the document and return the extracted/analyzed data.