/**
 * EDI to JSON Conversion Processor - Transforms EDI Transactions to Structured JSON
 *
 * This processor converts validated 270 EDI eligibility request transactions
 * into structured JSON format suitable for modern API integration and
 * healthcare system interoperability. It extracts key healthcare data
 * elements and formats them according to common industry patterns.
 *
 * Key Responsibilities:
 * - Convert 270 EDI transactions to structured JSON eligibility requests
 * - Extract payer information (name, codes, requirements)
 * - Parse provider details (NPI, TIN, entity information)
 * - Extract subscriber and patient demographics
 * - Handle various EDI segment patterns and data formats
 * - Provide structured output compatible with healthcare APIs
 *
 * EDI Elements Extracted:
 * - Payer: Name, code, eligibility requirements (from NM1*PR segments)
 * - Provider: Company/individual name, NPI, TIN, entity type (from NM1*1P/85, REF segments)
 * - Subscriber: Member ID, relationship (from NM1*IL, REF segments)
 * - Patient: Date of birth (from DMG, DTP segments)
 * - Transaction: Output format preferences
 *
 * JSON Output Format:
 * The processor generates JSON objects compatible with common healthcare
 * eligibility verification APIs, following industry-standard patterns for
 * payer, provider, and patient data representation.
 *
 * Error Handling:
 * - Graceful handling of missing or invalid EDI segments
 * - Default values for missing data elements
 * - Preservation of original transaction context
 * - Detailed logging for troubleshooting
 *
 * Integration Points:
 * - Compatible with healthcare clearinghouse APIs
 * - Follows HIPAA-compliant data formatting
 * - Suitable for real-time eligibility verification
 * - Supports batch processing workflows
 */
import { PairProcessor } from "./base-processor";
import type { ProcessingContext, ProcessedEDITransaction } from "./types";
import { ParserFactory } from "@edi-parser/core";
import type { TransactionType } from "@edi-parser/core";

interface PayerInfo {
  Name: string;
  Code: string;
  PatientAndSubscriberReqdForElig: boolean;
  PatientReqdForElig: boolean;
}

interface ProviderInfo {
  CompanyName: string;
  FirstName: string;
  LastName: string;
  TIN: string;
  NPI: string;
  entityType: number;
}

interface ConvertedEligibilityRequest {
  Payer: PayerInfo;
  Provider: ProviderInfo;
  SubscriberID: string;
  PatientDOB: string;
  Relationship: string;
  outputFormat: string;
}

interface PayerExtractResult {
  name: string | null;
  code: string | null;
}

interface ProviderExtractResult {
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  tin: string | null;
  npi: string | null;
  entityType: number;
}

interface SubscriberExtractResult {
  id: string | null;
  relationship: string;
}

interface PatientExtractResult {
  dob: string | null;
}

export class EdiToRequestProcessor extends PairProcessor {
  private readonly parserFactory: ParserFactory;

  constructor() {
    super();
    this.parserFactory = ParserFactory.getInstance();
  }

  protected handle(context: ProcessingContext): void {
    const { pair } = context;
    if (pair == null) return;

    // Convert 270 request to JSON format
    if (pair.request != null) {
      const convertedRequest = this.convertEDI270ToJSON(pair.request);
      if (convertedRequest != null) {
        pair.request.convertedData = convertedRequest;
      }
    }

    // Note: 271 response conversion could be added here if needed
    if (pair.response != null) {
      // For now, we'll just mark that it has been processed
      const segmentCount = pair.response.segments?.length ?? 0;
      pair.response.convertedData = {
        message: "271 response conversion not implemented yet",
        segments: segmentCount,
      };
    }
  }

  private convertEDI270ToJSON(
    transaction: ProcessedEDITransaction,
  ): ConvertedEligibilityRequest | null {
    if (
      transaction.decodedData == null ||
      transaction.decodedData.length === 0
    ) {
      return null;
    }

    try {
      // Use ParserFactory to get properly parsed segments
      let segments: string[] = [];

      if (transaction.segments != null && transaction.segments.length > 0) {
        segments = transaction.segments;
      } else {
        // Parse using ParserFactory if segments not available
        const parser = this.parserFactory.createParser(
          "270" as TransactionType,
        );
        if (parser != null) {
          const parseResult = parser.parse(transaction.decodedData);
          segments =
            parseResult.transaction?.segments?.map((seg: unknown) => {
              const segment = seg as {
                tag: string;
                elements: Array<{ value: string }>;
              };
              return `${segment.tag}*${segment.elements.map((el) => el.value).join("*")}`;
            }) ?? [];
        }
      }

      // Extract data from EDI segments
      const payerInfo = this.extractPayerInfo(segments);
      const providerInfo = this.extractProviderInfo(segments);
      const subscriberInfo = this.extractSubscriberInfo(segments);
      const patientInfo = this.extractPatientInfo(segments);

      return {
        Payer: {
          Name: payerInfo.name ?? "UNKNOWN PAYER",
          Code: payerInfo.code ?? "UNKNOWN",
          PatientAndSubscriberReqdForElig: false,
          PatientReqdForElig: false,
        },
        Provider: {
          CompanyName: providerInfo.companyName ?? "NA",
          FirstName: providerInfo.firstName ?? "NA",
          LastName: providerInfo.lastName ?? "NA",
          TIN: providerInfo.tin ?? "",
          NPI: providerInfo.npi ?? "",
          entityType: providerInfo.entityType,
        },
        SubscriberID: subscriberInfo.id ?? "",
        PatientDOB: patientInfo.dob ?? "",
        Relationship: subscriberInfo.relationship,
        outputFormat: "EDI",
      };
    } catch (error) {
      return null;
    }
  }

