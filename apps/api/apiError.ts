import { PolicyBlockedError } from "./policy";
import { StaleAdventureRevisionError } from "./adventureRevision";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly cause?: unknown,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof PolicyBlockedError) return new ApiError(422, "policy_blocked", error.message, error);
  if (error instanceof StaleAdventureRevisionError) return new ApiError(409, error.code, error.message, error);
  if (error instanceof SyntaxError) return new ApiError(400, "invalid_json", "Request body contains invalid JSON.", error);
  if (error instanceof URIError) return new ApiError(400, "malformed_url", "Request URL contains invalid percent encoding.", error);
  const message = error instanceof Error ? error.message : String(error);
  if (message.endsWith("not found.")) return new ApiError(404, "not_found", message, error);
  if (message.startsWith("Network error") && /timeout|timed out|abort/i.test(message)) {
    return new ApiError(504, "provider_timeout", "The model provider did not respond in time.", error);
  }
  if (message.startsWith("Provider error") || message.startsWith("Provider returned") || message.startsWith("Network error")) {
    return new ApiError(502, "provider_failure", "The model provider could not complete the request.", error);
  }
  if (safeValidationMessage(message)) return new ApiError(400, "invalid_request", message, error);
  return new ApiError(500, "internal_error", "The server could not complete the request.", error);
}

function safeValidationMessage(message: string): boolean {
  return [
    "Enter ", "Invite ", "Invalid ", "Token ", "Google ", "OAuth ", "Password ", "Verification ", "Verify ",
    "Account ", "Adventure ", "Scenario ", "Profile ", "User ", "Safety ", "Sharing ",
    "Personal model ", "Unsupported import", "This backup import", "Backend provider API key",
    "GitHub save JSON", "Scenario publishing", "Transactional email",
  ].some((prefix) => message.startsWith(prefix));
}
