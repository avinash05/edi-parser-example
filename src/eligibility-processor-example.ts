// Eligibility Processor Example
// Demonstrates using the high-level EligibilityProcessor class
// which orchestrates fetching, parsing, and normalizing eligibility responses

import { Processor, DentalXChangeClient } from "@edi-parser/core";
import * as fs from "fs";
import * as path from "path";

// Extract types and classes from the namespaces
const { EligibilityProcessor } = Processor;
type GetEligibilityRequest = Processor.GetEligibilityRequest;
type GetEligibilityResponse = Processor.GetEligibilityResponse;
type DWSRequest = DentalXChangeClient.DwsEligRequest;

/**
 * Configuration for the DWS Service
 */
const config = {
  wsdlUrl: "https://webservices.dentalxchange.com/dws/DwsService?wsdl",
  credentials: {
    Client: "DxcEnhancedEligibility_dev",
    ServiceID: "eRcHRiTzmANcisC",
    version: "1.0",
  },
  timeout: 30000,
};

/**
 * Interface for the eligibility requests file format
 * Expected format matches the output from csv-extractor
 */
interface EligibilityRequestsFile {
  metadata: {
    generatedAt: string;
    sourceFile: string;
    totalRequests: number;
    validRequests: number;
    summary: {
      totalPairs: number;
      successfulConversions: number;
      conversionRate: string;
    };
  };
  eligibilityRequests: Array<{
    requestId: number;
    rowNumber: number;
    status?: string;
    payerId?: string;
    payerIdCode?: string;
    payerName?: string;
    eligibilityRequest: DWSRequest;
  }>;
}

/**
 * Process and save eligibility response to individual files
 * @param response - The normalized eligibility response from processor
 * @param requestId - Optional request ID for file naming
 * @param subscriberId - Optional subscriber ID for file naming
 * @param request - Optional request object to save alongside response
 */
