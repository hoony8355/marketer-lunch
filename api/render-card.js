import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get('data');
    if (!raw) {
      return new Response('data 파라미터가 없습니다.', { status: 400 });
    }

    const { p1, p2, p3, slideIndex = 0 } = JSON.parse(decodeURIComponent(raw));
    const slides = buildSlides(p1, p2, p3);
    const slide = slides[Math.min(slideIndex, slides.length - 1)];

    return new ImageResponse(
      renderSlide(slide, slideIndex, slides.length),
      { width: 1080, height: 1080 }
    );
  } catch (e) {
    return new Response(`오류: ${e.message}`, { status: 500 });
  }
}

// ── 슬라이드 구성 ──────────────────────────────────────────
// cover 1장 + p2 항목마다 1장 + action 1장
function buildSlides(p1, p2, p3) {
  return [
    { type: 'cover',  text: p1 },
    ...(p2 || []).map((text, i) => ({ type: 'point', text, index: i + 1 })),
    { type: 'action', items: p3 || [] },
  ];
}

// ── 공통 색상 ─────────────────────────────────────────────
const C = {
  bg:     '#0F172A',
  bg2:    '#1E293B',
  orange: '#FF6B00',
  sky:    '#38BDF8',
  light:  '#F1F5F9',
  muted:  '#64748B',
};

// ── 이모지·특수문자 제거 (satori 호환) ────────────────────
function clean(text = '') {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[✔✅💡🚨⚠️❗]/g, '')
    .trim();
}

// ── 슬라이드 렌더 ──────────────────────────────────────────
function renderSlide(slide, idx, total) {
  const today = new Date().toLocaleDateString('ko-KR');
  const pageNum = `${idx + 1} / ${total}`;

  const brandBar = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: 'auto',
  };

  const footerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingTop: '24px',
    borderTop: `1px solid ${C.muted}44`,
    marginTop: 'auto',
  };

  const wrap = (children) => ({
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: C.bg,
        padding: '64px',
        fontFamily: 'sans-serif',
      },
      children,
    },
  });

  // ── 커버 슬라이드 ────────────────────────────────────────
  if (slide.type === 'cover') {
    return wrap([
      {
        type: 'div',
        props: {
          style: brandBar,
          children: [
            { type: 'div', props: { style: { width: '8px', height: '8px', borderRadius: '4px', background: C.orange } } },
            { type: 'span', props: { style: { color: C.muted, fontSize: '18px', letterSpacing: '0.1em' }, children: '마케터의 점심' } },
          ],
        },
      },
      {
        type: 'div',
        props: {
          style: { display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: 'auto' },
          children: [
            {
              type: 'div',
              props: {
                style: {
                  background: C.orange, color: '#fff',
                  fontSize: '14px', padding: '6px 16px',
                  borderRadius: '4px', width: 'fit-content',
                  letterSpacing: '0.1em', fontWeight: '600',
                },
                children: 'AD UPDATE',
              },
            },
            {
              type: 'div',
              props: {
                style: { color: '#fff', fontSize: '48px', fontWeight: '700', lineHeight: '1.35', maxWidth: '900px' },
                children: clean(slide.text),
              },
            },
          ],
        },
      },
      {
        type: 'div',
        props: {
          style: footerStyle,
          children: [
            { type: 'span', props: { style: { color: C.muted, fontSize: '16px' }, children: today } },
            { type: 'span', props: { style: { color: C.muted, fontSize: '16px' }, children: pageNum } },
          ],
        },
      },
    ]);
  }

  // ── 포인트 슬라이드 ──────────────────────────────────────
  if (slide.type === 'point') {
    return wrap([
      {
        type: 'div',
        props: {
          style: brandBar,
          children: [
            { type: 'div', props: { style: { width: '8px', height: '8px', borderRadius: '4px', background: C.orange } } },
            { type: 'span', props: { style: { color: C.muted, fontSize: '18px', letterSpacing: '0.1em' }, children: '마케터의 점심' } },
          ],
        },
      },
      {
        type: 'div',
        props: {
          style: { display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: 'auto' },
          children: [
            {
              type: 'div',
              props: {
                style: { color: C.orange, fontSize: '14px', letterSpacing: '0.12em', fontWeight: '600' },
                children: `POINT ${String(slide.index).padStart(2, '0')}`,
              },
            },
            {
              type: 'div',
              props: {
                style: {
                  background: C.bg2,
                  border: `1px solid ${C.sky}33`,
                  borderLeft: `4px solid ${C.sky}`,
                  borderRadius: '12px',
                  padding: '36px 40px',
                },
                children: {
                  type: 'div',
                  props: {
                    style: { color: C.light, fontSize: '30px', lineHeight: '1.65', fontWeight: '500' },
                    children: clean(slide.text),
                  },
                },
              },
            },
          ],
        },
      },
      {
        type: 'div',
        props: {
          style: footerStyle,
          children: [
            { type: 'span', props: { style: { color: C.muted, fontSize: '16px' }, children: today } },
            { type: 'span', props: { style: { color: C.muted, fontSize: '16px' }, children: pageNum } },
          ],
        },
      },
    ]);
  }

  // ── 액션 팁 슬라이드 ────────────────────────────────────
  if (slide.type === 'action') {
    const tips = (slide.items || []).slice(0, 3);
    return wrap([
      {
        type: 'div',
        props: {
          style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' },
          children: [
            { type: 'div', props: { style: { width: '8px', height: '8px', borderRadius: '4px', background: C.orange } } },
            { type: 'span', props: { style: { color: C.muted, fontSize: '18px', letterSpacing: '0.1em' }, children: '마케터의 점심' } },
          ],
        },
      },
      {
        type: 'div',
        props: {
          style: { color: C.orange, fontSize: '14px', letterSpacing: '0.12em', fontWeight: '600', marginBottom: '24px' },
          children: 'ACTION TIPS',
        },
      },
      {
        type: 'div',
        props: {
          style: { display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: 'auto' },
          children: tips.map((tip, i) => ({
            type: 'div',
            props: {
              style: {
                display: 'flex', alignItems: 'flex-start', gap: '16px',
                background: C.bg2, borderRadius: '10px', padding: '22px 26px',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      minWidth: '30px', height: '30px', borderRadius: '15px',
                      background: C.orange, color: '#fff',
                      fontSize: '14px', fontWeight: '700',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: '0',
                    },
                    children: String(i + 1),
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: { color: C.light, fontSize: '24px', lineHeight: '1.55' },
                    children: clean(tip),
                  },
                },
              ],
            },
          })),
        },
      },
      {
        type: 'div',
        props: {
          style: footerStyle,
          children: [
            { type: 'span', props: { style: { color: C.sky, fontSize: '16px', fontWeight: '600' }, children: '#마케터의점심' } },
            { type: 'span', props: { style: { color: C.muted, fontSize: '16px' }, children: pageNum } },
          ],
        },
      },
    ]);
  }
}
