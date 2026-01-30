/**
 * EDI Processor Factory
 *
 * This module implements the Factory Pattern to create appropriate EDI processor
 * instances based on the input source type. The factory encapsulates the creation
 * logic and provides a unified interface for obtaining processors.
 *
 * Benefits of the Factory Pattern:
 * - Decouples processor creation from usage
 * - Centralizes processor instantiation logic
 * - Enables easy addition of new processor types
 * - Provides type-safe processor creation
 *
 * @module processor-factory
 */

import { EDIProcessor } from "./edi-processor";
import { DirectoryEDIProcessor } from "./directory-processor";
import { ArrayEDIProcessor } from "./array-processor";
import { JsonEDIProcessor } from "./json-processor";
import type { BaseEDIProcessor } from "./base-processor";

/**
 * Supported processor types for the factory.
 *
 * @typedef {"edi" | "directory" | "array" | "json"} ProcessorType
 */
export type ProcessorType = "edi" | "directory" | "array" | "json";

/**
 * Factory class for creating EDI processor instances.
 *
 * This factory provides both a generic creation method and convenience methods
 * for creating specific processor types with proper return type inference.
 *
 * @class EDIProcessorFactory
 */
export class EDIProcessorFactory {
  /**
   * Creates an EDI processor based on the specified type.
   *
   * @param {ProcessorType} type - The type of processor to create
   * @returns {BaseEDIProcessor} An instance of the appropriate processor
   */
  public static createProcessor(type: ProcessorType): BaseEDIProcessor {
    switch (type) {
      case "edi":
        return new EDIProcessor();
      case "directory":
        return new DirectoryEDIProcessor();
      case "array":
        return new ArrayEDIProcessor();
      case "json":
        return new JsonEDIProcessor();
    }
  }

  /**
   * Creates a processor for single EDI file processing.
   *
   * Use this processor when you have a single .edi file to parse.
   * The processor reads the file, parses it, and outputs statistics.
   *
   * @returns {EDIProcessor} A new EDI file processor instance
   */
  public static createFileProcessor(): EDIProcessor {
    return new EDIProcessor();
  }

  /**
   * Creates a processor for directory-based EDI file processing.
   *
   * Use this processor to recursively scan a directory and process
   * all .edi files found within it and its subdirectories.
   *
   * @returns {DirectoryEDIProcessor} A new directory processor instance
   */
  public static createDirectoryProcessor(): DirectoryEDIProcessor {
    return new DirectoryEDIProcessor();
  }

  /**
   * Creates a processor for array-based EDI data processing.
   *
   * Use this processor when you have EDI content in memory as an array
   * of objects containing content and payer information.
   *
   * @returns {ArrayEDIProcessor} A new array processor instance
   */
  public static createArrayProcessor(): ArrayEDIProcessor {
    return new ArrayEDIProcessor();
  }

  /**
   * Creates a processor for JSON file-based EDI data processing.
   *
   * Use this processor to read EDI data from a JSON file that contains
   * encoded EDI responses. Supports filtering, pagination, and offset.
   *
   * @returns {JsonEDIProcessor} A new JSON processor instance
   */
  public static createJsonProcessor(): JsonEDIProcessor {
    return new JsonEDIProcessor();
  }
}