function processResponse(
  response: GetEligibilityResponse,
  requestId?: number,
  subscriberId?: string,
  request?: GetEligibilityRequest,
): void {
  console.log(`Status: ${response.success ? "success" : "failed"}`);

  // Create output directory if it doesn't exist
  const outputDir = path.join(
    __dirname,
    "eligibility-processor-example",
    "output",
  );
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate filenames preserving requestId
  const requestIdPart =
    requestId !== undefined ? `medicaid-${requestId}` : "response";
  const responseFilename = `${requestIdPart}-normalized.json`;
  const requestFilename = `${requestIdPart}-request.json`;
  const responseFilePath = path.join(outputDir, responseFilename);
  const requestFilePath = path.join(outputDir, requestFilename);

  // Prepare response data to save
  const responseData = {
    timestamp: new Date().toISOString(),
    requestId,
    subscriberId,
    response,
  };

  try {
    // Save response to file
    fs.writeFileSync(
      responseFilePath,
      JSON.stringify(responseData, null, 2),
      "utf-8",
    );
    console.log(
      `💾 Response saved to: ${path.relative(process.cwd(), responseFilePath)}`,
    );

    // Save request to file if provided
    if (request !== undefined) {
      fs.writeFileSync(
        requestFilePath,
        JSON.stringify(request, null, 2),
        "utf-8",
      );
      console.log(
        `💾 Request saved to: ${path.relative(process.cwd(), requestFilePath)}`,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to save files: ${errorMessage}`);
  }
}

/**
 * Extract and save requests to JSON file
 * @param requests - Array of processor requests to save
 * @param outputFileName - Name of the output file
 */
function extractRequestsToFile(
  requests: GetEligibilityRequest[],
  outputFileName: string,
): void {
  const outputDir = path.join(
    __dirname,
    "eligibility-processor-example",
    "output",
  );
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filePath = path.join(outputDir, outputFileName);

  const extractedData = {
    metadata: {
      extractedAt: new Date().toISOString(),
      totalRequests: requests.length,
    },
    requests,
  };

  try {
    fs.writeFileSync(filePath, JSON.stringify(extractedData, null, 2), "utf-8");
    console.log(
      `📤 Extracted ${requests.length} requests to: ${path.relative(process.cwd(), filePath)}`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to extract requests to file: ${errorMessage}`);
  }
}

/**
 * Clean the output directory by removing all files
 */
function cleanOutputDirectory(): void {
  const outputDir = path.join(
    __dirname,
    "eligibility-processor-example",
    "output",
  );
  if (fs.existsSync(outputDir)) {
    const files = fs.readdirSync(outputDir);
    for (const file of files) {
      fs.unlinkSync(path.join(outputDir, file));
    }
    console.log(`🧹 Cleaned output directory: ${files.length} files removed`);
  }
}

/**
 * Convert DWS request format to EligibilityProcessor request format
 * @param dwsRequest - The DWS request from the requests file
 * @param payerIdCode - Override payer ID code from CSV data
 * @returns EligibilityProcessor request
 */
function convertToProcessorRequest(
  dwsRequest: DWSRequest,
  payerIdCode?: string,
): GetEligibilityRequest {
  return {
    serviceConfig: config,
    parsingStrategy: "comprehensive",
    outputFormat: "EDI",
    provider: {
      companyName: dwsRequest.Provider?.CompanyName,
      firstName: dwsRequest.Provider?.FirstName,
      lastName: dwsRequest.Provider?.LastName,
      npi: dwsRequest.Provider?.NPI ?? "",
      taxId: dwsRequest.Provider?.TIN ?? "",
    },
    patient: {
      firstName: dwsRequest.PatientFirstName,
      lastName: dwsRequest.PatientLastName,
      dateOfBirth: formatDateForProcessor(
        dwsRequest.PatientDOB ?? dwsRequest.SubscriberDOB,
      ),
      memberId: dwsRequest.SubscriberID ?? "",
      relationship: mapRelationshipToCode(dwsRequest.Relationship),
    },
    subscriber: {
      firstName: dwsRequest.SubscriberFirstName,
      lastName: dwsRequest.SubscriberLastName,
      dateOfBirth: formatDateForProcessor(
        dwsRequest.SubscriberDOB ?? dwsRequest.PatientDOB,
      ),
      memberId: dwsRequest.SubscriberID ?? "",
      groupNumber: dwsRequest.GroupNumber,
    },
    payer: {
      payerIdCode: payerIdCode ?? dwsRequest.Payer?.Code ?? "",
      name: dwsRequest.Payer?.Name,
    },
  };
}

/**
 * Map DWS relationship string to X12 relationship code
 * @param relationship - DWS relationship string
 * @returns X12 relationship code
 */
function mapRelationshipToCode(
  relationship?: string,
): "01" | "18" | "19" | "34" {
  switch (relationship?.toUpperCase()) {
    case "SELF":
      return "18";
    case "SPOUSE":
      return "01";
    case "CHILD":
      return "19";
    case "OTHER":
    default:
      return "34";
  }
}

/**
 * Format date from ISO string to MM/DD/YYYY format
 * @param dateString - ISO date string or MM/DD/YYYY format or Date object
 * @returns Date in MM/DD/YYYY format
 * @throws Error if date string is undefined or invalid
 */
function formatDateForProcessor(dateString?: string | Date): string {
  if (!dateString) {
    throw new Error("Date is required");
  }

  // If it's a Date object, convert to MM/DD/YYYY
  if (dateString instanceof Date) {
    const month = String(dateString.getMonth() + 1).padStart(2, "0");
    const day = String(dateString.getDate()).padStart(2, "0");
    const year = dateString.getFullYear();
    return `${month}/${day}/${year}`;
  }

  // If already in MM/DD/YYYY format, return as is
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
    return dateString;
  }

  // Parse ISO date string
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateString}`);
  }

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();

  return `${month}/${day}/${year}`;
}

/**
 * Read eligibility requests from a JSON file
 * @param filePath - Path to the JSON file containing eligibility requests
 * @returns Array of eligibility requests
 */
function readRequestsFromFile(filePath: string): EligibilityRequestsFile {
  try {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    const fileContent = fs.readFileSync(absolutePath, "utf-8");
    const requestsData = JSON.parse(fileContent) as EligibilityRequestsFile;

    console.log(
      `📁 Loaded ${requestsData.eligibilityRequests.length} requests from: ${path.basename(filePath)}`,
    );
    console.log(
      `📊 Source: ${requestsData.metadata.sourceFile} | Conversion Rate: ${requestsData.metadata.summary.conversionRate}`,
    );

    return requestsData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read requests from file: ${errorMessage}`);
  }
}

/**
 * Run eligibility requests from a JSON file using EligibilityProcessor
 * @param filePath - Path to the JSON file containing eligibility requests
 * @param options - Processing options
 */