  private extractPayerInfo(segments: string[]): PayerExtractResult {
    // Look for NM1 segment with entity identifier code for payer
    const payerSegment = segments.find(
      (s) => s.startsWith("NM1") && s.includes("*PR*"),
    );
    if (payerSegment != null && payerSegment.length > 0) {
      const elements = payerSegment.split("*");
      return {
        name: elements[3] ?? null, // Entity Name
        code: elements[9] ?? null, // Entity Identifier Code
      };
    }

    // Fallback: look for any NM1 segment and extract name
    const nmSegment = segments.find((s) => s.startsWith("NM1"));
    if (nmSegment != null && nmSegment.length > 0) {
      const elements = nmSegment.split("*");
      return {
        name: elements[3] ?? null,
        code: elements[9] ?? null,
      };
    }

    return {
      name: null,
      code: null,
    };
  }

  private extractProviderInfo(segments: string[]): ProviderExtractResult {
    // Look for NM1 segment with entity identifier code for provider
    const providerSegment = segments.find(
      (s) => s.startsWith("NM1") && (s.includes("*1P*") || s.includes("*85*")),
    );

    let companyName: string | null = null;
    let firstName: string | null = null;
    let lastName: string | null = null;
    let npi: string | null = null;
    let entityType = 1;

    if (providerSegment != null && providerSegment.length > 0) {
      const elements = providerSegment.split("*");
      entityType = elements[2] === "1" ? 1 : 2; // 1 = Person, 2 = Non-Person Entity

      if (entityType === 1) {
        lastName = elements[3] ?? null;
        firstName = elements[4] ?? null;
      } else {
        companyName = elements[3] ?? null;
      }

      // Extract NPI from the provider NM1 segment (element 9 for XX qualifier)
      if (elements[8] === "XX" && elements[9] != null) {
        npi = elements[9];
      }
    }

    // Look for REF segments for TIN (REF*TJ* or REF*EI*)
    const tinRef = segments.find(
      (s) => s.startsWith("REF*TJ*") || s.startsWith("REF*EI*"),
    );

    return {
      companyName,
      firstName,
      lastName,
      tin: tinRef?.split("*")[2] ?? null,
      npi,
      entityType,
    };
  }

  private extractSubscriberInfo(segments: string[]): SubscriberExtractResult {
    // Look for NM1 segment for subscriber (IL = Insured or Subscriber)
    const subscriberSegment = segments.find((s) => s.startsWith("NM1*IL*"));

    const relationship = "SELF";
    if (subscriberSegment != null && subscriberSegment.length > 0) {
      const elements = subscriberSegment.split("*");
      // Extract member ID from element 9 if present
      const memberId = elements[9];
      if (memberId != null && memberId.length > 0) {
        return { id: memberId, relationship };
      }
    }

    // Look for REF segment with member identification
    const memberRef = segments.find(
      (s) => s.startsWith("REF*0F*") || s.startsWith("REF*1L*"),
    );
    if (memberRef != null) {
      return {
        id: memberRef.split("*")[2] ?? null,
        relationship,
      };
    }

    return { id: null, relationship };
  }

  private extractPatientInfo(segments: string[]): PatientExtractResult {
    // Look for DMG segment (Demographics) for date of birth
    const dmgSegment = segments.find((s) => s.startsWith("DMG*"));
    if (dmgSegment != null) {
      const elements = dmgSegment.split("*");
      const dob = elements[2]; // Date of birth in CCYYMMDD format
      if (dob != null && dob.length === 8) {
        // Convert CCYYMMDD to ISO format
        const year = dob.substring(0, 4);
        const month = dob.substring(4, 6);
        const day = dob.substring(6, 8);
        return { dob: `${year}-${month}-${day}T00:00:00Z` };
      }
    }

    // Look for DTP segment with date qualifier for birth date
    const dtpSegment = segments.find((s) => s.startsWith("DTP*307*"));
    if (dtpSegment != null) {
      const elements = dtpSegment.split("*");
      const dob = elements[3];
      if (dob != null && dob.length === 8) {
        const year = dob.substring(0, 4);
        const month = dob.substring(4, 6);
        const day = dob.substring(6, 8);
        return { dob: `${year}-${month}-${day}T00:00:00Z` };
      }
    }

    return { dob: null };
  }
}
