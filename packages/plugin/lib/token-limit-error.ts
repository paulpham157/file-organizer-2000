export type TokenLimitError = {
  status: number;
  message?: string;
};

export function isTokenLimitError(error: unknown): error is TokenLimitError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as TokenLimitError).status === 429
  );
}

export function getTokenLimitErrorMessage(error: TokenLimitError): string {
  return (
    error.message ??
    "Token limit exceeded. Please upgrade your plan for more tokens."
  );
}
