// ============================================================
// Lecture Notes — URL Scraper
// ============================================================
// Fetches a web page and extracts readable text using cheerio.

/**
 * Fetches a URL and returns its main text content, stripping
 * HTML tags, scripts, styles, and navigation boilerplate.
 */
export async function scrapeUrl(url: string): Promise<string> {
  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http:// and https:// URLs are supported.');
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'AcademicPlannerBot/1.0 (lecture-notes-ingestion)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL (${response.status}): ${url}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
    throw new Error(`Unsupported content type: ${contentType}. Only HTML and plain text are supported.`);
  }

  const html = await response.text();

  // Dynamic import for cheerio
  const { load } = await import('cheerio');
  const $ = load(html);

  // Remove noise elements
  $('script, style, nav, header, footer, aside, .sidebar, .advertisement, [role="navigation"]').remove();

  // Extract text from meaningful content areas first, fall back to body
  const contentSelectors = [
    'article',
    'main',
    '[role="main"]',
    '.content',
    '#content',
    '.post-content',
    '.entry-content',
    'body',
  ];

  for (const selector of contentSelectors) {
    const el = $(selector);
    if (el.length > 0) {
      const text = el
        .text()
        .replace(/\t/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      if (text.length > 200) {
        return text;
      }
    }
  }

  return $('body').text().trim();
}
