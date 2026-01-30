/**
 * Processing Chain Builder - Factory for Creating EDI Processing Chains
 *
 * This module implements the Factory design pattern to create and configure
 * chains of EDI processors. It encapsulates the knowledge of which processors
 * are needed and how they should be connected, providing a clean interface
 * for setting up the complete processing pipeline.
 *
 * Key Responsibilities:
 * - Creates instances of all required processors
 * - Configures the processing chain in the correct order
 * - Provides a single entry point for chain construction
 * - Manages processor dependencies and relationships
 *
 * Processing Chain Flow:
 * 1. CSVReadingProcessor - Reads CSV file and processes each row
 * 2. DataDecodingProcessor - Decodes hex/compressed EDI data
 * 3. EDIValidationProcessor - Validates EDI structure and content
 * 4. EdiToRequestProcessor - Converts EDI to JSON request format
 * 5. RequestOutputProcessor - Outputs converted JSON requests
 * 6. ParsedOutputProcessor - Outputs complete parsed EDI data
 *
 * Design Pattern: Factory Method
 * - Encapsulates object creation logic
 * - Provides consistent chain configuration
 * - Easy to modify or extend processing pipeline
 */
import type { PairProcessor } from "./base-processor";
import { CSVReadingProcessor } from "./csv-reading-processor";
import { DataDecodingProcessor } from "./data-decoding-processor";
import { EDIValidationProcessor } from "./edi-validation-processor";
import { EdiToRequestProcessor } from "./edi-to-request-processor";
import { RequestOutputProcessor } from "./request-output-processor";
import { ParsedOutputProcessor } from "./parsed-output-processor";
// import { EDIOutputProcessor } from './edi-output-processor'; // Optional EDI file output

/**
 * Factory class responsible for creating and configuring EDI processing chains
 *
 * This class encapsulates the knowledge of:
 * - Which processors are needed for complete EDI processing
 * - The correct order for chaining processors
 * - How to properly configure processor relationships
 *
 * Benefits:
 * - Single responsibility for chain construction
 * - Easy to modify processing pipeline
 * - Consistent processor configuration
 * - Centralized dependency management
 */
export class ProcessingChainBuilder {
  /**
   * Creates and configures a complete EDI processing chain
   *
   * This method creates instances of all required processors and chains them
   * together in the proper order. The chain is designed to handle the complete
   * lifecycle of EDI processing from CSV input to JSON/file output.
   *
   * Chain Order (Critical - Do Not Reorder):
   * 1. CSVReadingProcessor - Must be first to read input data
   * 2. DataDecodingProcessor - Must decode data before validation
   * 3. EDIValidationProcessor - Must validate before conversion
   * 4. EdiToRequestProcessor - Converts validated EDI to JSON
   * 5. RequestOutputProcessor - Outputs JSON eligibility requests
   * 6. ParsedOutputProcessor - Must be last for final output
   */
  public buildProcessingChain(): PairProcessor {
    // Create processor instances
    // Each processor has a specific responsibility in the pipeline

    // Reads CSV file and creates transaction pairs from each row
    const csvReadingProcessor = new CSVReadingProcessor();

    // Decodes hex-encoded and compressed EDI data
    const dataDecodingProcessor = new DataDecodingProcessor();

    // Validates EDI structure and content using parser factory
    const ediValidationProcessor = new EDIValidationProcessor();

    // Converts EDI transactions to JSON eligibility request format
    const ediToRequestProcessor = new EdiToRequestProcessor();

    // Outputs converted JSON eligibility requests to file
    const requestOutputProcessor = new RequestOutputProcessor();

    // Optional: Outputs individual EDI files (currently commented out)
    // const ediOutputProcessor = new EDIOutputProcessor();

    // Outputs complete parsed EDI transaction pairs (final step)
    const parsedOutputProcessor = new ParsedOutputProcessor();

    // Chain all processors together in the correct sequence
    // The order is critical - each processor depends on the work of previous processors
    csvReadingProcessor
      .setNext(dataDecodingProcessor) // Decode data after reading
      .setNext(ediValidationProcessor) // Validate decoded data
      .setNext(ediToRequestProcessor) // Convert valid data to JSON
      .setNext(requestOutputProcessor) // Output JSON requests
      // .setNext(ediOutputProcessor)     // Optionally output individual EDI files
      .setNext(parsedOutputProcessor); // Final output with complete data

    // Return the first processor in the chain (entry point)
    return csvReadingProcessor;
  }
}
