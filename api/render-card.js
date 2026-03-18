import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

async function loadKoreanFont(weight = 400) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&display=swap`;
  const css = await fetch(cssUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' },
  }).then((r) => r.text());
  const match = css.match(/src: url\((.+?)\) format\('woff2'\)/);
  if (!match) throw new Error('woff2 URL을 찾을 수 없습니다.');
  return fetch(match[1]).then((r) => r.arrayBuffer());
}

const C = { bg: '#0F172A', bg2: '#1E293B', orange: '#FF6B00', sky: '#38BDF8', light: '#F1F5F9', muted: '#64748B' };

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const rawPayload = searchParams.get('payload');
    const rawLegacy = searchParams.get('data');
    if (!rawPayload && !rawLegacy) return new Response('payload 또는 data 파라미터가 없습니다.', { status: 400 });

    const payload = rawPayload ? JSON.parse(decodeURIComponent(rawPayload)) : legacyToPayload(JSON.parse(decodeURIComponent(rawLegacy)));
    const slideIndex = Number(payload.slideIndex || 0);
    const slides = payload.slides || [];
    const slide = slides[Math.min(slideIndex, slides.length - 1)];
    const [fontRegular, fontBold] = await Promise.all([loadKoreanFont(400), loadKoreanFont(700)]);

    return new ImageResponse(renderSlide(payload, slide, slideIndex, slides.length), {
      width: 1080,
      height: 1080,
      fonts: [
        { name: 'NotoSansKR', data: fontRegular, weight: 400, style: 'normal' },
        { name: 'NotoSansKR', data: fontBold, weight: 700, style: 'normal' },
      ],
    });
  } catch (e) {
    console.error('[render-card] 오류:', e);
    return new Response(`오류: ${e.message}`, { status: 500 });
  }
}

function legacyToPayload({ p1, p2 = [], p3 = [], slideIndex = 0 }) {
  return {
    title: p1,
    slideIndex,
    slides: [
      { type: 'cover', headline: p1, body: '핵심 업데이트 요약' },
      ...p2.map((item, index) => ({ type: 'point', label: `POINT ${String(index + 1).padStart(2, '0')}`, headline: item, body: item })),
      { type: 'action', headline: '실무 액션', body: p3.join(' · ') },
    ],
  };
}

function renderSlide(payload, slide, idx, total) {
  const today = new Date().toLocaleDateString('ko-KR');
  const label = clean(payload.label || 'NAVER UPDATE');
  const pageNum = `${idx + 1} / ${total}`;
  const footerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingTop: '24px', borderTop: `1px solid ${C.muted}55`, marginTop: 'auto' };
  const wrap = (children) => ({ type: 'div', props: { style: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: C.bg, padding: '72px', fontFamily: 'NotoSansKR' }, children } });
  const brandBar = { type: 'div', props: { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'auto' }, children: [
    { type: 'div', props: { style: { width: '8px', height: '8px', borderRadius: '4px', background: C.orange } } },
    { type: 'span', props: { style: { color: C.muted, fontSize: '20px', letterSpacing: '0.06em' }, children: '마케터의 점심' } },
  ] } };

  if (slide.type === 'cover') {
    return wrap([brandBar, { type: 'div', props: { style: { display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: 'auto' }, children: [
      { type: 'div', props: { style: { background: C.orange, color: '#fff', fontSize: '16px', fontWeight: 700, padding: '8px 18px', borderRadius: '6px', width: 'fit-content', letterSpacing: '0.08em' }, children: label } },
      { type: 'div', props: { style: { color: '#fff', fontSize: '56px', fontWeight: 700, lineHeight: '1.35', maxWidth: '900px' }, children: clean(slide.headline || payload.title) } },
      { type: 'div', props: { style: { color: C.light, fontSize: '28px', lineHeight: '1.6', maxWidth: '900px' }, children: clean(slide.body || '') } },
    ] } }, footer(footerStyle, today, pageNum)]);
  }

  if (slide.type === 'action') {
    const items = (slide.body || '').split(/\s*[→·|]\s*/).filter(Boolean).slice(0, 4);
    return wrap([brandBar, { type: 'div', props: { style: { color: C.orange, fontSize: '16px', fontWeight: 700, letterSpacing: '0.14em', marginBottom: '24px' }, children: 'ACTION CHECKLIST' } }, { type: 'div', props: { style: { display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: 'auto' }, children: items.map((tip, i) => ({ type: 'div', props: { style: { display: 'flex', alignItems: 'flex-start', gap: '18px', background: C.bg2, borderRadius: '12px', padding: '24px 28px' }, children: [
      { type: 'div', props: { style: { minWidth: '32px', height: '32px', borderRadius: '16px', background: C.orange, color: '#fff', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }, children: String(i + 1) } },
      { type: 'div', props: { style: { color: C.light, fontSize: '28px', lineHeight: '1.6' }, children: clean(tip) } },
    ] } })) } }, footer(footerStyle, '#마케터의점심', pageNum)]);
  }

  return wrap([brandBar, { type: 'div', props: { style: { display: 'flex', flexDirection: 'column', gap: '28px', marginBottom: 'auto' }, children: [
    { type: 'div', props: { style: { color: C.orange, fontSize: '16px', fontWeight: 700, letterSpacing: '0.14em' }, children: clean(slide.label || 'POINT') } },
    { type: 'div', props: { style: { color: '#fff', fontSize: '46px', fontWeight: 700, lineHeight: '1.35' }, children: clean(slide.headline || payload.title) } },
    { type: 'div', props: { style: { background: C.bg2, border: `1px solid ${C.sky}44`, borderLeft: `5px solid ${C.sky}`, borderRadius: '14px', padding: '40px 44px' }, children: { type: 'div', props: { style: { color: C.light, fontSize: '32px', lineHeight: '1.7' }, children: clean(slide.body || '') } } } },
  ] } }, footer(footerStyle, today, pageNum)]);
}

function footer(style, left, right) {
  return { type: 'div', props: { style, children: [
    { type: 'span', props: { style: { color: C.muted, fontSize: '18px' }, children: left } },
    { type: 'span', props: { style: { color: C.muted, fontSize: '18px' }, children: right } },
  ] } };
}

function clean(text = '') {
  return String(text).replace(/[\u{1F000}-\u{1FFFF}]/gu, '').replace(/[✔✅💡🚨⚠️❗✦◷▦✎↗⟳]/g, '').trim();
}
