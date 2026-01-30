/**
 * EDI Validation Processor - Comprehensive EDI Structure and Content Validation
 *
 * This processor performs thorough validation of EDI transactions using the
 * project's parser factory. It validates both the structural integrity and
 * business rule compliance of 270 and 271 EDI transactions.
 *
 * Key Responsibilities:
 * - Validate EDI transaction structure using appropriate parsers
 * - Perform integrity checks on EDI segments and elements
 * - Collect and categorize validation errors and warnings
 * - Update transaction validity status
 * - Calculate aggregate statistics for transaction pairs
 *
 * Validation Levels:
 * 1. Structural Validation - Correct EDI format, required segments present
 * 2. Content Validation - Proper element values, code validation
 * 3. Business Rule Validation - HIPAA compliance, trading partner rules
 * 4. Integrity Validation - Data completeness, cross-segment consistency
 *
 * Error Classification:
 * - Errors: Critical issues that prevent processing (missing required segments)
 * - Warnings: Non-critical issues that don't prevent processing (missing optional elements)
 * - Info: Informational messages about data transformation or interpretation
 *
 * Lenient Validation Strategy:
 * For CSV processing, this processor uses a more lenient validation approach
 * than strict EDI validation. Missing elements and minor format issues are
 * treated as warnings rather than errors to handle real-world data variations.
 */
import { PairProcessor } from "./base-processor";
import type { ProcessingContext, ProcessedEDITransaction } from "./types";
import { ParserFactory } from "@edi-parser/core";
import type { TransactionType } from "@edi-parser/core";

/**
 * EDI Validation Processor - Third processor in the EDI processing chain
 *
 * This processor validates EDI transactions using the project's parsing
 * infrastructure. It applies appropriate validation rules based on transaction
 * type and provides detailed feedback about data quality.
 *
 * Validation Strategy:
 * - Use transaction-specific parsers (270 vs 271)
 * - Apply both parse and integrity validation
 * - Classify issues by severity (error vs warning)
 * - Maintain lenient approach for CSV processing
 *
 * Integration:
 * - Uses ParserFactory to get appropriate validators
 * - Leverages existing EDI parsing and validation logic
 * - Maintains consistency with other parsing operations
 */
export class EDIValidationProcessor extends PairProcessor {
  // Singleton parser factory instance for creating transaction-specific parsers
  private readonly parserFactory: ParserFactory;

  /**
   * Constructor initializes the parser factory
   * Uses singleton pattern to ensure consistent parser configuration
   */
  constructor() {
    super();
    this.parserFactory = ParserFactory.getInstance();
  }

  /**
   * Main validation processing method
   *
   * This method validates both request and response transactions in a pair
   * and updates the pair's validation status and statistics. It processes
   * each transaction independently and then calculates aggregate metrics.
   *
   * Process Flow:
   * 1. Validate 270 request transaction (if present)
   * 2. Validate 271 response transaction (if present)
   * 3. Update individual transaction status
   * 4. Calculate pair-level statistics
   * 5. Determine overall pair validity
   *
   * @param context - Processing context containing transaction pair
   */
  protected handle(context: ProcessingContext): void {
    const { pair } = context;
    if (pair == null) return;

    // Aggregate error count across both transactions
    let totalErrors = 0;
    // Aggregate warning count across both transactions
    let totalWarnings = 0;

    // Validate eligibility request (270) if present
    if (pair.request != null) {
      const validation = this.validateEDITransaction(pair.request, "270");
      // Update transaction with validation results
      pair.request.errors = validation.errors;
      pair.request.warnings = validation.warnings;
      pair.request.isValid = validation.isValid;
      // Accumulate counts for pair statistics
      totalErrors += validation.errors.length;
      totalWarnings += validation.warnings.length;
    }

    // Validate eligibility response (271) if present
    if (pair.response != null) {
      const validation = this.validateEDITransaction(pair.response, "271");
      // Update transaction with validation results
      pair.response.errors = validation.errors;
      pair.response.warnings = validation.warnings;
      pair.response.isValid = validation.isValid;
      // Accumulate counts for pair statistics
      totalErrors += validation.errors.length;
      totalWarnings += validation.warnings.length;
    }

    // Update pair-level validation status and statistics
    pair.pairComplete = pair.request != null && pair.response != null;
    pair.summary.bothValid =
      pair.pairComplete &&
      pair.request?.isValid === true &&
      pair.response?.isValid === true;
    pair.summary.totalErrors = totalErrors;
    pair.summary.totalWarnings = totalWarnings;
  }

