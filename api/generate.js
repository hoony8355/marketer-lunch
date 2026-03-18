export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 허용됩니다.' });

  try {
    const { prompt, notice } = req.body;
    if (!prompt && !notice) return res.status(400).json({ error: 'prompt 또는 notice 필드가 필요합니다.' });

    if (!process.env.ANTHROPIC_API_KEY) {
      const fallback = buildFallbackCard(notice, prompt);
      return res.status(200).json({ content: [{ type: 'text', text: JSON.stringify(fallback) }], parsed: fallback, fallback: true });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt || buildPromptFromNotice(notice) }],
      }),
    });

    const rawText = await response.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('[generate] Anthropic 응답 파싱 실패:', rawText.slice(0, 300));
      return res.status(500).json({ error: 'Anthropic 응답 파싱 실패', raw: rawText.slice(0, 300) });
    }

    if (data.error) {
      console.error('[generate] Anthropic API 에러:', data.error);
      return res.status(500).json({ error: data.error.message || 'Anthropic API 오류' });
    }

    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    if (!text) return res.status(500).json({ error: '응답에 텍스트 콘텐츠가 없습니다.', data });

    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (error) {
      return res.status(200).json({ content: [{ type: 'text', text: cleaned }] });
    }

    return res.status(200).json({ content: [{ type: 'text', text: JSON.stringify(parsed) }], parsed });
  } catch (e) {
    console.error('[generate] 서버 오류:', e);
    return res.status(500).json({ error: e.message });
  }
}

function buildPromptFromNotice(notice = {}) {
  return [
    '브랜드: 마케터의 점심 | 톤: 실무형, 간결함, 인스타 카드뉴스 최적화',
    `주제: ${notice.title || '네이버 광고 공지 업데이트'}`,
    `카테고리: ${notice.category || '네이버 광고'}`,
    `게시일: ${notice.date || ''}`,
    `원문 요약 재료: ${notice.content || notice.summary || ''}`,
    'JSON만 반환. 마크다운 금지.',
    '{"label":"NAVER UPDATE","title":"제목","slides":[{"num":1,"type":"cover","headline":"제목","body":"한 줄 요약"},{"num":2,"type":"point","label":"POINT 01","headline":"무엇이 바뀌나","body":"변경 내용 설명"},{"num":3,"type":"point","label":"POINT 02","headline":"왜 중요하나","body":"실무 영향 설명"},{"num":4,"type":"point","label":"POINT 03","headline":"바로 할 일","body":"체크리스트 설명"},{"num":5,"type":"action","headline":"실무 체크리스트","body":"실행 팁 요약"}],"caption":"캡션","hashtags":["#마케터의점심","#네이버광고"]}',
  ].join('\n');
}

function buildFallbackCard(notice = {}, prompt = '') {
  const title = (notice?.title || prompt || '네이버 광고 공지 업데이트').trim();
  const date = notice?.date || new Date().toISOString().slice(0, 10);
  const category = notice?.category || '네이버 광고';
  const content = (notice?.content || '').replace(/\s+/g, ' ').trim();
  const chunks = splitContent(content);

  return {
    label: 'NAVER UPDATE',
    title,
    source: 'naver',
    sourceUrl: notice?.url || 'https://ads.naver.com/notice',
    noticeId: notice?.id || null,
    slides: [
      { num: 1, type: 'cover', headline: title, body: `${category} · ${date}` },
      { num: 2, type: 'point', label: 'POINT 01', headline: '무엇이 업데이트됐나', body: chunks[0] || `${category} 공지의 핵심 변경 사항을 먼저 확인하세요.` },
      { num: 3, type: 'point', label: 'POINT 02', headline: '실무 영향', body: chunks[1] || '광고 운영, 리포트, 소재 운영 프로세스에 미치는 영향을 정리해보세요.' },
      { num: 4, type: 'point', label: 'POINT 03', headline: '실행 체크', body: chunks[2] || '계정 설정, 리포트 지표, 내부 운영 가이드를 함께 점검하는 흐름을 추천합니다.' },
      { num: 5, type: 'action', headline: '오늘의 액션', body: '원문 확인 → 영향 받는 캠페인 점검 → 팀 공유 → 적용 일정 확정' },
    ],
    caption: `${title}\n\n${category} 공지가 업데이트되었습니다. 실무자가 놓치지 말아야 할 포인트를 빠르게 정리했습니다.`,
    hashtags: ['#마케터의점심', '#네이버광고', '#검색광고', '#광고업데이트'],
  };
}

function splitContent(content = '') {
  if (!content) return [];
  const sentences = content.split(/(?<=[.!?다요])\s+/).filter(Boolean);
  const chunks = [];
  for (const sentence of sentences) {
    const prev = chunks[chunks.length - 1];
    const next = prev ? `${prev} ${sentence}` : sentence;
    if (!prev || next.length > 110) chunks.push(sentence);
    else chunks[chunks.length - 1] = next;
    if (chunks.length >= 3) break;
  }
  return chunks.map((item) => item.slice(0, 120));
}
