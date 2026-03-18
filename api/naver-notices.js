const NAVER_NOTICE_URL = 'https://ads.naver.com/notice?page=1';
const NAVER_BASE_URL = 'https://ads.naver.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET만 허용됩니다.' });

  try {
    const { id } = req.query;
    if (id) {
      const notice = await fetchNoticeDetail(String(id));
      return res.status(200).json({ success: true, notice });
    }

    const notices = await fetchNoticeList();
    return res.status(200).json({ success: true, fetchedAt: new Date().toISOString(), notices });
  } catch (error) {
    console.error('[naver-notices] 오류:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function fetchNoticeList() {
  const response = await fetch(NAVER_NOTICE_URL, { headers: defaultHeaders() });
  if (!response.ok) throw new Error(`네이버 공지 목록 조회 실패: ${response.status}`);

  const html = await response.text();
  const matches = [...html.matchAll(/<li><a href="\/notice\/(\d+)\?searchValue=.*?<p class="post_title">([\s\S]*?)<\/p>[\s\S]*?<span class="category">(.*?)<\/span><span class="date">(\d{4}-\d{2}-\d{2})<\/span><\/a><\/li>/g)];

  return matches.map((match) => {
    const [, id, rawTitle, category, date] = match;
    const title = stripTags(rawTitle).replace(/\s+/g, ' ').trim();
    return {
      id,
      title,
      category: decodeHtml(category.trim()),
      date,
      url: `${NAVER_BASE_URL}/notice/${id}`,
    };
  });
}

async function fetchNoticeDetail(id) {
  const response = await fetch(`${NAVER_BASE_URL}/notice/${id}`, { headers: defaultHeaders() });
  if (!response.ok) throw new Error(`네이버 공지 상세 조회 실패: ${response.status}`);

  const html = await response.text();
  const titleMatch = html.match(/<h3[^>]*class="[^\"]*title[^\"]*"[^>]*>([\s\S]*?)<\/h3>/i) || html.match(/"title":"([^"]+)"/);
  const dateMatch = html.match(/<span[^>]*class="[^\"]*date[^\"]*"[^>]*>(\d{4}-\d{2}-\d{2})<\/span>/i) || html.match(/"date":"(\d{4}-\d{2}-\d{2})"/);
  const categoryMatch = html.match(/<span[^>]*class="[^\"]*category[^\"]*"[^>]*>(.*?)<\/span>/i) || html.match(/"categoryName":"([^"]+)"/);

  const contentBlock = html.match(/<(?:div|article)[^>]*class="[^\"]*(?:viewer|content|detail)[^\"]*"[^>]*>([\s\S]*?)<\/(?:div|article)>/i);
  const rawContent = contentBlock ? stripTags(contentBlock[1]) : extractVisibleText(html);
  const content = rawContent
    .replace(/\s+/g, ' ')
    .replace(/공지사항|광고주센터/g, ' ')
    .trim()
    .slice(0, 1800);

  return {
    id,
    title: decodeHtml(stripTags(titleMatch?.[1] || '네이버 광고 공지')).trim(),
    category: decodeHtml(stripTags(categoryMatch?.[1] || '네이버 광고')).trim(),
    date: dateMatch?.[1] || '',
    url: `${NAVER_BASE_URL}/notice/${id}`,
    content,
  };
}

function extractVisibleText(html) {
  const withoutScript = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  return stripTags(withoutScript);
}

function stripTags(value = '') {
  return decodeHtml(value.replace(/<[^>]+>/g, ' '));
}

function decodeHtml(value = '') {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function defaultHeaders() {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  };
}
