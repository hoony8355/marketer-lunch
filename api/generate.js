export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 허용됩니다.' });

  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt 필드가 필요합니다.' });

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY 환경변수가 없습니다.' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    // 응답 텍스트 먼저 받기
    const rawText = await response.text();

    // JSON 파싱 시도
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('[generate] Anthropic 응답 파싱 실패:', rawText.slice(0, 300));
      return res.status(500).json({
        error: 'Anthropic 응답 파싱 실패',
        raw:   rawText.slice(0, 300),
      });
    }

    // Anthropic API 에러 처리
    if (data.error) {
      console.error('[generate] Anthropic API 에러:', data.error);
      return res.status(500).json({ error: data.error.message || 'Anthropic API 오류' });
    }

    // content 배열에서 텍스트 추출
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    if (!text) {
      return res.status(500).json({ error: '응답에 텍스트 콘텐츠가 없습니다.', data });
    }

    // ```json ... ``` 코드블록 제거 후 JSON 파싱
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      // JSON 파싱 실패 시 텍스트 그대로 반환 (프론트에서 처리)
      return res.status(200).json({ content: [{ type: 'text', text: cleaned }] });
    }

    return res.status(200).json({ content: [{ type: 'text', text: JSON.stringify(parsed) }], parsed });

  } catch (e) {
    console.error('[generate] 서버 오류:', e);
    return res.status(500).json({ error: e.message });
  }
}
