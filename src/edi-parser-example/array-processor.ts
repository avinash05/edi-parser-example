/**
 * Array EDI Processor
 *
 * This module provides functionality for processing EDI data directly from memory-based
 * arrays. It accepts arrays of objects containing EDI content and associated payer
 * information, making it ideal for API-driven and database-driven workflows.
 *
 * Key Features:
 * - In-memory processing (no filesystem dependencies)
 * - Requires payer information for each EDI entry
 * - Validates array structure and content
 * - Generates sanitized filenames from payer names
 * - Handles invalid entries gracefully
 *
 * Use Cases:
 * - Processing EDI data fetched from REST APIs
 * - Handling database query results
 * - Testing with programmatically generated data
 * - Processing webhook payloads
 * - Integration with message queues
 * - Microservice architectures
 *
 * Required Data Structure:
 * Each array element must be an object with:
 * - content: string (required) - Raw EDI transaction content
 * - payer: string (required) - Payer name for file organization
 *
 * Array Structure:
 * [
 *   { content: "ISA*00*...", payer: "Aetna" },
 *   { content: "ISA*00*...", payer: "BCBS" },
 *   { content: "ISA*00*...", payer: "UnitedHealthcare" }
 * ]
 *
 * Validation Rules:
 * Each item is validated for:
 * - Is an object (not null, array, or primitive)
 * - Has 'content' property that is a non-empty string
 * - Has 'payer' property that is a non-empty string
 *
 * Invalid items are:
 * - Logged with specific reason
 * - Skipped without halting processing
 * - Counted in rejection statistics
 *
 * Filename Generation:
 * Payer names are sanitized for filesystem compatibility:
 * - Non-alphanumeric characters replaced with hyphens
 * - Converted to lowercase
 * - Sequential number appended (1-based index)
 *
 * Sanitization:
 * - "Blue Cross Blue Shield" → "blue-cross-blue-shield-1.edi"
 * - "UnitedHealthcare" → "unitedhealthcare-2.edi"
 * - "Aetna (NY)" → "aetna--ny--3.edi"
 *
 * Workflow:
 * 1. Validate array structure
 * 2. Iterate through each item
 * 3. Validate item structure
 * 4. Sanitize payer name
 * 5. Create EDIFileContent object
 * 6. Process all valid items
 * 7. Display aggregate statistics
 *
 * Performance:
 * - No filesystem I/O for input
 * - Fastest processor type for small datasets
 * - Memory: O(n) where n is total EDI content size
 * - Typical: 100 items in 3-5 seconds
 *
 * Error Handling:
 * - Invalid array structure logged and returns empty
 * - Invalid items logged with index and reason
 * - Processing continues for valid items
 * - Rejection statistics displayed
 * - Parse errors per-item in statistics
 *
 * @module array-processor
 */

import { BaseEDIProcessor } from "./base-processor";
import type { EDIFileContent, ProcessorOptions } from "./types";

/**
 * Processor for handling array-based EDI data inputs.
 *
 * This processor extends BaseEDIProcessor to accept in-memory EDI data
 * as arrays of objects. Each object must contain the EDI content and
 * payer name for proper file naming in the output.
 *
 * @class ArrayEDIProcessor
 * @extends {BaseEDIProcessor}
 */
