/**
 * EDI Parser Example Application
 *
 * This file demonstrates the usage of the EDI parser library for processing
 * HIPAA X12 5010 271 eligibility response files. It showcases different
 * processor types created via the Factory Pattern.
 *
 * Processor Types Available:
 * - DirectoryProcessor: Recursively processes all .edi files in a directory
 * - FileProcessor: Processes a single .edi file
 * - JsonProcessor: Processes EDI data from JSON with filtering and pagination
 * - ArrayProcessor: Processes in-memory arrays of EDI content
 *
 * Uncomment the desired processor section below to run different processing modes.
 *
 * @module edi-parser-example
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
import * as path from "path";
import { EDIProcessorFactory } from "./edi-parser-example/index";
/* eslint-enable @typescript-eslint/no-unused-vars */

// Directory Processor
// Recursively scans and processes all .edi files in the specified directory
// const directoryProcessor = EDIProcessorFactory.createDirectoryProcessor();
// directoryProcessor.process(
//   path.join(__dirname, "edi-parser-example", "input"),
//   { cleanOutput: true }
// );

// File Processor
// Processes a single EDI file for detailed analysis
// const fileProcessor = EDIProcessorFactory.createFileProcessor();
// fileProcessor.process(
//   path.join(__dirname, "edi-parser-example", "input", "medicaid", "medicaid-1.edi"),
//   { cleanOutput: true }
// );

// JSON Processor
// Processes EDI data from JSON files with filtering and pagination support
// Options: statusFilter, limit, offset, cleanOutput
const jsonProcessor = EDIProcessorFactory.createJsonProcessor();
jsonProcessor.process(
  path.join(
    __dirname,
    "edi-parser-example",
    "input",
    "medicaid",
    "medicaid.json",
  ),
  {
    statusFilter: "Active",
    limit: 10,
    cleanOutput: true,
  },
);

// Array Processor
// Processes in-memory EDI data arrays with payer metadata
// Each array item requires: { content: string, payer: string }
// const arrayProcessor = EDIProcessorFactory.createArrayProcessor();
// const ediData = [
//   { content: "ISA*00*...", payer: "Aetna" },
//   { content: "ISA*00*...", payer: "BCBS" },
//   { content: "ISA*00*...", payer: "UnitedHealthcare" }
// ];
// arrayProcessor.process(ediData, { cleanOutput: true });