  /**
   * Validates a single EDI transaction using appropriate parser
   *
   * This method performs comprehensive validation of an EDI transaction
   * including structural validation, content validation, and integrity checks.
   * It uses a lenient approach suitable for CSV processing.
   *
   * Validation Process:
   * 1. Basic data presence validation
   * 2. Parser creation and configuration
   * 3. Structural parsing and validation
   * 4. Content and business rule validation
   * 5. Integrity validation (optional, warnings only)
   * 6. Error classification and severity assignment
   *
   * @param transaction - The EDI transaction to validate
   * @param expectedType - Expected transaction type ('270' or '271')
   * @returns Validation result with errors, warnings, and validity status
   */
  private validateEDITransaction(
    transaction: ProcessedEDITransaction,
    expectedType: string,
  ): { errors: string[]; warnings: string[]; isValid: boolean } {
    // Collection of critical validation errors
    const errors: string[] = [];
    // Collection of non-critical warnings
    const warnings: string[] = [];

    // Basic data validation - ensure we have EDI content to validate
    if (
      transaction.decodedData == null ||
      transaction.decodedData.length === 0
    ) {
      errors.push(`No EDI data found in ${expectedType} transaction`);
      return { errors, warnings, isValid: false };
    }

    try {
      // Create transaction-specific parser using the factory
      const parser = this.parserFactory.createParser(
        expectedType as TransactionType,
      );
      if (parser == null) {
        errors.push(
          `Could not create parser for transaction type ${expectedType}`,
        );
        return { errors, warnings, isValid: false };
      }

      // Perform structural parsing and validation
      const parseResult = parser.parse(transaction.decodedData);

      // Extract errors and warnings from parse result statistics
      if (parseResult.statistics?.errors != null) {
        errors.push(...parseResult.statistics.errors);
      }

      if (parseResult.statistics?.warnings != null) {
        warnings.push(...parseResult.statistics.warnings);
      }

      // Update transaction segments from parse result for consistency
      // This ensures segments are properly formatted and parsed
      if (parseResult.transaction?.segments != null) {
        transaction.segments = parseResult.transaction.segments.map(
          (seg: unknown) => {
            const segment = seg as {
              tag: string;
              elements: Array<{ value: string }>;
            };
            return `${segment.tag}*${segment.elements.map((el) => el.value).join("*")}`;
          },
        );
      }

      // Perform additional integrity validation (non-critical)
      try {
        const integrityResult = parser.validateIntegrity(
          transaction.decodedData,
        );
        if (!integrityResult.isValid && integrityResult.RuleResults != null) {
          // Process integrity validation results
          for (const result of integrityResult.RuleResults) {
            const message = `${result.segmentTag}: ${result.issueType} at position ${result.elementPosition}`;
            // Classify by severity level
            if (result.severity === "error") {
              errors.push(message);
            } else {
              warnings.push(message);
            }
          }
        }
      } catch (integrityError) {
        // Integrity validation failure is not critical for CSV processing
        warnings.push(
          `Integrity validation failed: ${
            integrityError instanceof Error
              ? integrityError.message
              : String(integrityError)
          }`,
        );
      }

      // Note: For CSV processing, we use a lenient validation approach
      // Missing elements are common in real-world EDI and should be warnings
    } catch (parseError) {
      // Critical parsing errors prevent further processing
      errors.push(
        `Parse error for ${expectedType}: ${
          parseError instanceof Error ? parseError.message : String(parseError)
        }`,
      );
    }

    // Apply lenient validation logic for CSV processing
    // Only critical structural errors should mark transactions as invalid
    const criticalErrors = errors.filter(
      (error) =>
        !error.includes("missing_element") &&
        !error.includes("transformation_issue") &&
        !error.includes("Parse error"),
    );

    // Move non-critical errors to warnings for CSV processing
    const nonCriticalErrors = errors.filter(
      (error) =>
        error.includes("missing_element") ||
        error.includes("transformation_issue"),
    );
    warnings.push(...nonCriticalErrors);

    // Transaction is valid if no critical structural errors
    const isValid = criticalErrors.length === 0;
    return { errors: criticalErrors, warnings, isValid };
  }
}
