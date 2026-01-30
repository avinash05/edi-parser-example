/**
 * Type definitions for CSV Extractor with Chain of Responsibility Pattern
 *
 * This module defines the core data structures and interfaces used throughout
 * the CSV extraction and processing pipeline. The types support the chain of
 * responsibility design pattern for processing EDI data from CSV files.
 */

/**
 * Represents a single row from a CSV file as key-value pairs
 * Used by csv-parser to provide structured access to CSV data
 */
export interface CSVRow {
  [key: string]: string;
}

/**
 * Result of data decoding operations (hex, compression, etc.)
 * Tracks the original data, decoded result, format type, and validation status
 */
export interface DecodedData {
  original: string;
  decoded?: string;
  type: "hex" | "compressed" | "unknown";
  isValid: boolean;
}

/**
 * Represents a processed EDI transaction (270 request or 271 response)
 * Contains all information needed for validation, conversion, and output
 */
export interface ProcessedEDITransaction {
  type: "270" | "271" | "unknown";
  rawData: string;
  decodedData: string;
  isValid: boolean;
  segments?: string[];
  errors: string[];
  warnings: string[];
  convertedData?: unknown;
}

/**
 * Represents a paired set of EDI transactions (request + response)
 * This is the core data structure processed through the chain
 */
export interface ParsedEDITransactionPair {
  rowNumber: number;
  status?: string; // Status field from CSV (3rd column)
  payerId?: string; // Payer ID from CSV (4th column)
  payerIdCode?: string; // Payer ID code from CSV (5th column)
  payerName?: string; // Payer name from CSV (6th column)
  request: ProcessedEDITransaction | null;
  response: ProcessedEDITransaction | null;
  pairComplete: boolean;
  summary: {
    bothValid: boolean;
    totalErrors: number;
    totalWarnings: number;
  };
}

/**
 * Processing context passed through the chain of responsibility
 * Contains all data and metadata needed for processing at each stage
 */
export interface ProcessingContext {
  csvFilePath?: string;
  outputDir?: string;
  row?: CSVRow;
  rowNumber?: number;
  pair?: ParsedEDITransactionPair;
  allPairs?: ParsedEDITransactionPair[];
}
