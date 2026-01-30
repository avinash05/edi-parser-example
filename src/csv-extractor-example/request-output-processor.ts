/**
 * JSON Request Output Processor - Generates Clean Eligibility Request JSON Files
 *
 * This processor creates structured JSON output files containing converted
 * eligibility requests. It processes the complete collection of transaction
 * pairs and generates a clean, well-formatted JSON file suitable for
 * integration with external systems or further processing.
 *
 * Key Responsibilities:
 * - Filter transactions with successful JSON conversions
 * - Create standardized JSON output format
 * - Include comprehensive metadata and statistics
 * - Generate audit-friendly output with source traceability
 * - Provide conversion success metrics and reporting
 *
 * Output Format:
 * - Metadata section with processing statistics
 * - Array of eligibility requests with consistent structure
 * - Each request includes source CSV context (row number, status, payer info)
 * - Validation and conversion metadata for each request
 *
 * File Naming Convention:
 * - {source-csv-name}-requests.json
 * - Preserves source file identity for audit trails
 * - Consistent naming across different processing runs
 *
 * Integration Points:
 * - Output format compatible with eligibility verification APIs
 * - JSON structure follows common healthcare integration patterns
 * - Includes all necessary metadata for downstream processing
 */
import * as fs from "fs";
import * as path from "path";
import { PairProcessor } from "./base-processor";
import type { ProcessingContext } from "./types";

/**
 * Type definition for eligibility request data structure
 * Matches the output format from EdiToRequestProcessor
 */
interface EligibilityRequestData {
  // Payer information extracted from EDI
  Payer?: {
    Name: string;
    Code: string;
    PatientAndSubscriberReqdForElig: boolean;
    PatientReqdForElig: boolean;
  };
  // Provider information extracted from EDI
  Provider?: {
    CompanyName: string;
    FirstName: string;
    LastName: string;
    TIN: string;
    NPI: string;
    entityType: number;
  };
  // Subscriber identification
  SubscriberID?: string;
  // Patient date of birth in ISO format
  PatientDOB?: string;
  // Relationship code (typically "SELF")
  Relationship?: string;
  // Output format indicator
  outputFormat?: string;
}

/**
 * Request Output Processor - Fifth processor in the EDI processing chain
 *
 * This processor operates during the batch processing phase and creates
 * JSON output files containing successfully converted eligibility requests.
 * It only processes transactions that have been successfully converted to
 * JSON format by the EdiToRequestProcessor.
 *
 * Output Structure:
 * - File-level metadata with processing statistics
 * - Array of eligibility requests with source context
 * - Each request includes conversion and validation status
 * - Comprehensive audit trail information
 */
export class RequestOutputProcessor extends PairProcessor {
  /**
   * Main processing method for JSON request output generation
   *
   * This method only operates during batch processing when all transaction
   * pairs have been collected and processed. It filters for successfully
   * converted requests and generates a clean JSON output file.
   *
   * Processing Logic:
   * 1. Validate batch processing context (allPairs must be present)
   * 2. Filter for successfully converted requests
   * 3. Create structured output with metadata
   * 4. Generate audit-friendly filename
   * 5. Write formatted JSON to file
   * 6. Provide processing summary
   *
   * @param context - Processing context containing complete collection of pairs
   */
  protected handle(context: ProcessingContext): void {
    // Only process during batch phase when complete collection is available
    if (context.allPairs == null) {
      return;
    }

    const { allPairs, outputDir, csvFilePath } = context;

    // Validate that we have data to process
    if (allPairs == null || allPairs.length === 0) {
      console.log("⚠️  No transaction pairs available for JSON request output");
      return;
    }

    // Determine output directory (default to local output folder)
    const finalOutputDir = outputDir ?? path.join(__dirname, "output");

    // Ensure output directory exists
    if (!fs.existsSync(finalOutputDir)) {
      fs.mkdirSync(finalOutputDir, { recursive: true });
    }

    // Filter and transform pairs with successful JSON conversions
    // Only include requests that were successfully converted to JSON format
    const eligibilityRequests = allPairs
      .filter((pair) => pair.request?.convertedData != null)
      .map((pair, index) => ({
        // Unique identifier for this request within the batch
        requestId: index + 1,
        // Source CSV row number for audit trail
        rowNumber: pair.rowNumber,
        // Status from CSV metadata (3rd column)
        status: pair.status,
        // Payer ID from CSV metadata (4th column)
        payerId: pair.payerId,
        // Payer ID code from CSV metadata (5th column)
        payerIdCode: pair.payerIdCode,
        // Payer name from CSV metadata (6th column)
        payerName: pair.payerName,
        // Converted eligibility request data
        eligibilityRequest: pair.request?.convertedData as
          | EligibilityRequestData
          | undefined,
        // Processing and validation metadata
        metadata: {
          // Whether a corresponding response (271) was present
          hasResponse: pair.response != null,
          // Whether the request passed validation
          isValid: pair.request?.isValid ?? false,
          // Number of validation errors encountered
          errorCount: pair.request?.errors?.length ?? 0,
          // Number of validation warnings encountered
          warningCount: pair.request?.warnings?.length ?? 0,
        },
      }));

    // Generate output filename based on source CSV file
    const csvFileName =
      csvFilePath != null && csvFilePath.length > 0
        ? path.basename(csvFilePath, ".csv")
        : "unknown";
    const jsonOutputPath = path.join(
      finalOutputDir,
      `${csvFileName}-requests.json`,
    );

    // Create comprehensive JSON output with metadata and requests
    const jsonOutput = {
      // File-level metadata for audit and processing tracking
      metadata: {
        // Timestamp when this file was generated
        generatedAt: new Date().toISOString(),
        // Source CSV filename for traceability
        sourceFile: csvFileName,
        // Total number of requests in this file
        totalRequests: eligibilityRequests.length,
        // Number of valid requests (passed validation)
        validRequests: eligibilityRequests.filter((req) => req.metadata.isValid)
          .length,
        // Processing summary statistics
        summary: {
          // Total number of transaction pairs processed
          totalPairs: allPairs.length,
          // Number of successful JSON conversions
          successfulConversions: eligibilityRequests.length,
          // Conversion success rate as percentage
          conversionRate: `${((eligibilityRequests.length / allPairs.length) * 100).toFixed(1)}%`,
        },
      },
      // Array of converted eligibility requests
      eligibilityRequests,
    };

    // Write formatted JSON to file with proper indentation
    fs.writeFileSync(jsonOutputPath, JSON.stringify(jsonOutput, null, 2));

    // Provide processing summary with key metrics
    console.log(
      `📄 JSON Requests: ${jsonOutputPath} ` +
        `(${eligibilityRequests.length} requests, ${jsonOutput.metadata.summary.conversionRate} success rate)`,
    );
  }
}
