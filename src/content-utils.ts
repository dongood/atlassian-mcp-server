/**
 * Utilities for handling large content in MCP responses
 */

// Maximum tokens allowed in a response (conservative limit below Claude Code's 25000)
export const MAX_RESPONSE_TOKENS = 20000;

// Approximate characters per token (conservative estimate)
const CHARS_PER_TOKEN = 4;

/**
 * Estimate the number of tokens in a string
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate the maximum character length for a given token limit
 */
export function tokensToChars(tokens: number): number {
  return tokens * CHARS_PER_TOKEN;
}

export interface TruncationResult {
  content: string;
  truncated: boolean;
  totalTokens: number;
  returnedTokens: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Truncate content to fit within token limits, with pagination support
 * @param content The content to potentially truncate
 * @param offset Character offset to start from (default: 0)
 * @param limit Maximum tokens to return (default: MAX_RESPONSE_TOKENS)
 * @returns Truncation result with metadata
 */
export function truncateContent(
  content: string,
  offset: number = 0,
  limit: number = MAX_RESPONSE_TOKENS
): TruncationResult {
  const totalTokens = estimateTokens(content);
  const maxChars = tokensToChars(limit);

  // Apply offset
  const contentFromOffset = content.slice(offset);
  const contentTokensFromOffset = estimateTokens(contentFromOffset);

  // Check if we need to truncate
  if (contentTokensFromOffset <= limit) {
    return {
      content: contentFromOffset,
      truncated: offset > 0,
      totalTokens,
      returnedTokens: contentTokensFromOffset,
      offset,
      limit,
      hasMore: false,
    };
  }

  // Truncate to fit within limit
  const truncatedContent = contentFromOffset.slice(0, maxChars);
  const returnedTokens = estimateTokens(truncatedContent);

  return {
    content: truncatedContent,
    truncated: true,
    totalTokens,
    returnedTokens,
    offset,
    limit,
    hasMore: offset + maxChars < content.length,
  };
}

/**
 * Format a truncated response with metadata for the user
 */
export function formatTruncatedResponse(
  data: unknown,
  truncation: TruncationResult
): string {
  const result: {
    _truncation?: {
      message: string;
      totalTokens: number;
      returnedTokens: number;
      offset: number;
      limit: number;
      hasMore: boolean;
      nextOffset?: number;
    };
    data: unknown;
  } = {
    data,
  };

  if (truncation.truncated || truncation.hasMore) {
    result._truncation = {
      message: truncation.hasMore
        ? `Content truncated. Use offset=${truncation.offset + tokensToChars(truncation.limit)} to get the next portion.`
        : "Content was paginated from the specified offset.",
      totalTokens: truncation.totalTokens,
      returnedTokens: truncation.returnedTokens,
      offset: truncation.offset,
      limit: truncation.limit,
      hasMore: truncation.hasMore,
    };

    if (truncation.hasMore) {
      result._truncation.nextOffset = truncation.offset + tokensToChars(truncation.limit);
    }
  }

  return JSON.stringify(result, null, 2);
}

/**
 * Check if serialized JSON exceeds token limit and truncate if needed
 * Returns the JSON string, potentially with truncation metadata
 */
export function safeJsonStringify(
  data: unknown,
  offset: number = 0,
  limit: number = MAX_RESPONSE_TOKENS
): string {
  const fullJson = JSON.stringify(data, null, 2);
  const truncation = truncateContent(fullJson, offset, limit);

  if (!truncation.truncated && !truncation.hasMore) {
    return fullJson;
  }

  // If truncated, wrap the truncated content with metadata
  return JSON.stringify({
    _truncation: {
      message: truncation.hasMore
        ? `Response truncated (${truncation.totalTokens} tokens total, returning ${truncation.returnedTokens}). Use offset=${truncation.offset + tokensToChars(truncation.limit)} to get more.`
        : `Response paginated from offset ${truncation.offset}.`,
      totalTokens: truncation.totalTokens,
      returnedTokens: truncation.returnedTokens,
      offset: truncation.offset,
      limit: truncation.limit,
      hasMore: truncation.hasMore,
      nextOffset: truncation.hasMore ? truncation.offset + tokensToChars(truncation.limit) : undefined,
    },
    content: truncation.content,
  }, null, 2);
}
