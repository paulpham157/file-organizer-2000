import { jest } from "@jest/globals";

// Mock logger service for testing
export const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