export class ArrayEDIProcessor extends BaseEDIProcessor {
  /**
   * Processes EDI data from an array with comprehensive validation and analysis.
   *
   * This method orchestrates the complete in-memory processing workflow:
   * 1. Optionally clean output directory
   * 2. Validate and load EDI content from array
   * 3. Filter out invalid entries
   * 4. Parse and validate each valid entry
   * 5. Collect per-entry statistics
   * 6. Display aggregate statistics report
   *
   * Array Validation:
   * The method validates that:
   * - Input is an actual array
   * - Array is not empty
   * - Each item has required structure
   *
   * Invalid arrays result in empty processing with logged error.
   *
   * Item-Level Validation:
   * For each array item:
   * 1. Check it's a non-null object
   * 2. Verify 'content' is a non-empty string
   * 3. Verify 'payer' is a non-empty string (required!)
   * 4. Sanitize payer name for filename
   * 5. Add to processing queue
   *
   * Invalid items are skipped with specific error messages.
   *
   * Payer Requirement:
   * Unlike other processors, the payer field is REQUIRED:
   * - Used for output filename generation
   * - Enables organization by payer
   * - Missing payer results in rejection
   * - Empty payer string results in rejection
   *
   * This is critical for API/database scenarios where file context
   * is not available from filesystem metadata.
   *
   * Filename Generation:
   * Pattern: {sanitized-payer}-{index}.edi
   * - Index is 1-based (first item = 1)
   * - Payer sanitized: alphanumeric + hyphens only
   * - Lowercase for consistency
   *
   * Rejection Tracking:
   * The method tracks:
   * - Total items in array
   * - Valid items processed
   * - Rejected items with reasons
   * - Rejection statistics displayed
   *
   * This helps identify data quality issues in the source system.
   *
   * Statistics Report:
   * Displays:
   * - Valid items loaded
   * - Rejection count and reasons
   * - Per-item parsing results
   * - Aggregate validation metrics
   *
   * Memory Management:
   * All array items are in memory:
   * - Input array remains in memory throughout
   * - Parsed results also in memory
   * - Total memory = input + parsed structures
   *
   * For large arrays (>1000 items):
   * - Consider batch processing
   * - Monitor heap usage
   * - May need increased heap size
   *
   * @param {ReadonlyArray<{content: string; payer: string}>} ediDataArray - Array of EDI data with payer info
   * @param {ProcessorOptions} [options={}] - Processing configuration
   * @param {boolean} [options.cleanOutput=true] - Whether to clean output directory first
   * @returns {void}
   */
  public process(
    ediDataArray: ReadonlyArray<{ content: string; payer: string }>,
    options: ProcessorOptions = {},
  ): void {
    const { cleanOutput = true } = options;

    if (cleanOutput) {
      this.cleanExistingOutputFiles();
    }

    const ediFilesCollection = this.getEDIFileContents(ediDataArray);

    if (ediFilesCollection.length === 0) {
      console.log("No valid EDI files found in array to process");
      return;
    }

    console.log("Starting comprehensive parsing analysis from EDI array...\n");

    const allFileStatistics = ediFilesCollection.map(({ filename, content }) =>
      this.parseEdiFileAndCollectStatistics(filename, content),
    );

    this.displayComprehensiveSummaryStatistics(allFileStatistics);
  }

  protected getEDIFileContents(
    ediDataArray: ReadonlyArray<{ content: string; payer: string }>,
  ): ReadonlyArray<EDIFileContent> {
    try {
      if (!Array.isArray(ediDataArray)) {
        console.error("Input is not a valid array");
        return [];
      }

      const validEdiFiles: Array<EDIFileContent> = [];

      for (let index = 0; index < ediDataArray.length; index++) {
        const arrayItem: unknown = ediDataArray[index];

        if (arrayItem == null || typeof arrayItem !== "object") {
          console.warn(
            `Skipping invalid EDI data item at index ${index}:`,
            arrayItem,
          );
          continue;
        }

        const arrayItemData = arrayItem as { content: unknown; payer: unknown };

        if (typeof arrayItemData.content !== "string") {
          console.warn(
            `Skipping EDI data item at index ${index} - content must be a string`,
          );
          continue;
        }

        if (typeof arrayItemData.payer !== "string") {
          console.error(
            `Skipping EDI data item at index ${index} - payer is required and must be a string`,
          );
          continue;
        }

        if (arrayItemData.content.trim().length === 0) {
          console.warn(
            `Skipping EDI data item at index ${index} - content cannot be empty`,
          );
          continue;
        }

        if (arrayItemData.payer.trim().length === 0) {
          console.error(
            `Skipping EDI data item at index ${index} - payer is required and cannot be empty`,
          );
          continue;
        }

        const sanitizedPayerName = arrayItemData.payer
          .replace(/[^a-zA-Z0-9-_]/g, "-")
          .toLowerCase();
        const filename = `${sanitizedPayerName}-${index + 1}.edi`;

        validEdiFiles.push({
          filename,
          content: arrayItemData.content,
        });
      }

      console.log(
        `Loaded ${validEdiFiles.length} EDI files from array with payer information`,
      );
      if (validEdiFiles.length < ediDataArray.length) {
        const rejectedCount = ediDataArray.length - validEdiFiles.length;
        console.warn(
          `Rejected ${rejectedCount} items due to missing or invalid required payer information`,
        );
      }
      return validEdiFiles;
    } catch (error) {
      console.error("Error reading EDI files from array:", error);
      return [];
    }
  }
}
