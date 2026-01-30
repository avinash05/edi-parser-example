/**
 * CSV Reading Processor - Entry Point for EDI Data Processing Pipeline
 *
 * This processor serves as the entry point for the entire EDI processing chain.
 * It reads CSV files containing encoded EDI data and creates the initial data
 * structures that flow through the processing pipeline.
 *
 * Key Responsibilities:
 * - Read and parse CSV files using streaming for memory efficiency
 * - Create ProcessingContext for each row
 * - Initialize ParsedEDITransactionPair structures
 * - Manage the processing lifecycle from row-by-row to batch operations
 * - Coordinate between individual row processing and final batch processing
 *
 * CSV File Format Expected:
 * - Column 1: 270 eligibility request data (hex-encoded/compressed)
 * - Column 2: 271 eligibility response data (hex-encoded/compressed)
 * - Column 3: Status (e.g., "Active", "Inactive")
 * - Column 4: Payer ID
 * - Column 5: Payer ID Code
 * - Column 6: Payer Name
 * - No headers expected in CSV file
 *
 * Processing Flow:
 * 1. Open CSV file using streaming reader (memory efficient)
 * 2. For each row:
 *    a. Create initial transaction pair structure
 *    b. Pass through processing chain for decoding/validation
 *    c. Collect processed pairs
 * 3. After all rows processed:
 *    a. Pass complete collection to chain for final output operations
 *    b. Generate summary statistics
 *
 * Error Handling:
 * - Individual row processing errors don't stop the entire process
 * - Failed rows are still included in output with error status
 * - Stream errors and file access errors are propagated
 *
 * Memory Management:
 * - Uses streaming CSV parser to handle large files efficiently
 * - Processes one row at a time to minimize memory footprint
 * - Accumulates results only after processing for batch operations
 */
import { createReadStream } from "fs";
import { PairProcessor } from "./base-processor";
import type {
  ProcessingContext,
  CSVRow,
  ParsedEDITransactionPair,
} from "./types";

// Import csv-parser library for streaming CSV processing
import csv from "csv-parser";

/**
 * CSV Reading Processor - First processor in the EDI processing chain
 *
 * This processor handles the complete lifecycle of CSV file processing:
 * - File reading and parsing
 * - Row-by-row processing through the chain
 * - Collection of processed results
 * - Batch processing for final output
 *
 * Design Patterns Used:
 * - Chain of Responsibility: Passes processing to next processor
 * - Template Method: Follows standard processor interface
 * - Streaming: Uses Node.js streams for efficient file processing
 */
export class CSVReadingProcessor extends PairProcessor {
  /**
   * Main processing method that orchestrates CSV file reading and processing
   *
   * This method overrides the base class process method to handle the unique
   * requirements of CSV file processing. Unlike other processors that handle
   * individual contexts, this processor manages the entire file lifecycle.
   *
   * Processing Stages:
   * 1. Validation - Ensures required parameters are present
   * 2. Row Processing - Streams through CSV and processes each row
   * 3. Batch Processing - Processes complete collection for final output
   */
  public override async process(context: ProcessingContext): Promise<void> {
    const { csvFilePath, outputDir } = context;

    // Validate required parameters
    if (csvFilePath == null || csvFilePath.length === 0) {
      throw new Error("CSV file path is required for processing");
    }

    // Collection of all processed transaction pairs
    const parsedTransactionPairs: ParsedEDITransactionPair[] = [];

    // Row counter for tracking processing progress and providing audit trail
    let rowCount = 0;

    // Return Promise to handle async stream processing
    return new Promise((resolve, reject) => {
      createReadStream(csvFilePath)
        .pipe(csv({ headers: false })) // No headers expected in CSV file
        .on("data", async (row: CSVRow) => {
          rowCount++;

          // Initialize transaction pair structure for this row
          // Each row potentially contains both request (270) and response (271) data
          const pair: ParsedEDITransactionPair = {
            rowNumber: rowCount,
            request: null, // Will be populated by DataDecodingProcessor
            response: null, // Will be populated by DataDecodingProcessor
            pairComplete: false, // Will be updated by EDIValidationProcessor
            summary: {
              bothValid: false,
              totalErrors: 0,
              totalWarnings: 0,
            },
          };

          // Create processing context for this specific row
          // This context will flow through the entire processing chain
          const rowContext: ProcessingContext = {
            row, // Raw CSV row data
            rowNumber: rowCount,
            pair, // Transaction pair structure to be populated
            csvFilePath, // For metadata and error reporting
          };

          // Include output directory if provided
          if (outputDir != null && outputDir.length > 0) {
            rowContext.outputDir = outputDir;
          }

          try {
            // Process this row through the next processor in chain
            // Each processor will add its specific processing logic
            if (this.nextProcessor) {
              await this.nextProcessor.process(rowContext);
            }

            // Add the processed pair to results collection
            // Even if processing failed, we include the pair for reporting
            if (rowContext.pair) {
              parsedTransactionPairs.push(rowContext.pair);
            }
          } catch (error) {
            // Log error but continue processing other rows
            console.error(`Error processing row ${rowCount}:`, error);

            // Still add the pair to maintain row count consistency
            // Mark as invalid so it's clear there was an issue
            pair.summary.totalErrors = 1;
            parsedTransactionPairs.push(pair);
          }
        })
        .on("end", async () => {
          console.log(`✅ Processed ${rowCount} CSV rows successfully`);

          // Update context with complete collection for batch processing
          // This enables processors that need to work with the full dataset
          context.allPairs = parsedTransactionPairs;

          // Create final processing context for batch operations
          // Some processors (like output processors) need all data at once
          const outputContext: ProcessingContext = {
            ...context,
            allPairs: parsedTransactionPairs,
          };

          try {
            // Execute final batch processing through the chain
            // This handles operations that need the complete dataset
            if (this.nextProcessor) {
              await this.nextProcessor.process(outputContext);
            }

            // Processing completed successfully
            resolve();
          } catch (batchError) {
            // Batch processing failed
            console.error("Error during batch processing:", batchError);
            reject(batchError);
          }
        })
        .on("error", (error) => {
          // Stream processing error (file access, parsing, etc.)
          console.error("Error reading CSV file:", error);
          reject(error);
        });
    });
  }

  /**
   * Handle method implementation (required by base class)
   *
   * For this processor, all logic is handled in the overridden process method
   * since CSV reading requires special streaming behavior that doesn't fit
   * the standard row-by-row processing pattern.
   *
   * @param _context - Processing context (unused for this processor)
   */
  protected handle(_context: ProcessingContext): void {
    // CSV reading logic is implemented in the process method above
    // This method exists to satisfy the abstract base class interface
  }
}
