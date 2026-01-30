// Simple DWS Client Example
import { DentalXChangeClient } from "@edi-parser/core";
import * as fs from "fs";
import * as path from "path";

// Extract types from the namespace
type GetEligibilityRequest = DentalXChangeClient.GetEligibilityRequest;
type GetEligibilityResponse = DentalXChangeClient.GetEligibilityResponse;

/**
 * Configuration for the DWS Service
 */
const config = {
  wsdlUrl: "https://webservices.dentalxchange.com/dws/DwsService?wsdl",
  credentials: {
    Client: "DxcAPI",
    ServiceID: "T7afqP5GNjK7yjq",
    Username: "julia",
    Password: "GcGnpMZCq6$i5AA",
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
    status?: string; // Status from CSV 3rd column
    payerId?: string; // PayerId from CSV 4th column
    payerIdCode?: string; // PayerIdCode from CSV 5th column
    payerName?: string; // PayerName from CSV 6th column
    eligibilityRequest: GetEligibilityRequest["request"];
  }>;
}

async function createClient(): Promise<DentalXChangeClient.DWSClient> {
  const client = DentalXChangeClient.DWSClient.create(config);
  await client.initialize();
  console.log("✅ Client initialized");
  return client;
}

/**
 * Process and save eligibility response to individual files
 * @param response - The eligibility response from DWS
 * @param requestId - Optional request ID for file naming
 * @param subscriberId - Optional subscriber ID for file naming
 */