async function runRequestsFromFile(
  filePath: string,
  options?: {
    maxRequests?: number;
    statusFilter?: string;
    cleanOutput?: boolean;
    parsingStrategy?: "comprehensive" | "performance" | "balanced";
    extractRequests?: boolean;
  },
): Promise<void> {
  const {
    maxRequests,
    statusFilter,
    cleanOutput,
    parsingStrategy = "comprehensive",
    extractRequests = false,
  } = options ?? {};

  if (cleanOutput === true) {
    cleanOutputDirectory();
  }

  try {
    const requestsFile = readRequestsFromFile(filePath);

    // Filter by status if provided
    let filteredRequests = requestsFile.eligibilityRequests;
    if (statusFilter != null && statusFilter.length > 0) {
      filteredRequests = requestsFile.eligibilityRequests.filter(
        (req) => req.status === statusFilter,
      );
      console.log(
        `🔍 Filtered to ${filteredRequests.length} requests with status: ${statusFilter}`,
      );
    }

    const requestsToProcess =
      maxRequests !== undefined && maxRequests > 0
        ? filteredRequests.slice(0, maxRequests)
        : filteredRequests;

    // Convert to processor request format
    const processorRequests = requestsToProcess
      .filter((req) => req.eligibilityRequest)
      .map((req) => {
        const processorRequest = convertToProcessorRequest(
          req.eligibilityRequest,
          req.payerIdCode,
        );
        if (parsingStrategy) {
          processorRequest.parsingStrategy = parsingStrategy;
        }
        return processorRequest;
      });

    // Extract requests to file if requested
    if (extractRequests) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const statusPart = statusFilter ? `-${statusFilter}` : "";
      const fileName = `extracted-requests${statusPart}-${timestamp}.json`;
      extractRequestsToFile(processorRequests, fileName);
    }

    console.log(
      `\n🚀 Processing ${requestsToProcess.length} eligibility requests using EligibilityProcessor...\n`,
    );

    for (const [index, requestData] of requestsToProcess.entries()) {
      if (!requestData.eligibilityRequest) {
        console.error(
          `   ❌ Request ${requestData.requestId} failed: No eligibility request data`,
        );
        continue;
      }

      // Get the pre-converted processor request
      const processorRequest = processorRequests[index];

      console.log(
        `\n[${index + 1}/${requestsToProcess.length}] Processing Request ID: ${requestData.requestId}`,
      );
      console.log(`   Status: ${requestData.status ?? "N/A"}`);
      console.log(`   Subscriber ID: ${processorRequest.subscriber.memberId}`);
      console.log(
        `   Payer: ${processorRequest.payer.name ?? "N/A"} (${processorRequest.payer.payerIdCode})`,
      );
      console.log(`   Parsing Strategy: ${processorRequest.parsingStrategy}`);

      try {
        // Create processor instance and run eligibility check
        const processor = new EligibilityProcessor(processorRequest);
        const response = await processor.getEligibility();

        console.log(
          `   ✅ Request ${requestData.requestId} completed successfully`,
        );
        processResponse(
          response,
          requestData.requestId,
          processorRequest.subscriber.memberId,
          processorRequest,
        );
      } catch (error) {
        console.error(
          `   ❌ Request ${requestData.requestId} failed:`,
          error instanceof Error ? error.message : error,
        );
      }

      // Add a small delay between requests to avoid overwhelming the service
      if (index < requestsToProcess.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(
      `\n✨ Completed processing ${requestsToProcess.length} requests from ${path.basename(filePath)}`,
    );
  } catch (error) {
    console.error(
      "Error processing requests from file:",
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Run a single example eligibility request
 */
async function runExample(): Promise<void> {
  const request: GetEligibilityRequest = {
    serviceConfig: config,
    parsingStrategy: "comprehensive",
    outputFormat: "EDI",
    provider: {
      companyName: null,
      firstName: null,
      lastName: null,
      npi: "1659966067",
      taxId: "862401928",
    },
    patient: {
      firstName: null,
      lastName: null,
      dateOfBirth: "10/07/2008",
      memberId: "5300002718135",
      relationship: "18", // SELF
    },
    subscriber: {
      firstName: null,
      lastName: null,
      dateOfBirth: "10/07/2008",
      memberId: "5300002718135",
    },
    payer: {
      payerIdCode: "CKAL1",
      name: "MEDICAID OF ALABAMA",
    },
  };

  try {
    console.log("🔄 Creating EligibilityProcessor and submitting request...");
    console.log(`   Subscriber ID: ${request.subscriber.memberId}`);
    console.log(
      `   Payer: ${request.payer.name} (${request.payer.payerIdCode})`,
    );
    console.log(`   Parsing Strategy: ${request.parsingStrategy}`);

    const processor = new EligibilityProcessor(request);
    const response = await processor.getEligibility();

    console.log(`   ✅ Request completed successfully`);
    processResponse(response, undefined, request.subscriber.memberId, request);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
  }
}

if (require.main === module) {
  // Example usage:

  // To run a single example request:
  // runExample().catch(console.error);

  // To run requests from a file with comprehensive parsing:
  runRequestsFromFile(
    path.join(
      __dirname,
      "csv-extractor-example",
      "output",
      "medicaid-requests.json",
    ),
    {
      maxRequests: 10,
      // statusFilter: "eligResp_72",
      cleanOutput: true,
      parsingStrategy: "comprehensive",
      extractRequests: true,
    },
  ).catch(console.error);

  // To run requests with performance parsing strategy:
  // runRequestsFromFile(
  //   path.join("src", "csv-extractor-example", "output", "medicaid-requests.json"),
  //   {
  //     maxRequests: 10,
  //     parsingStrategy: "performance",
  //   },
  // ).catch(console.error);
}

export { runExample, runRequestsFromFile, readRequestsFromFile };
