/**
 * EDI Parser Example Module
 *
 * This module serves as the main entry point for the EDI parser example application.
 * It implements several design patterns to provide a flexible and maintainable
 * architecture for processing EDI files from various input sources.
 *
 * Design Patterns Used:
 * - Factory Pattern: EDIProcessorFactory creates appropriate processor instances
 * - Template Method Pattern: BaseEDIProcessor defines the processing algorithm
 * - Strategy Pattern: Different processors handle different input types
 *
 * Supported Input Sources:
 * - Single EDI files (.edi)
 * - Directories containing EDI files (recursive scanning)
 * - JSON files with encoded EDI data
 * - Arrays of EDI content with metadata
 *
 * @module edi-parser-example
 */

export { BaseEDIProcessor } from "./base-processor";
export { EDIProcessor } from "./edi-processor";
export { DirectoryEDIProcessor } from "./directory-processor";
export { ArrayEDIProcessor } from "./array-processor";
export { JsonEDIProcessor } from "./json-processor";
export { EDIProcessorFactory } from "./processor-factory";
export type { ProcessorType } from "./processor-factory";
export type {
  EDIParserStatistics,
  EDIFileContent,
  ProcessorOptions,
} from "./types";
export type { JsonProcessorOptions } from "./json-processor";
