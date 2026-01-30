/**
 * CSV Extractor Module - Comprehensive EDI Processing Pipeline
 *
 * This module provides a complete solution for processing EDI (Electronic Data Interchange)
 * transactions stored in CSV files. It implements a Chain of Responsibility design pattern
 * to create a flexible, maintainable, and extensible processing pipeline.
 *
 * Module Features:
 * - Chain of Responsibility pattern for modular processing
 * - Support for multiple EDI encoding formats (hex, compression, plain text)
 * - Comprehensive validation using project's EDI parser infrastructure
 * - Multiple output formats (JSON requests, parsed data, individual EDI files)
 * - Robust error handling and detailed reporting
 * - Memory-efficient streaming processing for large files
 *
 * Processing Pipeline:
 * 1. CSV Reading - Stream-based file processing with row-by-row handling
 * 2. Data Decoding - Multi-format decoding (hex, compression, XML extraction)
 * 3. EDI Validation - Comprehensive structural and business rule validation
 * 4. JSON Conversion - Transform EDI to structured JSON eligibility requests
 * 5. Output Generation - Multiple output formats for different use cases
 *
 * Supported Input Formats:
 * - CSV files with encoded EDI data in columns
 * - Hexadecimal-encoded EDI transactions
 * - Compressed EDI data (zlib/gzip)
 * - XML-wrapped EDI content
 * - Plain text EDI transactions
 *
 * Output Formats:
 * - JSON eligibility requests (for API integration)
 * - Complete parsed transaction data (for analysis)
 * - Individual EDI files (for trading partner exchange)
 */
export * from "./types";
export * from "./base-processor";
export * from "./csv-reading-processor";
export * from "./data-decoding-processor";
export * from "./edi-validation-processor";
export * from "./edi-to-request-processor";
export * from "./request-output-processor";
export * from "./parsed-output-processor";
export * from "./edi-output-processor";
export * from "./chain-builder";
