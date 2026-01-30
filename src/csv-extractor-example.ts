/**
 * CSV Extractor Example using modular Chain of Responsibility Pattern
 *
 * Demonstrates how to extract and process CSV files containing encoded EDI data.
 * Produces a single JSON file with 270-271 pairs per CSV row using Chain of Responsibility.
 */

import * as fs from "fs";
import * as path from "path";
import type { ProcessingContext } from "./csv-extractor-example/types";
import { ProcessingChainBuilder } from "./csv-extractor-example/chain-builder";
/**
 * Main CSV Processor orchestrator
 */
class CSVProcessor {
  constructor(private readonly inputDir: string) {}

  public async process(outputDir?: string): Promise<void> {
    // Scan input directory for CSV files
    const csvFiles = this.findCSVFiles(this.inputDir);

    if (csvFiles.length === 0) {
      console.log(`No CSV files found in: ${this.inputDir}`);
      return;
    }

    console.log(`Found ${csvFiles.length} CSV file(s) to process:`);
    csvFiles.forEach((file) => console.log(`  - ${path.basename(file)}`));

    const finalOutputDir =
      outputDir ?? path.join(__dirname, "csv-extractor-example", "output");

    // Process each CSV file
    for (const csvFilePath of csvFiles) {
      console.log(`\n=== Processing: ${path.basename(csvFilePath)} ===`);

      const context: ProcessingContext = {
        csvFilePath,
        outputDir: finalOutputDir,
      };

      try {
        const builder = new ProcessingChainBuilder();
        const processingChain = builder.buildProcessingChain();

        await processingChain.process(context);
        console.log(`✅ Successfully processed: ${path.basename(csvFilePath)}`);
      } catch (error) {
        console.error(
          `❌ Failed to process ${path.basename(csvFilePath)}:`,
          error,
        );
      }
    }

    console.log(
      `\n🎉 Batch processing completed! Processed ${csvFiles.length} CSV file(s).`,
    );
  }

  private findCSVFiles(directory: string): string[] {
    if (!fs.existsSync(directory)) {
      return [];
    }

    const files = fs.readdirSync(directory);
    return files
      .filter((file) => path.extname(file).toLowerCase() === ".csv")
      .map((file) => path.join(directory, file))
      .sort(); // Sort for consistent processing order
  }
}

// Example usage
async function runExample(): Promise<void> {
  try {
    const inputDir = path.join(__dirname, "csv-extractor-example", "input");

    if (!fs.existsSync(inputDir)) {
      console.log(`Input directory not found at: ${inputDir}`);
      return;
    }

    const processor = new CSVProcessor(inputDir);
    const outputDir = path.join(__dirname, "csv-extractor-example", "output");

    await processor.process(outputDir);
  } catch (error) {
    console.error("Processing failed:", error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runExample();
}
