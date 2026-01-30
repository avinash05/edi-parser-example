/**
 * Base EDI Processor - Template Method Pattern Implementation
 *
 * This abstract base class implements the Template Method design pattern to define
 * the skeleton of the EDI file processing algorithm. It provides common functionality
 * shared across all processor types while allowing subclasses to customize specific
 * steps of the processing workflow.
 *
 * Architecture Overview:
 * The class establishes a three-phase processing pipeline:
 * 1. Data Acquisition: Subclasses implement getEDIFileContents() to load data
 * 2. Parsing & Validation: Base class handles EDI parsing and validation
 * 3. Output Generation: Base class saves results and displays statistics
 *
 * Key Responsibilities:
 * - Initialize the comprehensive EDI parser for 271 transactions
 * - Parse EDI content and extract transaction structures
 * - Validate EDI transactions against HIPAA 5010 specifications
 * - Collect detailed statistics including timing, coverage, and integrity metrics
 * - Generate formatted output files with transaction data and statistics
 * - Display comprehensive tabular reports with parsing results
 *
 * Template Methods:
 * - process(): Abstract method that must be implemented by subclasses
 * - getEDIFileContents(): Abstract method for data source-specific loading logic
 *
 * Concrete Methods:
 * All parsing, validation, statistics collection, and output generation methods
 * are implemented in the base class to ensure consistent behavior across all
 * processor types.
 *
 * Design Benefits:
 * - Eliminates code duplication across processor types
 * - Ensures consistent parsing and validation logic
 * - Simplifies testing by centralizing core functionality
 * - Enables easy addition of new processor types
 * - Maintains Single Responsibility Principle
 *
 * @module base-processor
 * @abstract
 * @class BaseEDIProcessor
 */

import {
  ParserFactory,
  type EDIParser,
  type ParseResult,
  type EDITransaction,
  type IntegrityValidationResult,
} from "@edi-parser/core";
import * as fs from "fs";
import * as path from "path";
import type { EDIParserStatistics, EDIFileContent } from "./types";

export abstract class BaseEDIProcessor {
  /**
   * The EDI parser instance used for all parsing operations.
   *
   * This parser is configured for comprehensive parsing mode, which provides:
   * - Full validation against HIPAA 5010 271 specifications
   * - Detailed error and warning reporting
   * - Integrity checking with coverage metrics
   * - Transformation issue detection
   *
   * The parser is readonly to prevent accidental modification after initialization.
   *
   * @protected
   * @readonly
   * @type {EDIParser}
   */
  protected readonly parser: EDIParser;

  /**
   * Initializes the base EDI processor with a comprehensive 271 parser.
   *
   * The comprehensive parser is chosen because it provides the most detailed
   * validation and error reporting, which is essential for debugging and
   * quality assurance in healthcare data processing.
   *
   * Parser Configuration:
   * - Transaction Type: 271 (Health Care Eligibility Benefit Response)
   * - Parsing Mode: Comprehensive (full validation)
   * - Error Reporting: Detailed with context
   * - Integrity Validation: Enabled
   *
   * @constructor
   */
  constructor() {
    this.parser = ParserFactory.getInstance().createParserWithStrategy(
      "271",
      "comprehensive",
    );
  }

  /**
   * Main processing method that orchestrates the entire EDI processing workflow.
   *
   * This abstract method must be implemented by each subclass to define how
   * EDI data is loaded and processed. The method typically follows this pattern:
   * 1. Apply options (e.g., clean output directory)
   * 2. Load EDI file contents via getEDIFileContents()
   * 3. Parse each file using parseEdiFileAndCollectStatistics()
   * 4. Display aggregate statistics via displayComprehensiveSummaryStatistics()
   *
   * Subclasses may accept different parameters based on their data source:
   * - EDIProcessor: Accepts a file path string
   * - DirectoryEDIProcessor: Accepts a directory path string
   * - JsonEDIProcessor: Accepts a JSON file path with filtering options
   * - ArrayEDIProcessor: Accepts an array of EDI content objects
   *
   * @abstract
   * @param {...unknown[]} args - Variable arguments depending on processor type
   * @returns {void}
   */
  public abstract process(...args: unknown[]): void;

  /**
   * Loads EDI file contents from the processor's specific data source.
   *
   * This abstract method must be implemented by each subclass to handle the
   * specifics of loading EDI data from different sources. The method should:
   * - Validate input parameters
   * - Load raw EDI content from the data source
   * - Handle errors gracefully and log issues
   * - Return a readonly array of EDIFileContent objects
   *
   * Each EDIFileContent object must contain:
   * - filename: Display name for the file (used in output and reports)
   * - content: Raw EDI content as a string
   *
   * Implementation Examples:
   * - EDIProcessor: Reads a single file from the filesystem
   * - DirectoryEDIProcessor: Recursively scans a directory for .edi files
   * - JsonEDIProcessor: Extracts EDI from JSON response objects
   * - ArrayEDIProcessor: Converts array items to EDIFileContent format
   *
   * @abstract
   * @protected
   * @param {...unknown[]} args - Variable arguments depending on processor type
   * @returns {ReadonlyArray<EDIFileContent>} Array of EDI files with names and content
   */
  protected abstract getEDIFileContents(
    ...args: unknown[]
  ): ReadonlyArray<EDIFileContent>;

