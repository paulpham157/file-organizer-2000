// Mock tiktoken init for testing

let mockEncoding: unknown = null;

export function init(instantiateFn: unknown): Promise<void> {
  return Promise.resolve().then(() => {
    mockEncoding = {
      encode: (text: string) => {
        // Simple mock: approximate token count (roughly 1 token per 4 characters)
        return Array.from({ length: Math.ceil(text.length / 4) }, (_, index) => index);
      },
      free: () => {
        mockEncoding = null;
      },
    };
  });
}

export function get_encoding(name: string): unknown {
  if (!mockEncoding) {
    throw new Error('Encoding not initialized');
  }
  return mockEncoding;
}