function processResponse(
  response: GetEligibilityResponse,
  requestId?: number,
  subscriberId?: string,
): void {
  const status = response.return?.Status;
  const content = response.return?.Content;

  console.log(
    `Status: ${status?.code ?? "unknown"} - ${status?.description ?? "no description"}`,
  );

  // Create output directory if it doesn't exist
  const outputDir = path.join(__dirname, "dws-client-example", "output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate filename with timestamp and subscriber ID
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const subscriberPart =
    subscriberId != null && subscriberId.length > 0
      ? subscriberId.replace(/[^a-zA-Z0-9]/g, "")
      : "unknown";
  const filename = `${subscriberPart}-${timestamp}.json`;
  const filePath = path.join(outputDir, filename);

  // Prepare response data to save
  const responseData = {
    timestamp: new Date().toISOString(),
    requestId,
    subscriberId,
    status: {
      code: status?.code,
      description: status?.description,
    },
    content,
    fullResponse: response,
  };

  try {
    // Save response to file
    fs.writeFileSync(filePath, JSON.stringify(responseData, null, 2), "utf-8");
    console.log(
      `💾 Response saved to: ${path.relative(process.cwd(), filePath)}`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to save response to file: ${errorMessage}`);
  }
}

/**
 * Clean the output directory by removing all files
 */
function cleanOutputDirectory(): void {
  const outputDir = path.join(__dirname, "dws-client-example", "output");
  if (fs.existsSync(outputDir)) {
    const files = fs.readdirSync(outputDir);
    for (const file of files) {
      fs.unlinkSync(path.join(outputDir, file));
    }
    console.log(`🧹 Cleaned output directory: ${files.length} files removed`);
  }
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
 * Run eligibility requests from a JSON file
 * @param filePath - Path to the JSON file containing eligibility requests
 * @param options - Processing options
 * @param options.maxRequests - Maximum number of requests to process (optional)
 * @param options.statusFilter - Filter requests by status (optional)
 * @param options.cleanOutput - Clean output directory before processing (optional)
 */
async function runRequestsFromFile(
  filePath: string,
  options?: {
    maxRequests?: number;
    statusFilter?: string;
    cleanOutput?: boolean;
  },
): Promise<void> {
  const { maxRequests, statusFilter, cleanOutput } = options ?? {};

  if (cleanOutput === true) {
    cleanOutputDirectory();
  }

  const client = await createClient();

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

    console.log(
      `\n🚀 Processing ${requestsToProcess.length} eligibility requests...\n`,
    );

    for (const [index, requestData] of requestsToProcess.entries()) {
      if (!requestData.eligibilityRequest) {
        console.error(
          `   ❌ Request ${requestData.requestId} failed: No eligibility request data`,
        );
        continue;
      }

      const request: GetEligibilityRequest = {
        credentials: config.credentials,
        request: {
          ...requestData.eligibilityRequest,
          Payer: {
            ...requestData.eligibilityRequest.Payer,
            Code:
              requestData.payerIdCode ??
              requestData.eligibilityRequest.Payer?.Code ??
              "", // Use payerIdCode from CSV data, fallback to original or empty string
          },
        },
      };

      console.log(
        `\n[${index + 1}/${requestsToProcess.length}] Processing Request ID: ${requestData.requestId}`,
      );
      console.log(`   Status: ${requestData.status ?? "N/A"}`);
      console.log(
        `   Subscriber ID: ${request.request?.SubscriberID ?? "N/A"}`,
      );
      console.log(
        `   Payer: ${request.request?.Payer?.Name ?? "N/A"} (${request.request?.Payer?.Code ?? "N/A"})`,
      );

      try {
        const response = await client.getEligibility(request);
        console.log(
          `   ✅ Request ${requestData.requestId} completed successfully`,
        );
        processResponse(
          response,
          requestData.requestId,
          request.request?.SubscriberID,
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
  } finally {
    client.close();
  }
}

/**
 * Get unique status values from a requests file
 * @param filePath - Path to the JSON file containing eligibility requests
 * @returns Array of unique status values
 */
function getStatusValues(filePath: string): string[] {
  try {
    const requestsFile = readRequestsFromFile(filePath);
    const statusValues = new Set<string>();

    requestsFile.eligibilityRequests.forEach((req) => {
      if (req.status != null && req.status.length > 0) {
        statusValues.add(req.status);
      }
    });

    const uniqueStatuses = Array.from(statusValues).sort();
    console.log(
      `📊 Found ${uniqueStatuses.length} unique status values: ${uniqueStatuses.join(", ")}`,
    );

    return uniqueStatuses;
  } catch (error) {
    console.error(
      "Error reading status values:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

async function runExample(): Promise<void> {
  const client = await createClient();

  const request: GetEligibilityRequest = {
    credentials: {
      Client: "DxcAPI",
      ServiceID: "T7afqP5GNjK7yjq",
      Username: "julia",
      Password: "GcGnpMZCq6$i5AA",
      version: "1.0",
    },
    request: {
      Payer: {
        Name: "MEDICAID OF ALABAMA",
        Code: "CKAL1",
        PatientAndSubscriberReqdForElig: false,
        PatientReqdForElig: false,
      },
      Provider: {
        CompanyName: "NA",
        FirstName: "NA",
        LastName: "NA",
        TIN: "862401928",
        NPI: "1659966067",
        entityType: 1,
      },
      SubscriberID: "5300002718135",
      PatientDOB: "2008-10-07T00:00:00Z",
      Relationship: "SELF",
      outputFormat: "EDI",
    },
  };

  try {
    console.log("🔄 Submitting eligibility request...");
    const response = await client.getEligibility(request);
    processResponse(response, undefined, request.request?.SubscriberID);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
  } finally {
    client.close();
  }
}

if (require.main === module) {
  // Example usage:
  // To run a single example request:
  // runExample().catch(console.error);

  // To run requests from a file filtered by status:
  runRequestsFromFile(
    path.join(
      __dirname,
      "csv-extractor-example",
      "output",
      "medicaid-requests.json",
    ),
    {
      maxRequests: 3,
      statusFilter: "Active",
      cleanOutput: true,
    },
  ).catch(console.error);

  // runRequestsFromFile(
  //   path.join("src", "csv-extractor-example", "output", "medicaid-requests.json"),
  //   { maxRequests: 5 },
  // ).catch(console.error);
}

export {
  runExample,
  runRequestsFromFile,
  readRequestsFromFile,
  getStatusValues,
};
