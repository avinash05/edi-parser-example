/**
 * Data Decoding Processor - Handles Multiple EDI Data Encoding Formats
 *
 * This processor is responsible for decoding EDI data that may be stored in
 * various encoded formats within CSV files. It handles multiple encoding
 * schemes commonly used for storing EDI data in databases and files.
 *
 * Supported Encoding Formats:
 * 1. Hexadecimal encoding (0x prefix)
 * 2. Compressed data (zip:: prefix after hex decode)
 * 3. Plain text EDI data
 * 4. XML-wrapped EDI data (extracts EDI from XML containers)
 *
 * Key Responsibilities:
 * - Detect and decode various data encoding formats
 * - Extract EDI content from XML wrappers when present
 * - Create ProcessedEDITransaction structures for both requests and responses
 * - Extract metadata from additional CSV columns (status, payer info)
 * - Validate basic EDI structure (ISA/ST segments)
 *
 * Data Flow:
 * CSV Row → Decode Columns → Extract EDI → Create Transactions → Add Metadata
 *
 * Error Handling:
 * - Graceful fallback for unrecognized encoding formats
 * - Preserves original data when decoding fails
 * - Continues processing even if one column fails to decode
 *
 * Performance Considerations:
 * - Uses synchronous zlib operations (suitable for typical EDI message sizes)
 * - Efficient regex patterns for XML content extraction
 * - Minimal memory allocations during decoding process
 */
import * as zlib from "zlib";
import { PairProcessor } from "./base-processor";
import type {
  ProcessingContext,
  DecodedData,
  ProcessedEDITransaction,
} from "./types";

/**
 * Utility function to decompress and decode EDI data from various formats
 *
 * This function handles the complex logic of detecting and decoding different
 * data formats that EDI data might be stored in. It's designed to be robust
 * and handle real-world variations in data encoding.
 *
 * Decoding Process:
 * 1. Clean input data (remove BOM, whitespace)
 * 2. Detect format based on prefixes and patterns
 * 3. Apply appropriate decoding (hex, compression, etc.)
 * 4. Return decoded EDI content
 */
function decompressData(data: string): string {
  try {
    // Clean the data by removing BOM and other invisible characters
    // BOM (Byte Order Mark) can appear at the start of UTF-8 files
    const cleanData = data.replace(/^\uFEFF/, "").trim();

    if (cleanData.startsWith("0x")) {
      // Handle hexadecimal-encoded data
      // Remove '0x' prefix and convert hex string to buffer
      const hexData = cleanData.substring(2);
      const buffer = Buffer.from(hexData, "hex");

      // Check if the hex-decoded data contains compression markers
      const bufferStr = buffer.toString("utf8");

      if (bufferStr.startsWith("zip::")) {
        // Handle zip-compressed data format
        // Data after 'zip::' marker is raw compressed buffer
        const compressedStart = buffer.indexOf("zip::") + 5;
        const compressedBuffer = buffer.subarray(compressedStart);

        try {
          // Decompress using zlib inflate (standard compression)
          const decompressed = zlib.inflateSync(compressedBuffer);
          return decompressed.toString("utf8");
        } catch (decompressError) {
          console.warn("Failed to decompress zip:: data:", decompressError);
          // Fall back to the decoded hex data without decompression
          return bufferStr;
        }
      } else {
        // Try to decompress the hex-decoded buffer directly
        // Some data might be compressed without explicit markers
        try {
          const decompressed = zlib.inflateSync(buffer);
          return decompressed.toString("utf8");
        } catch (decompressError) {
          // Not compressed, use the hex-decoded text as-is
          return bufferStr;
        }
      }
    } else {
      // Handle plain text data (no encoding)
      return cleanData;
    }
  } catch (error) {
    console.warn("Failed to decode data:", error);
    // Return original data if all decoding attempts fail
    return data;
  }
}

/**
 * Data Decoding Processor - Second processor in the EDI processing chain
 *
 * This processor transforms raw CSV data into structured ProcessedEDITransaction
 * objects. It handles the complexity of various encoding formats and creates
 * the foundational data structures used by subsequent processors.
 *
 * Processing Logic:
 * 1. Extract data from CSV columns (typically columns 0 and 1)
 * 2. Decode each column using appropriate format detection
 * 3. Create transaction objects with decoded EDI content
 * 4. Extract metadata from additional CSV columns
 * 5. Perform basic EDI structure validation
 */
