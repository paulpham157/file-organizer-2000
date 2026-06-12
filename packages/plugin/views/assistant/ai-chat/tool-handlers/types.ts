import { App } from "obsidian";

export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
}

export interface ToolHandlerProps {
  toolInvocation: ToolInvocation;
  handleAddResult: (result: string) => void;
  app: App;
}

/** Tool args from the AI stream are untyped at the boundary; handlers narrow them. */
export function getToolArgs<T>(args: Record<string, unknown>): T {
  return args as unknown as T;
}