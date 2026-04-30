export function formatMoodLine(emotionLabel: string | undefined, sentimentLabel: string | undefined): string {
  const raw = (emotionLabel || sentimentLabel || 'neutral').trim();
  const pretty = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return `I Feel ${pretty}.`;
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
