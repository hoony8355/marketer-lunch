import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

// ── 한글 폰트 로딩 (Noto Sans KR) ────────────────────────────
async function loadKoreanFont(weight = 400) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&display=swap`;
  const css = await fetch(cssUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    },
  }).then(r => r.text());

  const match = css.match(/src: url\((.+?)\) format\('woff2'\)/);
  if (!match) throw new Error('woff2 URL을 찾을 수 없습니다.');

  const fontRes = await fetch(match[1]);
  return fontRes.arrayBuffer();
}

// ── 슬라이드 구성 ─────────────────────────────────────────────
function buildSlides(p1, p2, p3) {
  return [
    { type: 'cover',  text: p1 },
    ...(p2 || []).map((text, i) => ({ type: 'point', text, index: i + 1 })),
    { type: 'action', items: p3 || [] },
  ];
}

// ── 색상 ─────────────────────────────────────────────────────
const C = {
  bg:     '#0F172A',
  bg2:    '#1E293B',
  orange: '#FF6B00',
  sky:    '#38BDF8',
  light:  '#F1F5F9',
  muted:  '#64748B',
};

// ── 특수문자·이모지 제거 (satori 호환) ────────────────────────
function clean(text = '') {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[✔✅💡🚨⚠️❗✦◷▦✎↗⟳]/g, '')
    .trim();
}

// ── 메인 핸들러 ───────────────────────────────────────────────
export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get('data');
    if (!raw) return new Response('data 파라미터가 없습니다.', { status: 400 });

    const { p1, p2, p3, slideIndex = 0 } = JSON.parse(decodeURIComponent(raw));
    const slides = buildSlides(p1, p2, p3);
    const slide  = slides[Math.min(Number(slideIndex), slides.length - 1)];

    // 한글 폰트 병렬 로딩
    const [fontRegular, fontBold] = await Promise.all([
      loadKoreanFont(400),
      loadKoreanFont(700),
    ]);

    return new ImageResponse(
      renderSlide(slide, Number(slideIndex), slides.length),
      {
        width:  1080,
        height: 1080,
        fonts: [
          { name: 'NotoSansKR', data: fontRegular, weight: 400, style: 'normal' },
          { name: 'NotoSansKR', data: fontBold,    weight: 700, style: 'normal' },
        ],
      }
    );
  } catch (e) {
    console.error('[render-card] 오류:', e);
    return new Response(`오류: ${e.message}`, { status: 500 });
  }
}

// ── 슬라이드 렌더 ─────────────────────────────────────────────
function renderSlide(slide, idx, total) {
  const today   = new Date().toLocaleDateString('ko-KR');
  const pageNum = `${idx + 1} / ${total}`;
  const FONT    = 'NotoSansKR';

  const footerStyle = {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
    width:          '100%',
    paddingTop:     '24px',
    borderTop:      `1px solid ${C.muted}55`,
    marginTop:      'auto',
  };

  const wrap = (children) => ({
    type: 'div',
    props: {
      style: {
        display:       'flex',
        flexDirection: 'column',
        width:         '100%',
        height:        '100%',
        background:    C.bg,
        padding:       '72px',
        fontFamily:    FONT,
      },
      children,
    },
  });

  const brandBar = {
    type: 'div',
    props: {
      style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'auto' },
      children: [
        { type: 'div', props: { style: { width: '8px', height: '8px', borderRadius: '4px', background: C.orange } } },
        { type: 'span', props: { style: { color: C.muted, fontSize: '20px', letterSpacing: '0.06em', fontFamily: FONT }, children: '마케터의 점심' } },
      ],
    },
  };

  // ── 커버 ──────────────────────────────────────────────────
  if (slide.type === 'cover') {
    return wrap([
      brandBar,
      {
        type: 'div',
        props: {
          style: { display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: 'auto' },
          children: [
            {
              type: 'div',
              props: {
                style: {
                  background: C.orange, color: '#fff',
                  fontSize: '16px', fontWeight: 700,
                  padding: '8px 18px', borderRadius: '6px',
                  width: 'fit-content', letterSpacing: '0.08em',
                  fontFamily: FONT,
                },
                children: 'AD UPDATE',
              },
            },
            {
              type: 'div',
              props: {
                style: {
                  color: '#fff', fontSize: '56px', fontWeight: 700,
                  lineHeight: '1.4', maxWidth: '900px', fontFamily: FONT,
                },
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
            { type: 'span', props: { style: { color: C.muted, fontSize: '18px', fontFamily: FONT }, children: today } },
            { type: 'span', props: { style: { color: C.muted, fontSize: '18px', fontFamily: FONT }, children: pageNum } },
          ],
        },
      },
    ]);
  }

  // ── 포인트 ────────────────────────────────────────────────
  if (slide.type === 'point') {
    return wrap([
      brandBar,
      {
        type: 'div',
        props: {
          style: { display: 'flex', flexDirection: 'column', gap: '28px', marginBottom: 'auto' },
          children: [
            {
              type: 'div',
              props: {
                style: {
                  color: C.orange, fontSize: '16px', fontWeight: 700,
                  letterSpacing: '0.14em', fontFamily: FONT,
                },
                children: `POINT ${String(slide.index).padStart(2, '0')}`,
              },
            },
            {
              type: 'div',
              props: {
                style: {
                  background: C.bg2,
                  border: `1px solid ${C.sky}44`,
                  borderLeft: `5px solid ${C.sky}`,
                  borderRadius: '14px',
                  padding: '40px 44px',
                },
                children: {
                  type: 'div',
                  props: {
                    style: {
                      color: C.light, fontSize: '34px', fontWeight: 400,
                      lineHeight: '1.7', fontFamily: FONT,
                    },
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
            { type: 'span', props: { style: { color: C.muted, fontSize: '18px', fontFamily: FONT }, children: today } },
            { type: 'span', props: { style: { color: C.muted, fontSize: '18px', fontFamily: FONT }, children: pageNum } },
          ],
        },
      },
    ]);
  }

  // ── 액션 팁 ──────────────────────────────────────────────
  if (slide.type === 'action') {
    const tips = (slide.items || []).slice(0, 3);
    return wrap([
      {
        type: 'div',
        props: {
          style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' },
          children: [
            { type: 'div', props: { style: { width: '8px', height: '8px', borderRadius: '4px', background: C.orange } } },
            { type: 'span', props: { style: { color: C.muted, fontSize: '20px', letterSpacing: '0.06em', fontFamily: FONT }, children: '마케터의 점심' } },
          ],
        },
      },
      {
        type: 'div',
        props: {
          style: { color: C.orange, fontSize: '16px', fontWeight: 700, letterSpacing: '0.14em', marginBottom: '24px', fontFamily: FONT },
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
                display: 'flex', alignItems: 'flex-start', gap: '18px',
                background: C.bg2, borderRadius: '12px', padding: '24px 28px',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      minWidth: '32px', height: '32px', borderRadius: '16px',
                      background: C.orange, color: '#fff',
                      fontSize: '15px', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: '0', fontFamily: FONT,
                    },
                    children: String(i + 1),
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: { color: C.light, fontSize: '26px', lineHeight: '1.6', fontWeight: 400, fontFamily: FONT },
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
            { type: 'span', props: { style: { color: C.sky, fontSize: '18px', fontWeight: 700, fontFamily: FONT }, children: '#마케터의점심' } },
            { type: 'span', props: { style: { color: C.muted, fontSize: '18px', fontFamily: FONT }, children: pageNum } },
          ],
        },
      },
    ]);
  }
}
