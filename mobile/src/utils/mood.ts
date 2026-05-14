type Translator = (key: string, params?: Record<string, string | number>) => string;

const EMOTION_LABEL_KEYS: Record<string, string> = {
  joy: 'emotionJoy',
  happy: 'emotionJoy',
  happiness: 'emotionJoy',
  calm: 'emotionCalm',
  stress: 'emotionStress',
  stressed: 'emotionStress',
  anxiety: 'emotionAnxiety',
  anxious: 'emotionAnxiety',
  sadness: 'emotionSadness',
  sad: 'emotionSadness',
  anger: 'emotionAnger',
  angry: 'emotionAnger',
  neutral: 'emotionNeutral',
};

const SENTIMENT_LABEL_KEYS: Record<string, string> = {
  positive: 'sentimentPositive',
  neutral: 'sentimentNeutral',
  negative: 'sentimentNegative',
  mixed: 'sentimentMixed',
};

function normalize(value?: string | null) {
  return (value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function fallbackTitle(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export function formatMoodLine(
  emotionLabel: string | undefined,
  sentimentLabel: string | undefined,
  t?: Translator,
): string {
  const raw = emotionLabel || sentimentLabel || 'neutral';
  const normalized = normalize(raw);
  const labelKey = EMOTION_LABEL_KEYS[normalized] ?? SENTIMENT_LABEL_KEYS[normalized];
  const mood = labelKey && t ? t(labelKey) : fallbackTitle(normalized || 'neutral');
  return t ? t('iFeelMood', { mood }) : `${mood}.`;
}

export function moodEmoji(emotionLabel: string | undefined, sentimentLabel: string | undefined): string {
  const e = (emotionLabel || '').toLowerCase();
  const s = (sentimentLabel || '').toLowerCase();
  if (e.includes('joy') || e.includes('happy') || s.includes('positive')) return '😊';
  if (e.includes('sad') || s.includes('negative')) return '😢';
  if (e.includes('angry') || e.includes('anger')) return '😠';
  if (e.includes('anxious') || e.includes('fear')) return '😰';
  return '😐';
}
