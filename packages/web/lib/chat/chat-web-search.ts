/** Default on; set CHAT_WEB_SEARCH=false to disable Responses API web search. */
export function isChatWebSearchEnabled(): boolean {
  return process.env.CHAT_WEB_SEARCH !== 'false';
}

/** Default off; set CHAT_DEEP_SEARCH=true for medium search context size. */
export function isChatDeepSearchEnabled(): boolean {
  return process.env.CHAT_DEEP_SEARCH === 'true';
}
