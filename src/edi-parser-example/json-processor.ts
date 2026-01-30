/**
 * JSON EDI Processor
 *
 * This module provides functionality for processing EDI data stored in JSON format
 * with advanced filtering, pagination, and offset capabilities. It's designed for
 * handling exported eligibility response datasets efficiently.
 *
 * Key Features:
 * - Status-based filtering (e.g., "Active", "Inactive")
 * - Pagination with limit and offset
 * - Handles large JSON datasets efficiently
 * - Extracts EDI from nested JSON structures
 * - Validates JSON structure before processing
 *
 * Expected JSON Structure:
 * The processor expects a JSON array where each element has:
 * [
 *   {
 *     "status": "Active",              // Optional: for filtering
 *     "rowNumber": 123,                 // Optional: preserved in output
 *     "response": {
 *       "decodedData": "ISA*00*..."   // Required: actual EDI content
 *     }
 *   }
 * ]
 *
 * Required Fields:
 * - response.decodedData: Must be a non-empty string containing EDI content
 *
 * Optional Fields:
 * - status: Used for filtering if statusFilter option provided
 * - rowNumber: Used in filename, falls back to array index + 1
 *
 * Use Cases:
 * - Processing exported eligibility response datasets
 * - Filtering large datasets by status
 * - Paginated processing of huge collections
 * - Analyzing subsets of production data
 * - Quality assurance on filtered data
 * - Performance testing with controlled datasets
 *
 * Filtering Options:
 * - statusFilter: Only process items with matching status value
 * - limit: Maximum number of valid items to process
 * - offset: Skip this many valid items before processing
 *
 * Filter Application Order:
 * 1. Status filter applied first (if specified)
 * 2. Offset skips valid items after filtering
 * 3. Limit stops after processing specified count
 *
 * This allows for:
 * - Processing all "Active" records: statusFilter="Active"
 * - Processing records 100-200: offset=100, limit=100
 * - Processing first 50 "Active": statusFilter="Active", limit=50
 *
 * Filename Generation:
 * Pattern: {json-filename}-{rowNumber}.edi
 * - JSON filename extracted from input path
 * - rowNumber from JSON or array index
 * - Sanitized for filesystem compatibility
 *
 * "medicaid.json" record 584 → "medicaid-584.edi"
 *
 * Workflow:
 * 1. Read and parse JSON file
 * 2. Validate JSON is an array
 * 3. Iterate through array items
 * 4. Apply status filter (if specified)
 * 5. Apply offset (skip items)
 * 6. Extract EDI content
 * 7. Apply limit (stop after count)
 * 8. Process all valid entries
 * 9. Display aggregate statistics
 *
 * Performance:
 * - JSON parsing: O(n) where n is JSON file size
 * - Filtering: O(m) where m is array length
 * - Processing: O(k) where k is items processed
 * - Memory: All items loaded into memory
 * - Typical: 1000-item JSON in 5-10 seconds
 *
 * Large File Handling:
 * For JSON files with 10,000+ records:
 * - Use offset and limit for batching
 * - Process in chunks (e.g., 100 at a time)
 * - Monitor memory usage
 * - Consider streaming JSON parser for very large files
 *
 * Error Handling:
 * - Invalid JSON syntax logged and returns empty
 * - Non-array JSON logged and returns empty
 * - Invalid items logged with index and reason
 * - Missing response.decodedData logged and skipped
 * - Processing continues for valid items
 * - Statistics track filtered and skipped counts
 *
 * @module json-processor
 */

import * as fs from "fs";
import * as path from "path";
import { BaseEDIProcessor } from "./base-processor";
import type { EDIFileContent, ProcessorOptions } from "./types";

/**
 * Extended options for JSON processor with filtering and pagination.
 *
 * @interface JsonProcessorOptions
 * @extends {ProcessorOptions}
 * @property {string} [statusFilter] - Filter records by status field value
 * @property {number} [limit] - Maximum number of records to process
 * @property {number} [offset] - Number of valid records to skip before processing
 */
