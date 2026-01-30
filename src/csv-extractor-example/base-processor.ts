/**
 * Abstract Base Processor for Chain of Responsibility Pattern
 *
 * This module implements the foundation for a chain of responsibility design pattern
 * used to process EDI data through multiple sequential stages. Each processor in the
 * chain handles a specific aspect of the data transformation pipeline.
 */
import type { ProcessingContext } from "./types";

/**
 * Abstract base class for all processors in the EDI processing chain
 *
 * This class provides the foundation for implementing the Chain of Responsibility
 * pattern. Each concrete processor must implement the `handle` method to perform
 * its specific processing logic.
 */
export abstract class PairProcessor {
  protected nextProcessor: PairProcessor | null = null;

  /**
   * Sets the next processor in the chain and returns it for method chaining
   */
  public setNext(processor: PairProcessor): PairProcessor {
    this.nextProcessor = processor;
    return processor;
  }

  /**
   * Processes the context through this processor and forwards to the next processor
   *
   * This method implements the core Chain of Responsibility behavior:
   * 1. Calls the concrete processor's handle method
   * 2. Automatically forwards the context to the next processor in the chain
   * 3. Handles async processing through the entire chain
   */
  public async process(context: ProcessingContext): Promise<void> {
    this.handle(context);

    if (this.nextProcessor) {
      await this.nextProcessor.process(context);
    }
  }

  /**
   * Abstract method that concrete processors must implement
   *
   * This method contains the specific processing logic for each processor.
   * It receives the processing context and can:
   * - Read data from the context
   * - Modify existing data in the context
   * - Add new data to the context
   * - Perform validation or transformation operations
   */
  protected abstract handle(context: ProcessingContext): void;
}
