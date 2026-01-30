/**
 * EDI Parser Example Types
 *
 * This module defines the core type definitions used throughout the EDI parser
 * example application. These types provide strong typing for parsing statistics,
 * file content structures, and processor configuration options.
 *
 * @module types
 */

import type {
  MissingElement,
  TransformationIssue,
  ValidationStatistics,
} from "@edi-parser/core";

/**
 * Comprehensive statistics and validation results from EDI file parsing.
 *
 * This interface captures all metrics generated during the parsing and validation
 * of an EDI file, including performance timing, coverage metrics, and detailed
 * issue tracking for debugging and quality assurance purposes.
 *
 * @interface EDIParserStatistics
 */
export interface EDIParserStatistics {
  readonly filename: string;
  readonly parseTime: number;
  readonly fileSize: number;
  readonly segmentCount: number;
  readonly loopCount: number;
  readonly validationTime: number;

  // Core validation status
  readonly isValid: boolean;

  // Integrity validation metrics (from ValidationResult)
  readonly totalSegments?: number | undefined;
  readonly totalElements?: number | undefined;
  readonly matchedElements?: number | undefined;
  readonly segmentCoverage?: number | undefined;
  readonly elementCoverage?: number | undefined;
  readonly parsingAccuracy?: number | undefined;
  readonly dataIntegrity?: number | undefined;

  // Issue tracking (compatible with both validation types)
  readonly errorCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
  readonly errors: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
  readonly infos: ReadonlyArray<string>;

  // Missing elements and transformation issues using existing types
  readonly missingElements: ReadonlyArray<MissingElement>;
  readonly transformationIssues: ReadonlyArray<TransformationIssue>;

  // Rule validation results using simplified structure
  readonly ruleViolations: ReadonlyArray<{
    segmentTag: string;
    elementPosition: number;
    severity: "error" | "warning" | "info";
    issueType: string;
  }>;

  // Performance and memory metrics
  readonly memoryUsage?: number | undefined;
  readonly validationStrategy?: string | undefined;
  readonly integrityStatistics?: ValidationStatistics | undefined;
}

/**
 * Represents a single EDI file with its filename and raw content.
 *
 * This structure is used to pass EDI data through the processing pipeline,
 * maintaining the association between filename and content for proper
 * output file naming and error reporting.
 *
 * @interface EDIFileContent
 * @property {string} filename - The display name or path of the EDI file
 * @property {string} content - The raw EDI content as a string
 */
export interface EDIFileContent {
  readonly filename: string;
  readonly content: string;
}

/**
 * Configuration options for EDI processors.
 *
 * These options control the behavior of all processor types,
 * providing consistent configuration across the processing pipeline.
 *
 * @interface ProcessorOptions
 * @property {boolean} [cleanOutput] - Whether to clear existing output files before processing
 */
export interface ProcessorOptions {
  readonly cleanOutput?: boolean;
}