export interface JsonProcessorOptions extends ProcessorOptions {
  readonly statusFilter?: string;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Processor for handling JSON-formatted EDI data inputs.
 *
 * This processor extends BaseEDIProcessor to read and parse EDI data
 * from JSON files. It provides filtering by status and pagination
 * support for efficient handling of large datasets.
 *
 * @class JsonEDIProcessor
 * @extends {BaseEDIProcessor}
 */
export class JsonEDIProcessor extends BaseEDIProcessor {
  /**
   * Processes EDI data from a JSON file with filtering and pagination.
   *
   * This method orchestrates the complete JSON processing workflow:
   * 1. Optionally clean output directory
   * 2. Read and parse JSON file
   * 3. Validate JSON structure
   * 4. Apply status filter (if specified)
   * 5. Apply offset (skip records)
   * 6. Extract EDI content
   * 7. Apply limit (stop after count)
   * 8. Parse and validate each entry
   * 9. Collect statistics
   * 10. Display comprehensive report
   *
   * JSON File Reading:
   * - Synchronous file read (entire file in memory)
   * - UTF-8 encoding assumed
   * - JSON.parse() for deserialization
   * - Validation that result is an array
   *
   * If file doesn't exist or JSON is invalid, returns empty and logs error.
   *
   * Status Filtering:
   * When statusFilter is provided:
   * - Compares item['status'] with filter value
   * - Case-sensitive exact match
   * - Filtered-out items not counted toward limit/offset
   * - Filtered count reported in statistics
   *
   * "Active" filter:
   * - Matches: {"status": "Active", ...}
   * - Skips: {"status": "Inactive", ...}
   * - Skips: {"status": "active", ...} (case matters!)
   * - Skips: {"status": null, ...}
   * - Skips: {} (no status field)
   *
   * Offset Behavior:
   * Offset skips valid records AFTER status filtering:
   * - offset=0: Start from first valid record
   * - offset=100: Skip first 100 valid records
   * - offset > total: No records processed
   *
   * The offset counter only increments for records that:
   * 1. Pass status filter (if specified)
   * 2. Have valid response.decodedData
   *
   * Limit Behavior:
   * Limit stops processing AFTER reaching count:
   * - limit=50: Process exactly 50 valid records
   * - limit=Number.MAX_SAFE_INTEGER: Process all (default)
   * - limit=0: No records processed
   *
   * Processing stops when limit is reached, even if more records remain.
   *
   * Example Scenarios:
   * Scenario 1: Process all Active records
   *   options: { statusFilter: "Active" }
   *   Result: All "Active" items processed
   *
   * Scenario 2: Process records 100-200
   *   options: { offset: 100, limit: 100 }
   *   Result: 100 records starting from 101st
   *
   * Scenario 3: Process first 50 Active records after skipping 100
   *   options: { statusFilter: "Active", offset: 100, limit: 50 }
   *   Result: Active records 101-150
   *
   * Statistics Reporting:
   * The report includes:
   * - Valid items loaded
   * - Items filtered by status (with filter value)
   * - Items skipped by offset
   * - Items limited (with limit value)
   * - Invalid items skipped (with reasons)
   * - Per-item parsing results
   *
   * This helps track how filtering affected the dataset.
   *
   * EDI Content Extraction:
   * For each valid item:
   * 1. Extract response object
   * 2. Extract decodedData from response
   * 3. Validate decodedData is non-empty string
   * 4. Extract rowNumber (or use index + 1)
   * 5. Generate filename from JSON filename + rowNumber
   *
   * Missing or invalid decodedData results in item being skipped.
   *
   * Performance Optimization:
   * For large JSON files (>10,000 records):
   * - Use limit to process in batches
   * - Use offset to resume from checkpoint
   * - Batch processing: offset=0, limit=100, then offset=100, limit=100, etc.
   * - Monitor memory during processing
   *
   * @param {string} jsonFilePath - Path to JSON file containing EDI data
   * @param {JsonProcessorOptions} [options={}] - Processing and filtering options
   * @param {string} [options.statusFilter] - Filter by status field value
   * @param {number} [options.limit] - Maximum valid records to process
   * @param {number} [options.offset] - Valid records to skip before processing
   * @param {boolean} [options.cleanOutput=true] - Whether to clean output directory first
   * @returns {void}
   */
  public process(
    jsonFilePath: string,
    options: JsonProcessorOptions = {},
  ): void {
    const { cleanOutput = true, statusFilter, limit, offset } = options;

    if (cleanOutput) {
      this.cleanExistingOutputFiles();
    }

    const ediFilesCollection = this.getEDIFileContents(
      jsonFilePath,
      statusFilter,
      limit,
      offset,
    );

    if (ediFilesCollection.length === 0) {
      console.log("No valid EDI files found in JSON to process");
      return;
    }

    const filterText =
      statusFilter != null && statusFilter.length > 0
        ? ` (filtered by status: '${statusFilter}')`
        : "";
    const limitText =
      limit != null && limit < Number.MAX_SAFE_INTEGER
        ? ` (limit: ${limit})`
        : "";
    const offsetText =
      offset != null && offset > 0 ? ` (offset: ${offset})` : "";
    console.log(
      `Starting comprehensive parsing analysis from JSON${filterText}${limitText}${offsetText}...\n`,
    );

    const allFileStatistics = ediFilesCollection.map(({ filename, content }) =>
      this.parseEdiFileAndCollectStatistics(filename, content),
    );

    this.displayComprehensiveSummaryStatistics(allFileStatistics);
  }

