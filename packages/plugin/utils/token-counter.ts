import { init, get_encoding } from "tiktoken/init";
import wasmBinary from "tiktoken/tiktoken_bg.wasm";

interface TiktokenEncoding {
  encode(text: string): { length: number };
  free(): void;
}

let encoding: TiktokenEncoding | null = null;
let initPromise: Promise<void> | null = null;

export function initializeTokenCounter() {
  // Return existing promise if initialization is in progress
  if (initPromise !== null) return initPromise;
  
  // Create new initialization promise
  initPromise = init((imports) => {
    return WebAssembly.instantiate(wasmBinary, imports);
  })
    .then(() => {
      encoding = get_encoding("cl100k_base");
    })
    .catch((error) => {
      console.error("Error initializing tiktoken:", error);
      initPromise = null;
      throw error;
    });

  return initPromise;
}

export function getTokenCount(text: string): number {
  if (!encoding) {
    throw new Error("Token counter not initialized. Call initializeTokenCounter() first.");
  }
  return encoding.encode(text).length;
}

export function cleanup() {
  if (encoding) {
    encoding.free();
    encoding = null;
    initPromise = null;
  }
} 