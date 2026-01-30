/**
 * Single EDI File Processor
 *
 * This module provides functionality for processing individual EDI files from the
 * filesystem. It's the simplest processor type, designed for scenarios where you
 * need to analyze a single EDI transaction file in detail.
 *
 * Key Features:
 * - Direct file path input (absolute or relative)
 * - Comprehensive validation and error reporting
 * - Detailed statistics for single-file analysis
 * - JSON output with full transaction structure
 *
 * Use Cases:
 * - Debugging specific EDI transactions
 * - Testing parser behavior with known files
 * - Analyzing problem files in detail
 * - Processing real-time eligibility responses
 * - Quality assurance verification
 *
 * Workflow:
 * 1. Validate file exists and is accessible
 * 2. Read raw EDI content from filesystem
 * 3. Parse and validate the transaction
 * 4. Generate comprehensive statistics
 * 5. Save structured output to JSON
 * 6. Display detailed report
 *
 * Error Handling:
 * - Validates file existence before processing
 * - Checks that path points to a file (not directory)
 * - Catches and logs all errors gracefully
 * - Does not throw exceptions up the stack
 *
 * Performance:
 * - Typical: 10-50ms for files under 100KB
 * - Memory: O(n) where n is file size
 * - No caching between runs
 *
 * @module edi-processor
 */

import * as fs from "fs";
import * as path from "path";
import { BaseEDIProcessor } from "./base-processor";
import type { EDIFileContent, ProcessorOptions } from "./types";

/**
 * Processor for handling single EDI file inputs.
 *
 * This processor extends BaseEDIProcessor to provide file-specific
 * loading logic while inheriting the common parsing and statistics
 * generation functionality.
 *
 * @class EDIProcessor
 * @extends {BaseEDIProcessor}
 */
export class EDIProcessor extends BaseEDIProcessor {
  /**
   * Processes a single EDI file with comprehensive analysis and validation.
   *
   * This method orchestrates the complete workflow for single-file processing:
   * 1. Optionally clean output directory
   * 2. Validate file exists and is accessible
   * 3. Read file content from filesystem
   * 4. Parse and validate EDI transaction
   * 5. Collect comprehensive statistics
   * 6. Save results to JSON output
   * 7. Display formatted statistics report
   *
   * File Validation:
   * The method performs several validation checks:
   * - File existence: Verifies the path exists on filesystem
   * - File type: Ensures path points to a file, not a directory
   * - Readability: File must be accessible and readable
   *
   * If any validation fails, an error is logged and processing terminates.
   *
   * Cleanup Behavior:
   * When cleanOutput=true (default):
   * - Removes all existing output files before processing
   * - Ensures no stale output from previous runs
   * - Particularly useful for iterative testing
   *
   * When cleanOutput=false:
   * - Preserves existing output files
   * - Useful for incremental processing
   * - May result in duplicate filenames being overwritten
   *
   * File Reading:
   * - Uses synchronous file reading (blocking)
   * - UTF-8 encoding assumed
   * - Entire file loaded into memory
   * - No streaming for single files
   *
   * Output Generation:
   * - Output filename matches input filename with .json extension
   * - Preserves any directory structure from input path
   * - Includes full transaction structure and statistics
   * - Pretty-printed JSON with 2-space indentation
   *
   * Statistics Report:
   * Displays comprehensive report including:
   * - Parse time and validation time
   * - File size and segment count
   * - Validation status and error counts
   * - Missing elements and transformation issues
   * - Integrity metrics (coverage, accuracy)
   *
   * Error Handling:
   * All errors are caught and logged:
   * - File not found: Logs error and returns
   * - Permission denied: Logs error and returns
   * - Parse errors: Included in statistics
   * - IO errors: Logged to console
   *
   * No exceptions are propagated to caller.
   *
   * @param {string} filePath - Absolute or relative path to the EDI file
   * @param {ProcessorOptions} [options={}] - Processing configuration
   * @param {boolean} [options.cleanOutput=true] - Whether to clean output directory first
   * @returns {void}
   */
  public process(filePath: string, options: ProcessorOptions = {}): void {
    const { cleanOutput = true } = options;

    if (cleanOutput) {
      this.cleanExistingOutputFiles();
    }

    try {
      if (!fs.existsSync(filePath)) {
        console.error(`File does not exist: ${filePath}`);
        return;
      }

      const fileStats = fs.statSync(filePath);
      if (!fileStats.isFile()) {
        console.error(`Path is not a file: ${filePath}`);
        return;
      }

      // Get the input base directory
      const inputBaseDir = path.join(__dirname, "input");

      // Calculate relative path from input directory
      const absoluteFilePath = path.resolve(filePath);
      let relativeFileName: string;

      if (absoluteFilePath.startsWith(inputBaseDir)) {
        // File is within input directory, preserve folder structure
        relativeFileName = path.relative(inputBaseDir, absoluteFilePath);
      } else {
        // File is outside input directory, use just the basename
        relativeFileName = path.basename(filePath);
      }

      const ediContent = fs.readFileSync(filePath, "utf8");

      console.log(
        `Starting comprehensive parsing analysis for: ${relativeFileName}\n`,
      );

      const fileStatistics = this.parseEdiFileAndCollectStatistics(
        relativeFileName,
        ediContent,
      );

      this.displayComprehensiveSummaryStatistics([fileStatistics]);
    } catch (error) {
      console.error("Parser error:", error);
    }
  }

  protected getEDIFileContents(
    filePath: string,
  ): ReadonlyArray<EDIFileContent> {
    try {
      if (!fs.existsSync(filePath)) {
        return [];
      }

      // Get the input base directory
      const inputBaseDir = path.join(__dirname, "input");

      // Calculate relative path from input directory
      const absoluteFilePath = path.resolve(filePath);
      let relativeFileName: string;

      if (absoluteFilePath.startsWith(inputBaseDir)) {
        // File is within input directory, preserve folder structure
        relativeFileName = path.relative(inputBaseDir, absoluteFilePath);
      } else {
        // File is outside input directory, use just the basename
        relativeFileName = path.basename(filePath);
      }

      const content = fs.readFileSync(filePath, "utf8");

      return [{ filename: relativeFileName, content }];
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return [];
    }
  }
}
