# EDI Parser Examples

Example applications demonstrating the usage of the @edi-parser/core library for processing X12 HIPAA 5010 271 Health Care Eligibility Benefit Response files.

## Setup

1. Make sure the main edi-parser library is built:
   `ash
   cd ../edi-parser
   npm run build
   `

2. Install dependencies:
   `ash
   npm install
   `

## Running Examples

### EDI Parser Example
Demonstrates different processor types for EDI file processing:
`ash
npm run edi-parser
`

### EDI Normalizer Example
Shows how to normalize EDI data into business-friendly JSON:
`ash
npm run edi-normalizer
`

### CSV Extractor Example
Extracts and processes EDI data from CSV files:
`ash
npm run csv-extractor
`

### DWS Client Example
Demonstrates the DentalXchange Web Services client:
`ash
npm run dws-client
`

### Simplified Demo
A simple demonstration of the library:
`ash
npm run simplified
`

## Project Structure

- di-parser-example/ - EDI parser processors using Factory Pattern
- di-normalizer-example/ - Normalization examples with input/output
- csv-extractor-example/ - CSV processing chain with multiple processors
- dws-client-example/ - SOAP client examples
- di-files/ - Sample EDI files organized by payer
- di-output/ - Sample output files
