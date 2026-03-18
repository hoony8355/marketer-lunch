export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 허용됩니다.' });

  try {
    const body = req.body || {};
    const cardData = normalizeCardData(body);
    if (!cardData?.slides?.length) return res.status(400).json({ error: 'slides가 포함된 카드 데이터가 필요합니다.' });

    const IG_ACCOUNT_ID = process.env.IG_ACCOUNT_ID;
    const ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
    const BASE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : `https://${process.env.VERCEL_URL || req.headers.host}`;
    if (!IG_ACCOUNT_ID || !ACCESS_TOKEN) return res.status(500).json({ error: 'IG_ACCOUNT_ID 또는 IG_ACCESS_TOKEN 환경변수가 없습니다.' });

    const payload = encodeURIComponent(JSON.stringify(cardData));
    const slideUrls = cardData.slides.map((_, i) => `${BASE_URL}/api/render-card?payload=${payload}&slideIndex=${i}`);

    const childIds = [];
    for (const imageUrl of slideUrls) {
      const r = await fetch(`https://graph.facebook.com/v19.0/${IG_ACCOUNT_ID}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl, is_carousel_item: true, access_token: ACCESS_TOKEN }),
      });
      const data = await r.json();
      if (!data.id) throw new Error(`슬라이드 컨테이너 생성 실패: ${JSON.stringify(data)}`);
      childIds.push(data.id);
      await sleep(500);
    }

    const caption = buildCaption(cardData);
    const carouselRes = await fetch(`https://graph.facebook.com/v19.0/${IG_ACCOUNT_ID}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_type: 'CAROUSEL', children: childIds.join(','), caption, access_token: ACCESS_TOKEN }),
    });
    const carousel = await carouselRes.json();
    if (!carousel.id) throw new Error(`캐러셀 생성 실패: ${JSON.stringify(carousel)}`);

    const publishRes = await fetch(`https://graph.facebook.com/v19.0/${IG_ACCOUNT_ID}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: carousel.id, access_token: ACCESS_TOKEN }),
    });
    const published = await publishRes.json();
    if (!published.id) throw new Error(`발행 실패: ${JSON.stringify(published)}`);

    return res.status(200).json({ success: true, instagramPostId: published.id, slidesCount: cardData.slides.length, caption, publishedAt: new Date().toISOString() });
  } catch (e) {
    console.error('[publish] 오류:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
}

function normalizeCardData(body) {
  if (body.result) {
    const match = body.result.match(/```json\n([\s\S]*?)\n```/) || body.result.match(/```json\n([\s\S]*?)```/) || body.result.match(/({[\s\S]*})/);
    if (!match) throw new Error('result 필드에서 JSON을 파싱할 수 없습니다.');
    return JSON.parse(match[1]);
  }
  if (body.slides?.length) return body;
  if (body.p1) {
    return { title: body.p1, slides: [{ type: 'cover', headline: body.p1, body: '' }, ...(body.p2 || []).map((item, index) => ({ type: 'point', label: `POINT ${String(index + 1).padStart(2, '0')}`, headline: item, body: item })), { type: 'action', headline: '실무 액션', body: (body.p3 || []).join(' · ') }], caption: body.caption || '', hashtags: body.hashtags || [] };
  }
  return null;
}

function buildCaption(cardData) {
  const title = cleanText(cardData.title || cardData.slides?.[0]?.headline || '네이버 광고 업데이트');
  const caption = cleanText(cardData.caption || '주요 업데이트를 카드뉴스로 정리했습니다.');
  const hashtags = Array.isArray(cardData.hashtags) && cardData.hashtags.length ? cardData.hashtags.join(' ') : '#마케터의점심 #네이버광고 #광고업데이트 #디지털마케팅';
  return `${title}\n\n${caption}\n\n${hashtags}`;
}

function cleanText(text = '') { return String(text).replace(/[\u{1F000}-\u{1FFFF}]/gu, '').replace(/[✔✅💡🚨⚠️❗]/g, '').trim(); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
