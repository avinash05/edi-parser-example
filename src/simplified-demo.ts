/**
 * Simplified EDI Parser Strategies Demonstration
 *
 * This example demonstrates how to use the EDI parser with real files.
 * It focuses on parsing and basic validation without complex statistics.
 */

import * as fs from "fs";
import * as path from "path";

/**
 * Parse statistics interface for tracking basic metrics
 */
interface ParseStatistics {
  readonly filename: string;
  readonly parseTime: number;
  readonly fileSize: number;
  readonly segmentCount: number;
  readonly isValid: boolean;
  readonly errorCount: number;
  readonly errors: readonly string[];
}

/**
 * Simplified EDI Parser Demo Class
 */
class SimplifiedEDIDemo {
  private readonly ediFilesDir: string;

  constructor(ediFilesDir?: string) {
    this.ediFilesDir = ediFilesDir ?? path.join(__dirname, "edi-files");
  }

  /**
   * Read all EDI files from the edi-files directory and its subdirectories
   */
  public readEdiFiles(): ReadonlyArray<{ filename: string; content: string }> {
    const ediFiles: Array<{ filename: string; content: string }> = [];

    const readEdiFilesRecursive = (
      dirPath: string,
      relativePath = "",
    ): void => {
      try {
        const files = fs.readdirSync(dirPath);

        for (const filename of files) {
          const filePath = path.join(dirPath, filename);
          const stat = fs.statSync(filePath);

          if (stat.isDirectory()) {
            const subRelativePath = relativePath
              ? path.join(relativePath, filename)
              : filename;
            readEdiFilesRecursive(filePath, subRelativePath);
          } else if (stat.isFile() && filename.toLowerCase().endsWith(".edi")) {
            const displayName = relativePath
              ? path.join(relativePath, filename)
              : filename;
            const content = fs.readFileSync(filePath, "utf8");
            ediFiles.push({ filename: displayName, content });
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error);
      }
    };

    try {
      if (!fs.existsSync(this.ediFilesDir)) {
        console.log(`EDI directory not found: ${this.ediFilesDir}`);
        return ediFiles;
      }

      readEdiFilesRecursive(this.ediFilesDir);
      console.log(
        `Found ${ediFiles.length} EDI files in directory and subdirectories`,
      );
      return ediFiles;
    } catch (error) {
      console.error("Error reading EDI files:", error);
      return ediFiles;
    }
  }

  /**
   * Extract basic statistics from EDI content
   */
  private extractBasicStats(content: string): {
    segmentCount: number;
    fileSize: number;
  } {
    const segments = content.split("~").filter((s) => s.trim().length > 0);
    return {
      segmentCount: segments.length,
      fileSize: Buffer.byteLength(content, "utf8"),
    };
  }

  /**
   * Simulate parsing a single EDI file and collect basic statistics
   */
  private parseEdiFile(filename: string, content: string): ParseStatistics {
    const basicStats = this.extractBasicStats(content);

    try {
      const parseStartTime = performance.now();

      // Basic validation - check for required segments
      const hasISA = content.includes("ISA*");
      const hasST = content.includes("ST*271*");
      const hasIEA = content.includes("IEA*");
      const hasSE = content.includes("SE*");

      const parseEndTime = performance.now();

      const isValid = hasISA && hasST && hasIEA && hasSE;
      const errors: string[] = [];

      if (!hasISA) errors.push("Missing ISA segment");
      if (!hasST) errors.push("Missing ST segment for 271 transaction");
      if (!hasIEA) errors.push("Missing IEA segment");
      if (!hasSE) errors.push("Missing SE segment");

      return {
        filename,
        parseTime: parseEndTime - parseStartTime,
        fileSize: basicStats.fileSize,
        segmentCount: basicStats.segmentCount,
        isValid,
        errorCount: errors.length,
        errors,
      };
    } catch (fileError) {
      const errorMsg =
        fileError instanceof Error ? fileError.message : String(fileError);
      return {
        filename,
        parseTime: 0,
        fileSize: basicStats.fileSize,
        segmentCount: basicStats.segmentCount,
        isValid: false,
        errorCount: 1,
        errors: [errorMsg],
      };
    }
  }

  /**
   * Format file size in human-readable format
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Format parse time with appropriate unit
   */
  private formatTime(ms: number): string {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  /**
   * Demonstration of basic parsing with simple statistics
   */
  public demonstrateBasicParsing(): void {
    const ediFiles = this.readEdiFiles();

    if (ediFiles.length === 0) {
      console.log("No EDI files found to process");
      return;
    }

    console.log("Starting basic parsing analysis...\n");

    const allStats: ParseStatistics[] = [];

    try {
      for (const { filename, content } of ediFiles) {
        const stats = this.parseEdiFile(filename, content);
        allStats.push(stats);
      }

      this.displaySummaryStatistics(allStats);
    } catch (error) {
      console.error("Parser error:", error);
    }
  }

  /**
   * Display summary statistics
   */
  private displaySummaryStatistics(allStats: readonly ParseStatistics[]): void {
    if (allStats.length === 0) return;

    console.log("\n📊 BASIC PARSING SUMMARY");
    console.log("═".repeat(50));

    const totalFiles = allStats.length;
    const successfulFiles = allStats.filter((s) => s.isValid).length;
    const totalSize = allStats.reduce((sum, s) => sum + s.fileSize, 0);
    const totalSegments = allStats.reduce((sum, s) => sum + s.segmentCount, 0);
    const totalParseTime = allStats.reduce((sum, s) => sum + s.parseTime, 0);
    const totalErrors = allStats.reduce((sum, s) => sum + s.errorCount, 0);

    const summaryData: Record<string, string | number> = {
      "Files Processed": totalFiles,
      "Successfully Parsed": `${successfulFiles} (${((successfulFiles / totalFiles) * 100).toFixed(1)}%)`,
      "Total Data Size": this.formatFileSize(totalSize),
      "Total Segments": totalSegments,
      "Total Parse Time": this.formatTime(totalParseTime),
      "Total Errors": totalErrors,
    };

    console.table(summaryData);

    console.log("\n📄 File Breakdown:");
    const fileBreakdown = allStats.map((stat) => ({
      File: stat.filename,
      Valid: stat.isValid ? "✅" : "❌",
      Size: this.formatFileSize(stat.fileSize),
      Segments: stat.segmentCount,
      "Parse Time": this.formatTime(stat.parseTime),
      Errors: stat.errorCount,
    }));
    console.table(fileBreakdown);

    if (totalErrors > 0) {
      console.log("\n🚨 Error Details:");
      const errorDetails: Array<{ File: string; Error: string }> = [];
      for (const stat of allStats) {
        if (stat.errorCount > 0) {
          for (const error of stat.errors) {
            errorDetails.push({
              File: stat.filename,
              Error: error,
            });
          }
        }
      }
      console.table(errorDetails);
    }
  }

  /**
   * Run the basic parser demonstration
   */
  public run(): void {
    try {
      this.demonstrateBasicParsing();
      console.log("\n✅ Demo completed successfully!");
    } catch (error) {
      console.error("❌ Demo failed:", error);
    }
  }
}

/**
 * Main demonstration function
 */
function main(): void {
  console.log("🚀 Starting Simplified EDI Parser Demo");
  console.log(
    "This demo analyzes EDI files without requiring complex parser imports\n",
  );

  const demo = new SimplifiedEDIDemo();
  demo.run();
}

// Run the demonstration
if (require.main === module) {
  main();
}

export { SimplifiedEDIDemo, main as runSimplifiedDemo };
export type { ParseStatistics };
