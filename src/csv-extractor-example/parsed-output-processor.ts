/**
 * Parsed Output Processor - Comprehensive EDI Processing Results Output
 *
 * This processor serves as the final stage in the EDI processing pipeline,
 * generating comprehensive output files that contain complete processing
 * results including validation status, errors, warnings, and metadata.
 *
 * Key Responsibilities:
 * - Generate complete processing results with full audit trail
 * - Include all validation errors and warnings for debugging
 * - Provide comprehensive statistics and success metrics
 * - Create files suitable for technical analysis and troubleshooting
 * - Maintain complete traceability to source CSV data
 *
 * Output Content:
 * - All processed transaction pairs (successful and failed)
 * - Complete validation results (errors, warnings, status)
 * - Source CSV metadata (row numbers, status, payer information)
 * - Processing statistics and success rates
 * - Enhanced metadata for analysis and reporting
 *
 * Use Cases:
 * - Technical debugging and error analysis
 * - Processing audit trails and compliance reporting
 * - Data quality assessment and improvement
 * - Comprehensive transaction history maintenance
 *
 * File Format:
 * - JSON with detailed structure including all processing artifacts
 * - Human-readable formatting for technical review
 * - Complete preservation of processing context
 */
import * as fs from "fs";
import * as path from "path";
import { PairProcessor } from "./base-processor";
import type { ProcessingContext } from "./types";

/**
 * Parsed Output Processor - Final processor in the EDI processing chain
 *
 * This processor operates exclusively during the batch processing phase
 * and creates comprehensive output files containing all processing results.
 * Unlike the RequestOutputProcessor which focuses on clean JSON requests,
 * this processor preserves all processing artifacts for technical analysis.
 *
 * Output Philosophy:
 * - Preserve complete processing history
 * - Include all validation artifacts
 * - Provide comprehensive statistics
 * - Enable detailed technical analysis
 * - Support debugging and troubleshooting
 */
export class ParsedOutputProcessor extends PairProcessor {
  /**
   * Main processing method for comprehensive output generation
   *
   * This method creates detailed output files containing all processing
   * results, validation status, errors, warnings, and metadata. It operates
   * only during batch processing when the complete collection is available.
   *
   * Processing Steps:
   * 1. Validate batch processing context
   * 2. Calculate comprehensive statistics
   * 3. Enhance data with additional metadata
   * 4. Generate detailed output file
   * 5. Provide processing summary and statistics
   *
   * @param context - Processing context with complete transaction pair collection
   */
  protected handle(context: ProcessingContext): void {
    // Only process during batch phase when complete collection is available
    if (context.allPairs == null) {
      return;
    }

    const { allPairs, outputDir } = context;

    // Validate that we have data to process
    if (allPairs == null || allPairs.length === 0) {
      console.log("⚠️  No transaction pairs available for parsed output");
      return;
    }

    // Determine output directory (default to local output folder)
    const finalOutputDir = outputDir ?? path.join(__dirname, "output");

    // Ensure output directory exists
    if (!fs.existsSync(finalOutputDir)) {
      fs.mkdirSync(finalOutputDir, { recursive: true });
    }

    // Calculate comprehensive processing statistics
    // Pairs where both request and response are valid
    const validPairs = allPairs.filter((p) => p.summary.bothValid);
    // Pairs with successfully converted JSON data
    const pairsWithConvertedData = allPairs.filter(
      (p) => p.request?.convertedData != null,
    );

    // Display processing summary statistics
    console.log(
      `\n✅ Processing Results: ${validPairs.length}/${allPairs.length} valid pairs ` +
        `(${((validPairs.length / allPairs.length) * 100).toFixed(1)}% success rate)`,
    );

    if (pairsWithConvertedData.length > 0) {
      console.log(
        `🔄 JSON Conversion: ${pairsWithConvertedData.length}/${allPairs.length} pairs converted`,
      );
    }

    // Generate output filename based on source CSV
    const csvFileName =
      context.csvFilePath != null && context.csvFilePath.length > 0
        ? path.basename(context.csvFilePath, ".csv")
        : "unknown";

    // Create enhanced output with comprehensive metadata
    // This includes all processing artifacts and detailed status information
    const enhancedPairs = allPairs.map((pair) => ({
      ...pair,
      // Ensure status is explicitly included for analysis
      status: pair.status,
      // Payer ID from CSV metadata (4th column)
      payerId: pair.payerId,
      // Payer ID code from CSV metadata (5th column)
      payerIdCode: pair.payerIdCode,
      // Payer name from CSV metadata (6th column)
      payerName: pair.payerName,
      // Enhanced metadata for technical analysis
      metadata: {
        ...pair.summary,
        // Whether status information is available
        hasStatus: pair.status != null,
        // Status value for filtering and analysis
        statusValue: pair.status ?? "unknown",
      },
    }));

    // Generate comprehensive output file
    const parsedOutputPath = path.join(
      finalOutputDir,
      `${csvFileName}-parsed.json`,
    );
    fs.writeFileSync(parsedOutputPath, JSON.stringify(enhancedPairs, null, 2));

    console.log(`📁 Complete Results: ${parsedOutputPath}`);

    // Calculate and display warning statistics
    const totalWarnings = allPairs.reduce(
      (sum, pair) => sum + pair.summary.totalWarnings,
      0,
    );
    if (totalWarnings > 0) {
      console.log(
        `⚠️  Total Warnings: ${totalWarnings} (check output file for details)`,
      );
    }

    // Display final processing completion message
    console.log(
      `✨ Processing completed successfully for ${allPairs.length} transaction pairs`,
    );
  }
}
