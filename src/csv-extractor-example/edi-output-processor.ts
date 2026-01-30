/**
 * EDI Output Processor - Individual EDI File Generation
 *
 * This processor creates individual EDI files from successfully processed
 * transactions. It generates separate files for 270 (eligibility requests)
 * and 271 (eligibility responses) transactions, organized in type-specific
 * directories for easy management.
 *
 * Key Responsibilities:
 * - Generate individual EDI files for valid transactions
 * - Organize output by transaction type (270/271)
 * - Apply consistent file naming conventions
 * - Format EDI content with proper structure
 * - Provide comprehensive processing statistics
 *
 * File Organization:
 * - 270/ directory for eligibility request files
 * - 271/ directory for eligibility response files
 * - Systematic naming: {source}-{type}-{sequence}.edi
 *
 * Use Cases:
 * - Integration with systems expecting individual EDI files
 * - Trading partner submissions requiring file-based exchange
 * - Archival and backup of processed EDI transactions
 * - Testing and validation with external EDI processors
 *
 * Quality Assurance:
 * - Only valid transactions are written to files
 * - Proper EDI formatting with segment terminators
 * - Error handling for file system operations
 * - Detailed logging and statistics reporting
 *
 * Note: This processor is currently commented out in the chain builder
 * but can be enabled when individual EDI file output is required.
 */
import * as fs from "fs";
import * as path from "path";
import { PairProcessor } from "./base-processor";
import type { ProcessingContext, ProcessedEDITransaction } from "./types";

/**
 * EDI Output Processor - Optional processor for individual file generation
 *
 * This processor operates during batch processing and creates individual
 * EDI files for each valid transaction. It provides an alternative output
 * format for systems that require traditional EDI file-based integration.
 *
 * File Structure:
 * - Organized by transaction type in subdirectories
 * - Sequential numbering within each type
 * - Proper EDI formatting with segment terminators
 * - UTF-8 encoding for compatibility
 *
 * Processing Logic:
 * - Filter for valid transactions only
 * - Create type-specific output directories
 * - Generate sequential filenames
 * - Format EDI content properly
 * - Handle file system errors gracefully
 */
export class EDIOutputProcessor extends PairProcessor {
  /**
   * Main processing method for EDI file generation
   *
   * This method processes the complete collection of transaction pairs
   * and generates individual EDI files for each valid transaction.
   * Files are organized by type and numbered sequentially.
   *
   * Processing Flow:
   * 1. Validate batch processing context
   * 2. Initialize type-specific counters
   * 3. Process each transaction pair
   * 4. Generate individual EDI files for valid transactions
   * 5. Provide comprehensive processing statistics
   *
   * @param context - Processing context with complete pair collection
   */
  protected handle(context: ProcessingContext): void {
    // Only process during batch phase when complete collection is available
    if (context.allPairs == null) {
      return;
    }

    const { allPairs, outputDir, csvFilePath } = context;

    // Validate that we have data to process
    if (allPairs == null || allPairs.length === 0) {
      console.log("⚠️  No transaction pairs available for EDI file output");
      return;
    }

    // Determine base output directory
    const finalOutputDir = outputDir ?? path.join(__dirname, "output");

    // Ensure base output directory exists
    if (!fs.existsSync(finalOutputDir)) {
      fs.mkdirSync(finalOutputDir, { recursive: true });
    }

    // Generate base filename from source CSV
    const csvFileName =
      csvFilePath != null && csvFilePath.length > 0
        ? path.basename(csvFilePath, ".csv")
        : "unknown";

    // Initialize counters for each transaction type
    // Counter for 270 eligibility request files
    let count270 = 0;
    // Counter for 271 eligibility response files
    let count271 = 0;

    // Process each transaction pair and generate individual files
    for (const pair of allPairs) {
      // Process eligibility request (270) if valid and present
      if (pair.request?.isValid === true && pair.request.type === "270") {
        count270++;

        // Create type-specific directory for 270 requests
        const typeDir = path.join(finalOutputDir, "270");
        if (!fs.existsSync(typeDir)) {
          fs.mkdirSync(typeDir, { recursive: true });
        }

        // Generate systematic filename with type and sequence
        const filename = `${csvFileName}-270-${count270}.edi`;
        const filepath = path.join(typeDir, filename);

        try {
          // Write formatted EDI content to file
          fs.writeFileSync(
            filepath,
            this.formatEDIContent(pair.request),
            "utf8",
          );
          console.log(`📄 270 Request: ${filename}`);
        } catch (error) {
          console.error(`❌ Error writing 270 file ${filename}:`, error);
        }
      }

      // Process eligibility response (271) if valid and present
      if (pair.response?.isValid === true && pair.response.type === "271") {
        count271++;

        // Create type-specific directory for 271 responses
        const typeDir = path.join(finalOutputDir, "271");
        if (!fs.existsSync(typeDir)) {
          fs.mkdirSync(typeDir, { recursive: true });
        }

        // Generate systematic filename with type and sequence
        const filename = `${csvFileName}-271-${count271}.edi`;
        const filepath = path.join(typeDir, filename);

        try {
          // Write formatted EDI content to file
          fs.writeFileSync(
            filepath,
            this.formatEDIContent(pair.response),
            "utf8",
          );
          console.log(`📄 271 Response: ${filename}`);
        } catch (error) {
          console.error(`❌ Error writing 271 file ${filename}:`, error);
        }
      }
    }

    // Provide comprehensive processing summary
    const totalFiles = count270 + count271;
    console.log(
      `\n🗂️ EDI Files Generated: ${totalFiles} total ` +
        `(${count270} × 270 requests, ${count271} × 271 responses)`,
    );

    if (totalFiles > 0) {
      console.log(`📁 EDI Output Directory: ${finalOutputDir}`);
    } else {
      console.log(`⚠️  No valid transactions found for EDI file generation`);
    }
  }

  /**
   * Formats EDI content with proper structure and line endings
   *
   * This method ensures that EDI content is properly formatted for
   * file output with correct segment terminators and line breaks.
   * It handles both parsed segments and raw EDI data.
   *
   * Formatting Rules:
   * - Each segment on a separate line
   * - Segment terminator (~) at end of each line
   * - Proper line endings for cross-platform compatibility
   * - UTF-8 encoding preservation
   */
  private formatEDIContent(transaction: ProcessedEDITransaction): string {
    let content = "";

    if (transaction.segments && transaction.segments.length > 0) {
      // Use parsed segments for optimal formatting
      // Each segment gets its own line with proper terminator
      content = transaction.segments.join("\n") + "\n";
    } else {
      // Fall back to raw or decoded data if segments not available
      const rawContent = transaction.decodedData || transaction.rawData;

      if (rawContent.includes("~")) {
        // Process EDI with segment terminators
        const segments = rawContent
          .split("~")
          .filter((segment) => segment.trim().length > 0);

        // Format each segment with terminator and line break
        content =
          segments.map((segment) => segment.trim() + "~").join("\n") + "\n";
      } else {
        // Handle edge case where no segment terminators found
        // Write as-is with proper line ending
        content = rawContent.trim() + "\n";
      }
    }

    return content;
  }
}
