export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = req.body;

    // ── Make에서 넘어온 result 필드 파싱 ─────────────────────
    // Gemini 응답이 "```json\n{...}\n```" 형태로 감싸져 있음
    let cardData;
    if (body.result) {
      const jsonMatch =
        body.result.match(/```json\n([\s\S]*?)\n```/) ||
        body.result.match(/```json\n([\s\S]*?)```/)   ||
        body.result.match(/({[\s\S]*})/);
      if (!jsonMatch) {
        return res.status(400).json({ error: 'result에서 JSON을 파싱할 수 없습니다.' });
      }
      cardData = JSON.parse(jsonMatch[1]);
    } else if (body.p1) {
      cardData = body;
    } else {
      return res.status(400).json({ error: 'p1/p2/p3 데이터가 없습니다. result 또는 p1 필드를 확인하세요.' });
    }

    const { p1, p2, p3 } = cardData;
    if (!p1 || !p2 || !p3) {
      return res.status(400).json({ error: 'p1, p2, p3 필드가 모두 필요합니다.' });
    }

    const IG_ACCOUNT_ID = process.env.IG_ACCOUNT_ID;
    const ACCESS_TOKEN  = process.env.IG_ACCESS_TOKEN;
    const BASE_URL      = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : `https://${process.env.VERCEL_URL}`;

    if (!IG_ACCOUNT_ID || !ACCESS_TOKEN) {
      return res.status(500).json({ error: 'Instagram 환경변수(IG_ACCOUNT_ID, IG_ACCESS_TOKEN)가 설정되지 않았습니다.' });
    }

    // ── 슬라이드 수 계산 ──────────────────────────────────────
    const totalSlides = 1 + p2.length + 1; // cover + points + action

    // ── 각 슬라이드 이미지 URL 생성 ───────────────────────────
    // render-card Edge Function이 PNG를 직접 반환하므로
    // Instagram이 해당 URL로 접근해서 이미지를 가져감
    const slideUrls = Array.from({ length: totalSlides }, (_, i) => {
      const data = encodeURIComponent(JSON.stringify({ p1, p2, p3, slideIndex: i }));
      return `${BASE_URL}/api/render-card?data=${data}`;
    });

    // ── 1단계: 슬라이드별 미디어 컨테이너 생성 ────────────────
    const childIds = [];
    for (const imageUrl of slideUrls) {
      const r = await fetch(
        `https://graph.facebook.com/v19.0/${IG_ACCOUNT_ID}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url:        imageUrl,
            is_carousel_item: true,
            access_token:     ACCESS_TOKEN,
          }),
        }
      );
      const data = await r.json();
      if (!data.id) {
        throw new Error(`슬라이드 컨테이너 생성 실패: ${JSON.stringify(data)}`);
      }
      childIds.push(data.id);
      // API 속도 제한 방지
      await sleep(500);
    }

    // ── 2단계: 캐러셀 컨테이너 생성 ──────────────────────────
    const caption = buildCaption(p1, p3);
    const carouselRes = await fetch(
      `https://graph.facebook.com/v19.0/${IG_ACCOUNT_ID}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type:  'CAROUSEL',
          children:    childIds.join(','),
          caption,
          access_token: ACCESS_TOKEN,
        }),
      }
    );
    const carousel = await carouselRes.json();
    if (!carousel.id) {
      throw new Error(`캐러셀 생성 실패: ${JSON.stringify(carousel)}`);
    }

    // ── 3단계: 발행 ───────────────────────────────────────────
    const publishRes = await fetch(
      `https://graph.facebook.com/v19.0/${IG_ACCOUNT_ID}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id:  carousel.id,
          access_token: ACCESS_TOKEN,
        }),
      }
    );
    const published = await publishRes.json();
    if (!published.id) {
      throw new Error(`발행 실패: ${JSON.stringify(published)}`);
    }

    return res.status(200).json({
      success:         true,
      instagramPostId: published.id,
      slidesCount:     totalSlides,
      caption,
      publishedAt:     new Date().toISOString(),
    });

  } catch (e) {
    console.error('[publish] 오류:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
}

// ── 캡션 생성 ────────────────────────────────────────────────
function buildCaption(p1, p3) {
  const title = cleanText(p1);
  const tip   = cleanText((p3 || [])[0] || '');
  return `${title}\n\n${tip}\n\n#마케터의점심 #광고트렌드 #디지털마케팅 #퍼포먼스마케팅 #네이버광고 #구글광고 #메타광고 #인스타그램광고`;
}

function cleanText(text = '') {
  return text.replace(/[\u{1F000}-\u{1FFFF}]/gu, '').replace(/[✔✅💡🚨⚠️❗]/g, '').trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