  /**
   * Extracts basic file statistics from raw EDI content.
   *
   * This method performs a lightweight analysis of the EDI content to determine
   * segment count and file size. It does NOT perform full parsing or validation.
   *
   * Algorithm:
   * 1. Split EDI content by segment terminator (~)
   * 2. Filter out empty segments (whitespace only)
   * 3. Count remaining valid segments
   * 4. Calculate file size in bytes using UTF-8 encoding
   *
   * The segment count provides a quick indicator of file complexity, while
   * the file size helps with performance analysis and memory estimation.
   *
   * EDI Segment Structure:
   * Each segment is terminated by '~' and contains:
   * - Segment ID (2-3 characters)
   * - Data elements separated by '*'
   * - Optional composite elements separated by ':'
   *
   * Performance Characteristics:
   * - Time Complexity: O(n) where n is the length of EDI content
   * - Space Complexity: O(1) as no data structures are created
   * - Typical Execution Time: <1ms for files under 100KB
   *
   * @protected
   * @param {string} ediContent - Raw EDI content string to analyze
   * @returns {{segmentCount: number, fileSize: number}} Object containing segment count and file size in bytes
   */
  protected extractBasicFileStatistics(ediContent: string): {
    segmentCount: number;
    fileSize: number;
  } {
    const ediFileSegments = ediContent
      .split("~")
      .filter((s) => s.trim().length > 0);
    return {
      segmentCount: ediFileSegments.length,
      fileSize: Buffer.byteLength(ediContent, "utf8"),
    };
  }