  protected getEDIFileContents(
    jsonFilePath: string,
    statusFilter?: string,
    limit?: number,
    offset?: number,
  ): ReadonlyArray<EDIFileContent> {
    try {
      if (!fs.existsSync(jsonFilePath)) {
        console.error(`JSON file does not exist: ${jsonFilePath}`);
        return [];
      }

      const jsonContent = fs.readFileSync(jsonFilePath, "utf8");
      let jsonData: unknown;

      try {
        jsonData = JSON.parse(jsonContent);
      } catch (parseError) {
        console.error(`Failed to parse JSON file ${jsonFilePath}:`, parseError);
        return [];
      }

      if (!Array.isArray(jsonData)) {
        console.error("JSON data is not a valid array");
        return [];
      }

      const validEdiFiles: Array<EDIFileContent> = [];
      let filteredOutCount = 0;
      let validRecordsProcessed = 0;
      let recordsAddedCount = 0;

      const startIndex = offset ?? 0;
      const maxRecords = limit ?? Number.MAX_SAFE_INTEGER;

      for (let index = 0; index < jsonData.length; index++) {
        const jsonDataItem: unknown = jsonData[index];

        if (jsonDataItem == null || typeof jsonDataItem !== "object") {
          console.warn(`Skipping data item at index ${index}:`, jsonDataItem);
          continue;
        }

        const jsonRecord = jsonDataItem as Record<string, unknown>;

        if (
          statusFilter != null &&
          statusFilter.length > 0 &&
          jsonRecord["status"] !== statusFilter
        ) {
          filteredOutCount++;
          continue;
        }

        const response = jsonRecord["response"] as
          | Record<string, unknown>
          | undefined;
        if (!response || typeof response !== "object") {
          console.warn(
            `Skipping item at index ${index} - missing or invalid response`,
          );
          continue;
        }

        const decodedData = response["decodedData"];
        if (typeof decodedData !== "string") {
          console.warn(
            `Skipping item at index ${index} - missing or invalid response.decodedData`,
          );
          continue;
        }

        if (decodedData.trim().length === 0) {
          console.warn(
            `Skipping item at index ${index} - empty response.decodedData`,
          );
          continue;
        }

        if (validRecordsProcessed < startIndex) {
          validRecordsProcessed++;
          continue;
        }

        if (recordsAddedCount >= maxRecords) {
          break;
        }

        // Get the input base directory
        const inputBaseDir = path.join(__dirname, "input");

        // Calculate relative path from input directory for the JSON file
        const absoluteJsonPath = path.resolve(jsonFilePath);
        let relativeBasePath: string;

        if (absoluteJsonPath.startsWith(inputBaseDir)) {
          // JSON file is within input directory, get its directory path
          const jsonDir = path.dirname(
            path.relative(inputBaseDir, absoluteJsonPath),
          );
          relativeBasePath = jsonDir;
        } else {
          // JSON file is outside input directory, no parent folder
          relativeBasePath = "";
        }

        const payerName = path.basename(
          jsonFilePath,
          path.extname(jsonFilePath),
        );

        const rowNumber =
          typeof jsonRecord["rowNumber"] === "number"
            ? jsonRecord["rowNumber"]
            : index + 1;
        const sanitizedPayerName = payerName
          .replace(/[^a-zA-Z0-9-_]/g, "-")
          .toLowerCase();
        const baseFilename = `${sanitizedPayerName}-${String(rowNumber)}.edi`;

        // Combine relative path with filename
        const filename =
          relativeBasePath.length > 0
            ? path.join(relativeBasePath, baseFilename)
            : baseFilename;

        validEdiFiles.push({
          filename,
          content: decodedData,
        });

        validRecordsProcessed++;
        recordsAddedCount++;
      }

      console.log(`Loaded ${validEdiFiles.length} EDI files from JSON`);
      if (statusFilter != null && statusFilter.length > 0) {
        console.log(
          `Applied status filter: '${statusFilter}' (filtered out ${filteredOutCount} items)`,
        );
      }
      if (offset != null && offset > 0) {
        console.log(`Applied offset: ${offset} (skipped ${startIndex} items)`);
      }
      if (limit != null && limit < Number.MAX_SAFE_INTEGER) {
        console.log(
          `Applied limit: ${limit} (processed ${recordsAddedCount} items)`,
        );
      }
      if (validEdiFiles.length < validRecordsProcessed) {
        const invalidCount = validRecordsProcessed - validEdiFiles.length;
        console.warn(
          `Skipped ${invalidCount} items due to missing or invalid data`,
        );
      }
      return validEdiFiles;
    } catch (error) {
      console.error("Error reading EDI files from JSON:", error);
      return [];
    }
  }
}
