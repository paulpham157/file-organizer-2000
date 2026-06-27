import { JSONValue, Message, ToolInvocation, UIMessage } from "ai";
import { UseChatOptions } from "@ai-sdk/react";
import { DataChunk } from "./grounding";

export interface ChatRequestBody {
  messages: Message[];
  currentDatetime: string;
  newUnifiedContext: string;
  model: string;
  requestedMaxSteps?: number;
  enableChatWebSearch?: boolean;
}

export interface LocalChatFetchBody {
  messages: Message[];
  newUnifiedContext: string;
  currentDatetime: string;
}

export interface YouTubeVideoSummary {
  id: string;
  title: string;
  transcript?: string;
  videoId: string;
}

export interface ResolvedToolInvocation {
  toolCallId: string;
  toolName?: string;
  args?: unknown;
  result?: unknown;
  state?: string;
}

interface ToolInvocationPart {
  type: "tool-invocation";
  toolInvocation: ToolInvocation;
  state?: string;
}

interface ToolCallPart {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args?: unknown;
  input?: unknown;
}

interface ToolResultPart {
  type: "tool-result";
  toolCallId: string;
  result?: unknown;
  output?: unknown;
}

type ExtendedMessagePart =
  | ToolInvocationPart
  | ToolCallPart
  | ToolResultPart
  | { type: string };

type MessageWithParts = Message & {
  parts?: ExtendedMessagePart[];
};

type LegacyToolInvocations = {
  toolInvocations?: ToolInvocation[];
};

function getToolField(
  tool: ToolInvocation,
  field: "args" | "result"
): unknown {
  if (!(field in tool)) {
    return undefined;
  }
  return (tool as Record<"args" | "result", unknown>)[field];
}

function isToolInvocationPart(
  part: ExtendedMessagePart
): part is ToolInvocationPart {
  if (part.type !== "tool-invocation" || !("toolInvocation" in part)) {
    return false;
  }
  return typeof part.toolInvocation.toolCallId === "string";
}


export function normalizeMessagesForRequest(messages: UIMessage[]): Message[] {
  return messages.map(message => {
    if (message.role !== "assistant" || !Array.isArray(message.parts)) {
      return message;
    }

    const partsToolInvocations = message.parts
      .filter(isToolInvocationPart)
      .map(part => part.toolInvocation);

    if (partsToolInvocations.length === 0) {
      return message;
    }

    return { ...message, toolInvocations: partsToolInvocations };
  });
}

export function getMessageToolSummary(message: UIMessage): {
  role: UIMessage["role"];
  toolInvocations: number;
  toolParts: number;
  hasResults: number;
} {
  const toolParts = Array.isArray(message.parts)
    ? message.parts.filter(part => part.type === "tool-invocation").length
    : 0;
  const invocations = extractToolInvocationsFromMessage(message);

  return {
    role: message.role,
    toolInvocations: invocations.length,
    toolParts,
    hasResults: invocations.filter(tool => tool.result != null).length,
  };
}

export function extractToolInvocationsFromMessage(
  message: Message
): ResolvedToolInvocation[] {
  const messageWithParts = message as MessageWithParts;
  const invocations: ResolvedToolInvocation[] = [];

  if (Array.isArray(messageWithParts.parts)) {
    for (const part of messageWithParts.parts) {
      if (isToolInvocationPart(part)) {
        invocations.push({
          toolCallId: part.toolInvocation.toolCallId,
          toolName: part.toolInvocation.toolName,
          args: getToolField(part.toolInvocation, "args"),
          result: getToolField(part.toolInvocation, "result"),
          state:
            part.state ??
            ("state" in part.toolInvocation
              ? part.toolInvocation.state
              : undefined) ??
            "call",
        });
        continue;
      }

      if (part.type === "tool-call") {
        const toolCallPart = part as ToolCallPart;
        invocations.push({
          toolCallId: toolCallPart.toolCallId,
          toolName: toolCallPart.toolName,
          args: toolCallPart.args ?? toolCallPart.input,
          state: "call",
        });
        continue;
      }

      if (part.type === "tool-result") {
        const toolResultPart = part as ToolResultPart;
        const existing = invocations.find(
          invocation => invocation.toolCallId === toolResultPart.toolCallId
        );
        if (existing) {
          existing.result = toolResultPart.result ?? toolResultPart.output;
          existing.state = "result";
        }
      }
    }
  }

  if (invocations.length === 0) {
    const legacyInvocations = (messageWithParts as LegacyToolInvocations)
      .toolInvocations;
    if (legacyInvocations && legacyInvocations.length > 0) {
      return legacyInvocations.map((tool): ResolvedToolInvocation => ({
        toolCallId: tool.toolCallId,
        toolName: tool.toolName,
        args: getToolField(tool, "args"),
        result: getToolField(tool, "result"),
        state: tool.state,
      }));
    }
  }

  return invocations.filter(
    invocation =>
      invocation.toolCallId.trim() !== ""
  );
}

/** Hide in-progress assistant text until the stream finishes (avoids draft-then-revise flash). */
export function shouldDeferAssistantContent(params: {
  message: Message;
  toolInvocations: ResolvedToolInvocation[];
  isLastMessage: boolean;
  isGenerating: boolean;
}): boolean {
  const { message, toolInvocations, isLastMessage, isGenerating } = params;
  if (message.role !== "assistant" || !isLastMessage || !isGenerating) {
    return false;
  }

  if (toolInvocations.length > 0) {
    const hasCompletedTools = toolInvocations.some(
      tool => tool.result != null || tool.state === "result"
    );
    if (hasCompletedTools) return true;

    const hasPendingTools = toolInvocations.some(
      tool => tool.result == null && tool.state !== "result"
    );
    if (hasPendingTools && message.content.length > 0) return true;
  }

  // Web search runs server-side without client tool parts — wait for the final answer.
  return true;
}

export function toToolInvocation(
  invocation: ResolvedToolInvocation
): ToolInvocation {
  if (invocation.result != null || invocation.state === "result") {
    return {
      state: "result",
      toolCallId: invocation.toolCallId,
      toolName: invocation.toolName ?? "",
      args: invocation.args,
      result: invocation.result,
    } as ToolInvocation;
  }

  return {
    state: "call",
    toolCallId: invocation.toolCallId,
    toolName: invocation.toolName ?? "",
    args: invocation.args,
  } as ToolInvocation;
}

export type NoteCompanionUseChatOptions = UseChatOptions & {
  onDataChunk?: (chunk: DataChunk) => void;
  experimental_prepareRequestBody?: (options: {
    id: string;
    messages: UIMessage[];
    requestData?: JSONValue;
    requestBody?: object;
  }) => ChatRequestBody;
};