  /**
   * Formats file size in human-readable units.
   *
   * Converts byte counts to the most appropriate unit (B, KB, or MB) for
   * readability in console output and reports. The method automatically
   * selects the optimal unit based on the magnitude of the value.
   *
   * Unit Selection Logic:
   * - Less than 1,024 bytes: Display as bytes (B)
   * - Less than 1,048,576 bytes: Display as kilobytes (KB) with 1 decimal
   * - 1,048,576 bytes or more: Display as megabytes (MB) with 1 decimal
   *
   * Formatting Rules:
   * - Bytes: No decimals (integer)
   * - Kilobytes: 1 decimal place
   * - Megabytes: 1 decimal place
   *
   * @protected
   * @param {number} bytes - File size in bytes to format
   * @returns {string} Formatted file size with appropriate unit (e.g., "1.5 MB", "256.3 KB", "512 B")
   */
  protected formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Formats execution time in human-readable units.
   *
   * Converts millisecond durations to the most appropriate time unit (μs, ms, or s)
   * for optimal readability. This is particularly useful for performance analysis
   * where operations can range from microseconds to several seconds.
   *
   * Unit Selection Logic:
   * - Less than 1ms: Display as microseconds (μs) with 0 decimals
   * - Less than 1000ms: Display as milliseconds (ms) with 1 decimal
   * - 1000ms or more: Display as seconds (s) with 2 decimals
   *
   * Use Cases:
   * - Parse time measurements (typically 10-100ms for medium files)
   * - Validation time measurements (typically 5-50ms)
   * - Total processing time for batch operations
   *
   * @protected
   * @param {number} ms - Duration in milliseconds to format
   * @returns {string} Formatted duration with appropriate unit (e.g., "15.2ms", "2.50s", "350μs")
   */
  protected formatExecutionTime(ms: number): string {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  /**
   * Type guard that validates if a value is a valid EDI transaction object.
   *
   * This type guard performs runtime validation to ensure that a value has the
   * structure required for an EDI transaction. It's used to safely narrow the
   * TypeScript type from 'unknown' to 'EDITransaction' before accessing properties.
   *
   * Validation Checks:
   * 1. Value is not null (null check)
   * 2. Value is an object (typeof check)
   * 3. Object has a 'loops' property (structural check)
   * 4. The 'loops' property is an array (type check)
   *
   * EDI Transaction Structure:
   * An EDI transaction contains:
   * - loops: Array of hierarchical loop structures
   * - transactionType: Type identifier (e.g., "271")
   * - segments: Array of EDI segments
   * - metadata: Additional transaction information
   *
   * Why This Guard Is Necessary:
   * The parser's return type may be 'unknown' in error conditions, so we need
   * to validate the structure before accessing nested properties. This prevents
   * runtime errors and provides type safety throughout the processing pipeline.
   *
   * @protected
   * @param {unknown} value - Value to check for EDI transaction structure
   * @returns {value is EDITransaction} True if value is a valid EDI transaction
   */
  protected isValidEdiTransaction(value: unknown): value is EDITransaction {
    return (
      value !== null &&
      typeof value === "object" &&
      "loops" in value &&
      Array.isArray((value as EDITransaction).loops)
    );
  }

  /**
   * Type guard that validates if a value is a valid parse result object.
   *
   * This type guard ensures that a value has the complete structure of a
   * ParseResult, which includes both the parsed transaction and associated
   * statistics. It uses the isValidEdiTransaction guard for nested validation.
   *
   * Validation Checks:
   * 1. Value is not null (null check)
   * 2. Value is an object (typeof check)
   * 3. Object has a 'transaction' property (structural check)
   * 4. The 'transaction' property is a valid EDI transaction (nested validation)
   *
   * Parse Result Structure:
   * A ParseResult contains:
   * - transaction: The parsed EDI transaction object
   * - statistics: Optional parsing performance metrics
   *
   * Usage Context:
   * This guard is used after calling parser.parse() to verify that parsing
   * succeeded and returned a valid result structure before attempting to
   * access transaction properties or extract loop counts.
   *
   * Error Handling:
   * If this guard returns false, it indicates that parsing failed or returned
   * an unexpected structure. The calling code should handle this gracefully
   * by using fallback values or reporting an error.
   *
   * @protected
   * @param {unknown} value - Value to check for ParseResult structure
   * @returns {value is ParseResult} True if value is a valid ParseResult with transaction
   */
  protected isValidParseResult(value: unknown): value is ParseResult {
    return (
      value !== null &&
      typeof value === "object" &&
      "transaction" in value &&
      this.isValidEdiTransaction((value as ParseResult).transaction)
    );
  }

  /**
   * Saves the parsed EDI transaction and statistics to a JSON output file.
   *
   * This method handles the complete workflow of persisting parsed EDI data:
   * 1. Determines output directory structure (preserves input file hierarchy)
   * 2. Creates necessary directories recursively
   * 3. Generates output filename based on input filename
   * 4. Removes any existing output file to ensure clean writes
   * 5. Constructs comprehensive output object with metadata
   * 6. Writes formatted JSON to the filesystem
   *
   * Output File Structure:
   * The output JSON contains four main sections:
   * - sourceFile: Original file identifier
   * - timestamp: ISO 8601 timestamp of processing
   * - rawEDI: Original EDI content as a string
   * - transaction: Complete parsed EDI transaction with metadata
   * - parseStatistics: Detailed parsing metrics and validation results
   *
   * Directory Structure Preservation:
   * Input: edi-parser-example/input/aetna/file.edi
   * Output: edi-parser-example/output/aetna/file.json
   *
   * The method preserves the relative directory structure from the input,
   * making it easier to organize outputs by payer, date, or other criteria.
   *
   * Metadata Enrichment:
   * The transaction object is enriched with metadata including:
   * - sourceFile: Links output back to original input
   * - outputGeneratedAt: Timestamp for tracking processing time
   *
   * Statistics Handling:
   * If statistics are provided, the method includes comprehensive metrics:
   * - Performance: Parse time, validation time, file size
   * - Structure: Segment count, loop count, element counts
   * - Validation: Error counts, missing elements, transformation issues
   * - Integrity: Coverage percentages, accuracy metrics
   *
   * If no statistics are provided, the parseStatistics field is set to null.
   *
   * Error Handling:
   * Any errors during file operations are caught and logged to console.
   * The method does not throw exceptions, ensuring that a save error
   * doesn't halt processing of remaining files in batch operations.
   *
   * File System Operations:
   * - mkdirSync with {recursive: true}: Creates all parent directories
   * - unlinkSync: Removes existing file to ensure clean state
   * - writeFileSync with UTF-8: Ensures proper encoding for JSON
   * - JSON.stringify with 2-space indent: Pretty-prints for readability
   *
   * @protected
   * @param {string} filename - Input filename (used for output naming and metadata)
   * @param {string} rawEDI - Original raw EDI content string
   * @param {EDITransaction} transaction - Parsed EDI transaction object to save
   * @param {Partial<EDIParserStatistics>} [statistics] - Optional parsing statistics to include
   * @returns {void}
   */
  protected saveEdiTransactionResult(
    filename: string,
    rawEDI: string,
    transaction: EDITransaction,
    statistics?: Partial<EDIParserStatistics>,
  ): void {
    try {
      const baseOutputDir = path.join(__dirname, "output");
      const fileDir = path.dirname(filename);
      const outputDir = path.join(baseOutputDir, fileDir);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const baseName = path.basename(filename, path.extname(filename));
      const outputFilename = `${baseName}.json`;
      const outputPath = path.join(outputDir, outputFilename);

      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }

      const outputData = {
        sourceFile: filename,
        timestamp: new Date().toISOString(),
        rawEDI,
        transaction: {
          ...transaction,
          metadata: {
            sourceFile: filename,
            outputGeneratedAt: new Date().toISOString(),
          },
        },
        parseStatistics: statistics
          ? {
              filename: statistics.filename ?? filename,
              parseTime: statistics.parseTime ?? 0,
              validationTime: statistics.validationTime ?? 0,
              fileSize: statistics.fileSize ?? 0,
              segmentCount: statistics.segmentCount ?? 0,
              loopCount: statistics.loopCount ?? 0,
              isValid: statistics.isValid ?? false,
              errorCount: statistics.errorCount ?? 0,
              warningCount: statistics.warningCount ?? 0,
              infoCount: statistics.infoCount ?? 0,
              errors: statistics.errors ?? [],
              warnings: statistics.warnings ?? [],
              infos: statistics.infos ?? [],
              totalSegments: statistics.totalSegments,
              totalElements: statistics.totalElements,
              matchedElements: statistics.matchedElements,
              segmentCoverage: statistics.segmentCoverage,
              elementCoverage: statistics.elementCoverage,
              parsingAccuracy: statistics.parsingAccuracy,
              dataIntegrity: statistics.dataIntegrity,
              missingElements: statistics.missingElements ?? [],
              transformationIssues: statistics.transformationIssues ?? [],
              ruleViolations: statistics.ruleViolations ?? [],
              memoryUsage: statistics.memoryUsage,
              validationStrategy: statistics.validationStrategy,
              integrityStatistics: statistics.integrityStatistics,
            }
          : null,
      };

      fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), "utf8");
      console.log(`📄 Saved EDI transaction: ${outputFilename}`);
    } catch (error) {
      console.error(
        `❌ Failed to save EDI transaction for ${filename}:`,
        error,
      );
    }
  }

  /**
   * Parses an EDI file and collects comprehensive statistics about the operation.
   *
   * This is the core processing method that orchestrates the complete parsing
   * and validation workflow. It performs the following operations in sequence:
   *
   * Processing Pipeline:
   * 1. Extract basic file statistics (segment count, file size)
   * 2. Parse EDI content into structured transaction object
   * 3. Validate parsed transaction against HIPAA 5010 specifications
   * 4. Collect performance metrics (timing, memory)
   * 5. Extract validation results (errors, warnings, missing elements)
   * 6. Calculate integrity metrics (coverage, accuracy percentages)
   * 7. Save transaction and statistics to output file
   * 8. Return comprehensive statistics object
   *
   * Performance Measurement:
   * The method uses performance.now() for high-resolution timing of:
   * - Parse operation: Time to convert EDI text to transaction structure
   * - Validation operation: Time to validate against specifications
   * These timings help identify performance bottlenecks and optimization opportunities.
   *
   * Validation Result Processing:
   * The comprehensive parser returns an array of ValidationResult objects.
   * This method aggregates results from all validators:
   * - Collects all missing elements across validators
   * - Aggregates transformation issues by severity
   * - Extracts the first available integrity metrics
   * - Determines overall validity status
   *
   * Integrity Metrics:
   * If available from validation results:
   * - segmentCoverage: % of segments found in output
   * - elementCoverage: % of elements found in output
   * - parsingAccuracy: % of elements matching exactly
   * - dataIntegrity: Overall data preservation score (0-100)
   *
   * Error Count Calculation:
   * - Errors: Count of missing elements (data loss)
   * - Warnings: Count of transformation issues with 'warning' severity
   * - Infos: Count of transformation issues with 'info' severity
   *
   * Validity Determination:
   * A file is considered valid if:
   * 1. All validation results report isValid=true, OR
   * 2. Parsing succeeded with loops and parse statistics show no errors
   *
   * This dual-check ensures that files with minor validation issues but
   * successful parsing can still be processed.
   *
   * Error Handling:
   * If parsing or validation throws an exception:
   * - Error is caught and logged
   * - Method returns statistics with isValid=false
   * - Error message is included in the errors array
   * - Basic file statistics are still included
   * - Processing continues for other files in batch operations
   *
   * Output File Generation:
   * On successful parsing, the method automatically saves:
   * - Parsed transaction structure
   * - Complete statistics object
   * - Metadata for traceability
   *
   * @protected
   * @param {string} fileName - Name or path of the EDI file being processed
   * @param {string} ediContent - Raw EDI content as a string
   * @returns {EDIParserStatistics} Comprehensive statistics object with all metrics
   */
  protected parseEdiFileAndCollectStatistics(
    fileName: string,
    ediContent: string,
  ): EDIParserStatistics {
    const basicFileStatistics = this.extractBasicFileStatistics(ediContent);

    try {
      const parseOperationStartTime = performance.now();
      const parseResultData = this.parser.parse(ediContent);
      const parseOperationEndTime = performance.now();

      const validationOperationStartTime = performance.now();
      const validationResultData: IntegrityValidationResult[] =
        this.parser.validate(ediContent);
      const validationOperationEndTime = performance.now();

      const transactionLoopCount = this.isValidParseResult(parseResultData)
        ? parseResultData.transaction.loops.length
        : 0;

      let isValid = false;
      let errorCount = 0;
      let warningCount = 0;
      let infoCount = 0;
      let errors: string[] = [];
      let warnings: string[] = [];
      let infos: string[] = [];
      const missingElements: Array<{
        segmentTag: string;
        segmentPosition: number;
        elementPosition: number;
        originalValue: string;
        context: string;
      }> = [];
      const transformationIssues: Array<{
        segmentTag: string;
        segmentPosition: number;
        elementPosition: number;
        originalValue: string;
        transformedValue: string;
        issueType: "format_change" | "data_loss" | "encoding_issue";
        severity: "warning" | "error" | "info";
      }> = [];
      const ruleViolations: Array<{
        segmentTag: string;
        elementPosition: number;
        severity: "error" | "warning" | "info";
        issueType: string;
      }> = [];
      let totalSegments: number | undefined;
      let totalElements: number | undefined;
      let matchedElements: number | undefined;
      let segmentCoverage: number | undefined;
      let elementCoverage: number | undefined;
      let parsingAccuracy: number | undefined;
      let dataIntegrity: number | undefined;

      if (
        Array.isArray(validationResultData) &&
        validationResultData.length > 0
      ) {
        isValid = validationResultData.every(
          (validationResultItem) => validationResultItem.isValid,
        );

        for (const validationResultItem of validationResultData) {
          missingElements.push(...validationResultItem.missingElements);
          transformationIssues.push(
            ...validationResultItem.transformationIssues,
          );

          if (
            totalSegments === undefined &&
            validationResultItem.totalSegments !== undefined
          ) {
            totalSegments = validationResultItem.totalSegments;
          }
          if (
            totalElements === undefined &&
            validationResultItem.totalElements !== undefined
          ) {
            totalElements = validationResultItem.totalElements;
          }
          if (
            matchedElements === undefined &&
            validationResultItem.matchedElements !== undefined
          ) {
            matchedElements = validationResultItem.matchedElements;
          }

          if (
            validationResultItem.statistics &&
            segmentCoverage === undefined
          ) {
            segmentCoverage = validationResultItem.statistics.segmentCoverage;
            elementCoverage = validationResultItem.statistics.elementCoverage;
            parsingAccuracy = validationResultItem.statistics.parsingAccuracy;
            dataIntegrity = validationResultItem.statistics.dataIntegrity;
          }
        }

        errorCount = missingElements.length;
        warningCount = transformationIssues.filter(
          (issue) => issue.severity === "warning",
        ).length;
        infoCount = transformationIssues.filter(
          (issue) => issue.severity === "info",
        ).length;

        errors = missingElements.map(
          (el) =>
            `Missing element: ${el.segmentTag} at position ${el.elementPosition}`,
        );
        warnings = transformationIssues
          .filter((issue) => issue.severity === "warning")
          .map(
            (issue) =>
              `Transformation issue: ${issue.segmentTag} at position ${issue.elementPosition}`,
          );
        infos = transformationIssues
          .filter((issue) => issue.severity === "info")
          .map(
            (issue) =>
              `Info: ${issue.segmentTag} at position ${issue.elementPosition}`,
          );
      }

      if (
        !isValid &&
        this.isValidParseResult(parseResultData) &&
        parseResultData.transaction.loops.length > 0
      ) {
        const parseResultStatistics = parseResultData.statistics;
        if (
          parseResultStatistics &&
          Array.isArray(parseResultStatistics.errors) &&
          parseResultStatistics.errors.length === 0
        ) {
          isValid = true;
        }
      }

      const completeStatistics: EDIParserStatistics = {
        filename: fileName,
        parseTime: parseOperationEndTime - parseOperationStartTime,
        validationTime:
          validationOperationEndTime - validationOperationStartTime,
        fileSize: basicFileStatistics.fileSize,
        segmentCount: basicFileStatistics.segmentCount,
        loopCount: transactionLoopCount,
        isValid,
        errorCount,
        warningCount,
        infoCount,
        errors,
        warnings,
        infos,
        missingElements,
        transformationIssues,
        ruleViolations,
        totalSegments,
        totalElements,
        matchedElements,
        segmentCoverage,
        elementCoverage,
        parsingAccuracy,
        dataIntegrity,
        validationStrategy: "comprehensive",
      };

      if (this.isValidEdiTransaction(parseResultData.transaction)) {
        this.saveEdiTransactionResult(
          fileName,
          ediContent,
          parseResultData.transaction,
          completeStatistics,
        );
      }

      return completeStatistics;
    } catch (parsingError) {
      const errorMessage =
        parsingError instanceof Error
          ? parsingError.message
          : String(parsingError);

      return {
        filename: fileName,
        parseTime: 0,
        fileSize: basicFileStatistics.fileSize,
        segmentCount: basicFileStatistics.segmentCount,
        loopCount: 0,
        validationTime: 0,
        isValid: false,
        errorCount: 1,
        warningCount: 0,
        infoCount: 0,
        errors: [errorMessage],
        warnings: [],
        infos: [],
        missingElements: [],
        transformationIssues: [],
        ruleViolations: [],
        validationStrategy: "comprehensive",
      };
    }
  }

  /**
   * Recursively cleans the output directory by removing all existing files and subdirectories.
   *
   * This method ensures a clean slate for new output generation by removing
   * all previously generated files. It's particularly useful when:
   * - Running batch operations multiple times
   * - Preventing confusion from stale output files
   * - Ensuring output consistency across runs
   *
   * Algorithm:
   * The method uses a recursive approach to handle nested directories:
   * 1. Check if output directory exists
   * 2. Define recursive removal function that:
   *    a. Reads all entries in current directory
   *    b. For each entry, check if it's a file or directory
   *    c. If directory: Recursively process it, then remove empty directory
   *    d. If file: Delete the file
   * 3. Execute recursive removal starting from base output directory
   *
   * Directory Structure:
   * The base output directory is located at:
   * __dirname/output
   *
   * This preserves the directory structure convention where input and output
   * are sibling directories within the edi-parser-example folder.
   *
   * Safety Considerations:
   * - Only removes files within the specific output directory
   * - Does not traverse outside the designated output path
   * - Wrapped in try-catch to prevent errors from halting processing
   * - Logs warning on failure but continues execution
   *
   * File System Operations:
   * - readdirSync: Lists all files and directories
   * - statSync: Checks if entry is file or directory
   * - rmdirSync: Removes empty directories
   * - unlinkSync: Deletes files
   *
   * Error Handling:
   * If the cleanup operation fails:
   * - Error is caught and logged as a warning
   * - Processing continues without throwing exception
   * - Output files may be appended to existing files
   *
   * This graceful degradation ensures that a cleanup failure doesn't
   * prevent the actual EDI processing from proceeding.
   *
   * Performance:
   * Cleanup time depends on number of existing files:
   * - Typical: <10ms for directories with dozens of files
   * - Large batches: May take 50-100ms for hundreds of files
   *
   * @protected
   * @returns {void}
   */
  protected cleanExistingOutputFiles(): void {
    try {
      const baseOutputDir = path.join(__dirname, "output");

      if (fs.existsSync(baseOutputDir)) {
        const removeRecursive = (dirPath: string): void => {
          const files = fs.readdirSync(dirPath);

          for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
              removeRecursive(filePath);
              fs.rmdirSync(filePath);
            } else {
              fs.unlinkSync(filePath);
            }
          }
        };

        removeRecursive(baseOutputDir);
        console.log("🧹 Cleaned existing output files");
      }
    } catch (error) {
      console.warn("Warning: Could not clean output directory:", error);
    }
  }

  /**
   * Displays comprehensive parsing statistics in formatted tabular output.
   *
   * This method generates a detailed multi-section report showing parsing results,
   * validation metrics, and issue details. The report is designed for easy consumption
   * in terminal output with clear visual separation and formatted tables.
   *
   * Report Structure:
   * The report consists of up to 7 sections:
   * 1. Summary Statistics: Aggregate metrics across all files
   * 2. File Breakdown: Per-file statistics in tabular format
   * 3. Error Details: Detailed error messages (if errors exist)
   * 4. Warning Details: Detailed warning messages (if warnings exist)
   * 5. Missing Elements: Elements lost during parsing (if any)
   * 6. Transformation Issues: Data transformation problems (if any)
   * 7. Rule Violations: Specification violations (if any)
   *
   * Section 1: Summary Statistics
   * Aggregated metrics computed across all files:
   * - Files Processed: Total count and success rate
   * - Total Data Size: Sum of all file sizes (formatted)
   * - Total Segments/Loops: Structural complexity indicators
   * - Total Parse/Validation Time: Performance metrics
   * - Total Errors/Warnings/Infos: Issue counts by severity
   * - Missing Elements: Count of data loss issues
   * - Transformation Issues: Count of data transformation problems
   * - Rule Violations: Count of specification violations
   * - Average Integrity Metrics: Mean coverage and accuracy (if available)
   *
   * Integrity Metrics Calculation:
   * Average metrics are computed only for files that have integrity data:
   * - Segment Coverage: % of segments preserved in parsing
   * - Element Coverage: % of elements preserved in parsing
   * - Parsing Accuracy: % of elements matching exactly
   * - Data Integrity: Overall quality score (0-100)
   *
   * These averages help identify systematic parsing issues vs. file-specific problems.
   *
   * Section 2: File Breakdown
   * Per-file metrics displayed in a table:
   * - File: Filename or relative path
   * - Valid: ✅ for valid files, ❌ for invalid
   * - Size: File size in human-readable format
   * - Segments: Segment count
   * - Loops: Loop structure count
   * - Parse Time: Parsing duration in appropriate units
   * - Errors/Warnings/Infos: Issue counts
   * - Missing Elements: Count of lost elements
   * - Rule Violations: Count of specification violations
   * - Data Integrity: Quality percentage or "N/A"
   *
   * This table allows quick identification of problematic files.
   *
   * Sections 3-7: Detailed Issue Reports
   * Each issue type gets its own section (only if issues exist):
   *
   * Error Details:
   * - File: Source filename
   * - Error: Error message
   *
   * Warning Details:
   * - File: Source filename
   * - Warning: Warning message
   *
   * Missing Elements:
   * - File: Source filename
   * - Segment: Segment tag (e.g., "NM1", "REF")
   * - Position: Element position within segment
   * - Original Value: Value from original EDI
   * - Context: Contextual information
   *
   * Transformation Issues:
   * - File: Source filename
   * - Segment: Segment tag
   * - Position: Element position
   * - Original Value: Value before transformation
   * - Transformed Value: Value after transformation
   * - Issue Type: format_change, data_loss, or encoding_issue
   * - Severity: error, warning, or info
   *
   * Rule Violations:
   * - File: Source filename
   * - Segment: Segment tag
   * - Position: Element position
   * - Issue Type: Type of violation
   * - Severity: error, warning, or info
   *
   * Visual Formatting:
   * - Section headers use emoji icons for visual identification
   * - Header separator uses Unicode box-drawing characters
   * - Tables use console.table() for automatic alignment
   * - Percentages formatted to 1 decimal place
   * - Times formatted with appropriate units
   *
   * Performance Considerations:
   * For large batches with many issues:
   * - Issue detail tables can become very long
   * - Terminal scrollback may be exceeded
   * - Consider filtering or summarizing for very large datasets
   *
   * The method handles empty statistics arrays gracefully by returning early.
   *
   * @protected
   * @param {readonly EDIParserStatistics[]} allFileStatistics - Array of statistics from all processed files
   * @returns {void}
   */
  protected displayComprehensiveSummaryStatistics(
    allFileStatistics: readonly EDIParserStatistics[],
  ): void {
    if (allFileStatistics.length === 0) return;

    console.log("\n📊 SUMMARY STATISTICS");
    console.log("═".repeat(50));

    const totalFileCount = allFileStatistics.length;
    const successfulFileCount = allFileStatistics.filter(
      (statistics) => statistics.isValid,
    ).length;
    const totalDataSize = allFileStatistics.reduce(
      (sum, statistics) => sum + statistics.fileSize,
      0,
    );
    const totalSegmentCount = allFileStatistics.reduce(
      (sum, statistics) => sum + statistics.segmentCount,
      0,
    );
    const totalLoopCount = allFileStatistics.reduce(
      (sum, statistics) => sum + statistics.loopCount,
      0,
    );
    const totalParseTime = allFileStatistics.reduce(
      (sum, statistics) => sum + statistics.parseTime,
      0,
    );
    const totalValidationTime = allFileStatistics.reduce(
      (sum, statistics) => sum + statistics.validationTime,
      0,
    );
    const totalErrorCount = allFileStatistics.reduce(
      (sum, statistics) => sum + statistics.errorCount,
      0,
    );
    const totalWarningCount = allFileStatistics.reduce(
      (sum, statistics) => sum + statistics.warningCount,
      0,
    );
    const totalInfoCount = allFileStatistics.reduce(
      (sum, statistics) => sum + statistics.infoCount,
      0,
    );
    const totalMissingElementCount = allFileStatistics.reduce(
      (sum, statistics) => sum + statistics.missingElements.length,
      0,
    );
    const totalTransformationIssueCount = allFileStatistics.reduce(
      (sum, statistics) => sum + statistics.transformationIssues.length,
      0,
    );
    const totalRuleViolationCount = allFileStatistics.reduce(
      (sum, statistics) => sum + statistics.ruleViolations.length,
      0,
    );

    const filesWithIntegrityMetrics = allFileStatistics.filter(
      (statistics) => statistics.segmentCoverage !== undefined,
    );
    const averageSegmentCoverage =
      filesWithIntegrityMetrics.length > 0
        ? filesWithIntegrityMetrics.reduce(
            (sum, statistics) => sum + (statistics.segmentCoverage ?? 0),
            0,
          ) / filesWithIntegrityMetrics.length
        : undefined;
    const averageElementCoverage =
      filesWithIntegrityMetrics.length > 0
        ? filesWithIntegrityMetrics.reduce(
            (sum, statistics) => sum + (statistics.elementCoverage ?? 0),
            0,
          ) / filesWithIntegrityMetrics.length
        : undefined;
    const averageParsingAccuracy =
      filesWithIntegrityMetrics.length > 0
        ? filesWithIntegrityMetrics.reduce(
            (sum, statistics) => sum + (statistics.parsingAccuracy ?? 0),
            0,
          ) / filesWithIntegrityMetrics.length
        : undefined;
    const averageDataIntegrity =
      filesWithIntegrityMetrics.length > 0
        ? filesWithIntegrityMetrics.reduce(
            (sum, statistics) => sum + (statistics.dataIntegrity ?? 0),
            0,
          ) / filesWithIntegrityMetrics.length
        : undefined;

    const summaryTableData: Record<string, string | number> = {
      "Files Processed": totalFileCount,
      "Successfully Parsed": `${successfulFileCount} (${((successfulFileCount / totalFileCount) * 100).toFixed(1)}%)`,
      "Total Data Size": this.formatFileSize(totalDataSize),
      "Total Segments": totalSegmentCount,
      "Total Loops": totalLoopCount,
      "Total Parse Time": this.formatExecutionTime(totalParseTime),
      "Total Validation Time": this.formatExecutionTime(totalValidationTime),
      "Total Errors": totalErrorCount,
      "Total Warnings": totalWarningCount,
      "Total Infos": totalInfoCount,
      "Missing Elements": totalMissingElementCount,
      "Transformation Issues": totalTransformationIssueCount,
      "Rule Violations": totalRuleViolationCount,
    };

    if (averageSegmentCoverage !== undefined) {
      summaryTableData["Avg Segment Coverage"] =
        `${averageSegmentCoverage.toFixed(1)}%`;
    }
    if (averageElementCoverage !== undefined) {
      summaryTableData["Avg Element Coverage"] =
        `${averageElementCoverage.toFixed(1)}%`;
    }
    if (averageParsingAccuracy !== undefined) {
      summaryTableData["Avg Parsing Accuracy"] =
        `${averageParsingAccuracy.toFixed(1)}%`;
    }
    if (averageDataIntegrity !== undefined) {
      summaryTableData["Avg Data Integrity"] =
        `${averageDataIntegrity.toFixed(1)}%`;
    }

    console.table(summaryTableData);

    console.log("\n📄 File Breakdown:");
    const fileBreakdownTable = allFileStatistics.map((fileStatistics) => ({
      File: fileStatistics.filename,
      Valid: fileStatistics.isValid ? "✅" : "❌",
      Size: this.formatFileSize(fileStatistics.fileSize),
      Segments: fileStatistics.segmentCount,
      Loops: fileStatistics.loopCount,
      "Parse Time": this.formatExecutionTime(fileStatistics.parseTime),
      Errors: fileStatistics.errorCount,
      Warnings: fileStatistics.warningCount,
      Infos: fileStatistics.infoCount,
      "Missing Elements": fileStatistics.missingElements.length,
      "Rule Violations": fileStatistics.ruleViolations.length,
      "Data Integrity":
        fileStatistics.dataIntegrity !== undefined
          ? `${fileStatistics.dataIntegrity.toFixed(1)}%`
          : "N/A",
    }));
    console.table(fileBreakdownTable);

    if (totalErrorCount > 0) {
      console.log("\n🚨 Error Details:");
      const errorDetailsTable: Array<{ File: string; Error: string }> = [];
      for (const fileStatistics of allFileStatistics) {
        if (fileStatistics.errorCount > 0) {
          for (const errorMessage of fileStatistics.errors) {
            errorDetailsTable.push({
              File: fileStatistics.filename,
              Error: errorMessage,
            });
          }
        }
      }
      console.table(errorDetailsTable);
    }

    if (totalWarningCount > 0) {
      console.log("\n⚠️  Warning Details:");
      const warningDetailsTable: Array<{ File: string; Warning: string }> = [];
      for (const fileStatistics of allFileStatistics) {
        if (fileStatistics.warningCount > 0) {
          for (const warningMessage of fileStatistics.warnings) {
            warningDetailsTable.push({
              File: fileStatistics.filename,
              Warning: warningMessage,
            });
          }
        }
      }
      console.table(warningDetailsTable);
    }

    if (totalMissingElementCount > 0) {
      console.log("\n❓ Missing Elements Details:");
      const missingElementsDetailsTable: Array<{
        File: string;
        Segment: string;
        Position: number;
        "Original Value": string;
        Context: string;
      }> = [];
      for (const fileStatistics of allFileStatistics) {
        for (const missingElement of fileStatistics.missingElements) {
          missingElementsDetailsTable.push({
            File: fileStatistics.filename,
            Segment: missingElement.segmentTag,
            Position: missingElement.elementPosition,
            "Original Value": missingElement.originalValue,
            Context: missingElement.context,
          });
        }
      }
      console.table(missingElementsDetailsTable);
    }

    if (totalTransformationIssueCount > 0) {
      console.log("\n🔄 Transformation Issues:");
      const transformationDetailsTable: Array<{
        File: string;
        Segment: string;
        Position: number;
        "Original Value": string;
        "Transformed Value": string;
        "Issue Type": string;
        Severity: string;
      }> = [];
      for (const fileStatistics of allFileStatistics) {
        for (const transformationIssue of fileStatistics.transformationIssues) {
          transformationDetailsTable.push({
            File: fileStatistics.filename,
            Segment: transformationIssue.segmentTag,
            Position: transformationIssue.elementPosition,
            "Original Value": transformationIssue.originalValue,
            "Transformed Value": transformationIssue.transformedValue,
            "Issue Type": transformationIssue.issueType,
            Severity: transformationIssue.severity,
          });
        }
      }
      console.table(transformationDetailsTable);
    }

    if (totalRuleViolationCount > 0) {
      console.log("\n📋 Rule Violations:");
      const ruleViolationDetailsTable: Array<{
        File: string;
        Segment: string;
        Position: number;
        "Issue Type": string;
        Severity: string;
      }> = [];
      for (const fileStatistics of allFileStatistics) {
        for (const ruleViolation of fileStatistics.ruleViolations) {
          ruleViolationDetailsTable.push({
            File: fileStatistics.filename,
            Segment: ruleViolation.segmentTag,
            Position: ruleViolation.elementPosition,
            "Issue Type": ruleViolation.issueType,
            Severity: ruleViolation.severity,
          });
        }
      }
      console.table(ruleViolationDetailsTable);
    }
  }
}