export class DataDecodingProcessor extends PairProcessor {
  /**
   * Main processing method for decoding CSV row data
   *
   * This method processes a single CSV row and populates the transaction pair
   * with decoded EDI data and extracted metadata. It's designed to be robust
   * and continue processing even if some columns fail to decode.
   *
   * Expected CSV Format:
   * - Column 0: 270 request data (encoded)
   * - Column 1: 271 response data (encoded)
   * - Column 2: Status (optional)
   * - Column 3: Payer ID (optional)
   * - Column 4: Payer ID Code (optional)
   * - Column 5: Payer Name (optional)
   *
   * @param context - Processing context containing CSV row data and transaction pair
   */
  protected handle(context: ProcessingContext): void {
    const { row } = context;

    // Validate input data availability
    if (!row || !context.pair) {
      return;
    }

    // Convert row object to array for indexed access
    const columns = Object.values(row);

    // Process only if we have the minimum required columns (request and response data)
    if (
      columns.length >= 2 &&
      (columns[0]?.length ?? 0) > 0 &&
      (columns[1]?.length ?? 0) > 0
    ) {
      const column0 = columns[0] as string; // Usually 270 eligibility request
      const column1 = columns[1] as string; // Usually 271 eligibility response

      // Extract optional metadata from additional CSV columns
      // This metadata provides context for the EDI transactions

      // Status from 3rd column (e.g., "Active", "Inactive", "Pending")
      if (
        columns.length >= 3 &&
        columns[2] != null &&
        columns[2].length > 0 &&
        context.pair != null
      ) {
        context.pair.status = columns[2];
      }

      // Payer identifier from 4th column
      if (
        columns.length >= 4 &&
        columns[3] != null &&
        columns[3].length > 0 &&
        context.pair != null
      ) {
        context.pair.payerId = columns[3];
      }

      // Payer ID code from 5th column
      if (
        columns.length >= 5 &&
        columns[4] != null &&
        columns[4].length > 0 &&
        context.pair != null
      ) {
        context.pair.payerIdCode = columns[4];
      }

      // Payer name from 6th column
      if (
        columns.length >= 6 &&
        columns[5] != null &&
        columns[5].length > 0 &&
        context.pair != null
      ) {
        context.pair.payerName = columns[5];
      }

      // Decode and process eligibility request (270) from first column
      const requestDecoded = this.decompressDataInternal(column0);
      if (requestDecoded.isValid && context.pair != null) {
        context.pair.request = this.createTransaction(
          "270",
          column0,
          requestDecoded.decoded ?? requestDecoded.original,
        );
      }

      // Decode and process eligibility response (271) from second column
      const responseDecoded = this.decompressDataInternal(column1);
      if (responseDecoded.isValid && context.pair != null) {
        context.pair.response = this.createTransaction(
          "271",
          column1,
          responseDecoded.decoded ?? responseDecoded.original,
        );
      }
    }
  }

  /**
   * Internal method to decode data and track decoding metadata
   *
   * This method wraps the decompressData function and provides additional
   * metadata about the decoding process, including format detection and
   * error tracking.
   *
   * @param data - Raw encoded data string
   * @returns DecodedData object with original, decoded, type, and validation status
   */
  private decompressDataInternal(data: string): DecodedData {
    // Result object with decoding metadata
    const result: DecodedData = {
      original: data,
      type: "unknown",
      isValid: false,
    };

    try {
      // Attempt to decode the data using format detection
      const decoded = decompressData(data);
      result.decoded = decoded;
      result.isValid = true;

      // Determine the original data format for metadata
      if (data.startsWith("0x")) {
        if (data.includes("zip::")) {
          result.type = "compressed";
        } else {
          result.type = "hex";
        }
      } else {
        result.type = "unknown"; // Plain text or unrecognized format
      }
    } catch (error) {
      console.warn("Failed to decode data:", error);
      // Preserve original data even if decoding fails
      result.decoded = data;
    }

    return result;
  }

  /**
   * Creates a ProcessedEDITransaction from decoded data
   *
   * This method transforms raw decoded EDI data into a structured transaction
   * object. It handles XML extraction, segment parsing, and basic validation
   * to create a foundation for further processing.
   *
   * Key Features:
   * - XML content extraction (finds EDI within XML wrappers)
   * - Segment parsing and validation
   * - Basic EDI structure checks (ISA, ST segments)
   * - Error and warning initialization
   */
  private createTransaction(
    type: "270" | "271",
    rawData: string,
    decodedData: string,
  ): ProcessedEDITransaction {
    // Initialize with decoded data
    let ediContent = decodedData;

    // Handle XML-wrapped EDI data (common in some systems)
    if (decodedData.includes("<") && decodedData.includes("xml")) {
      // Extract EDI content from XML wrapper using multiple strategies

      // Strategy 1: Look for EDI content between XML tags
      const ediMatch = decodedData.match(/>([^<]*ISA[^<]*)</);
      const ediMatchResult = ediMatch?.[1];
      if (
        ediMatchResult !== undefined &&
        ediMatchResult !== null &&
        ediMatchResult.length > 0
      ) {
        ediContent = ediMatchResult;
      } else {
        // Strategy 2: Look for CDATA sections containing EDI
        const cdataMatch = decodedData.match(/\[CDATA\[([\s\S]*?)\]\]/);
        const cdataMatchResult = cdataMatch?.[1];
        if (
          cdataMatchResult !== undefined &&
          cdataMatchResult !== null &&
          cdataMatchResult.length > 0
        ) {
          ediContent = cdataMatchResult;
        } else {
          // Strategy 3: Look for complete EDI transaction patterns
          const segmentMatch = decodedData.match(/ISA[\s\S]*?IEA[\s\S]*?~/);
          const segmentMatchResult = segmentMatch?.[0];
          if (
            segmentMatchResult !== undefined &&
            segmentMatchResult !== null &&
            segmentMatchResult.length > 0
          ) {
            ediContent = segmentMatchResult;
          }
        }
      }
    }

    // Parse EDI content into segments for validation and processing
    const segments = ediContent.split("~").filter((s) => s.trim().length > 0);

    // Perform basic EDI structure validation
    // Valid EDI must have ISA (Interchange Control Header) and ST (Transaction Set Header)
    const hasISA =
      segments.length > 0 && segments.some((s) => s.startsWith("ISA"));
    const hasST = segments.some((s) => s.startsWith("ST"));

    // Create and return the transaction object
    return {
      type,
      rawData,
      decodedData: ediContent,
      // Basic validation: must have required segments and minimum length
      isValid: hasISA && hasST && segments.length > 3,
      segments,
      errors: [], // Will be populated by validation processor
      warnings: [], // Will be populated by validation processor
    };
  }
}
