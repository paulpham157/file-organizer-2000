import { NextRequest, NextResponse } from 'next/server';
import { handleAuthorizationV2 } from '@/lib/handleAuthorization';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_PLAIN_TEXT_LENGTH = 100_000;
const FETCH_TIMEOUT_MS = 15_000;

function isPrivateOrLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h.endsWith('.localhost')
  ) {
    return true;
  }
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
}

function parseAllowedUrl(input: string): URL {
  const trimmed = input.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed');
  }
  if (isPrivateOrLocalHostname(parsed.hostname)) {
    throw new Error('This URL is not allowed');
  }
  return parsed;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, num) =>
      String.fromCodePoint(parseInt(num, 10))
    );
}

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return undefined;
  const inner = m[1].replace(/<[^>]+>/g, ' ');
  const title = decodeHtmlEntities(inner).replace(/\s+/g, ' ').trim();
  if (!title) return undefined;
  return title.slice(0, 500);
}

function htmlToPlainText(html: string): string {
  let s = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div|h[1-6]|li|tr|section|article|header|footer)\b[^>]*>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeHtmlEntities(s);
  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/\n\s*\n+/g, '\n').trim();
  return s;
}

export async function GET(_request: NextRequest) {
  return NextResponse.json({
    message: 'Fetch URL API is available',
    method: 'Use POST with { url: string } in the request body',
    endpoint: '/api/fetch-url',
  });
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await handleAuthorizationV2(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const rawUrl = body?.url;
    if (!rawUrl || typeof rawUrl !== 'string') {
      return NextResponse.json(
        { error: 'url is required and must be a string' },
        { status: 400 }
      );
    }

    let targetUrl: URL;
    try {
      targetUrl = parseAllowedUrl(rawUrl);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Invalid or disallowed URL';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const urlString = targetUrl.toString();
    console.log(`[fetch-url] Fetching: ${urlString.substring(0, 120)}`);

    let response: Response;
    try {
      response = await fetch(urlString, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; NoteCompanion/1.0; +https://notecompanion.app)',
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        },
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to fetch URL';
      console.error('[fetch-url] Fetch error:', msg);
      return NextResponse.json(
        { error: `Could not fetch URL: ${msg}` },
        { status: 502 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Remote server returned HTTP ${response.status} ${response.statusText || ''}`.trim(),
        },
        { status: 502 }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();

    let plain: string;
    let title: string | undefined;

    if (contentType.includes('text/html') || raw.trimStart().startsWith('<')) {
      title = extractTitle(raw);
      plain = htmlToPlainText(raw);
    } else if (
      contentType.includes('text/plain') ||
      contentType.includes('text/markdown')
    ) {
      plain = raw;
    } else {
      plain = htmlToPlainText(raw);
      if (!plain || plain.length < 20) {
        return NextResponse.json(
          {
            error:
              'Unsupported content type; only HTML and plain text are supported',
          },
          { status: 415 }
        );
      }
    }

    if (!plain || plain.length < 1) {
      return NextResponse.json(
        { error: 'No readable text could be extracted from this page' },
        { status: 422 }
      );
    }

    const truncated =
      plain.length > MAX_PLAIN_TEXT_LENGTH
        ? plain.slice(0, MAX_PLAIN_TEXT_LENGTH) +
          '\n\n[Content truncated for length]'
        : plain;

    return NextResponse.json({
      title: title || undefined,
      content: truncated,
      url: urlString,
    });
  } catch (error) {
    console.error('[fetch-url] Error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch URL: ${errorMessage}` },
      { status: 500 }
    );
  }
}
