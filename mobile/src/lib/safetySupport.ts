export type ImmediateHelpSignals = {
  recentMood?: number | null;
  recentJournalText?: string | null;
  recentAiInsight?: string | null;
  recentQuizResult?: string | null;
};

const CRITICAL_KEYWORDS = [
  "suicide",
  "kill myself",
  "self harm",
  "self-harm",
  "hurt myself",
  "hopeless",
  "can't live",
  "cant live",
  "cannot live",
  "no reason to live",
  "panic",
  "breakdown",
  "crisis",
  "abuse",
  "danger",
  "суицид",
  "убить себя",
  "причинить себе вред",
  "не хочу жить",
  "нет смысла жить",
  "безысходность",
  "паника",
  "срыв",
  "кризис",
  "опасность",
  "насилие",
  "өзімді өлтіру",
  "өмір сүргім келмейді",
  "өмірдің мәні жоқ",
  "өзіме зиян",
  "үмітсіз",
  "қорқыныш",
  "дағдарыс",
  "қауіп",
  "зорлық",
];

const NEGATIVE_STATE_WORDS = [
  "high risk",
  "severe",
  "crisis",
  "negative",
  "sadness",
  "anger",
  "anxiety",
  "stress",
  "risk",
  "высокий риск",
  "тяжел",
  "кризис",
  "тревога",
  "стресс",
  "грусть",
  "злость",
  "қауіп",
  "дағдарыс",
  "үрей",
  "стресс",
  "қайғы",
];

function normalizeText(value?: string | null) {
  return (value ?? "").toLocaleLowerCase();
}

export function containsCriticalKeyword(value?: string | null) {
  const text = normalizeText(value);
  if (!text) return false;
  return CRITICAL_KEYWORDS.some((keyword) => text.includes(keyword));
}

function containsNegativeState(value?: string | null) {
  const text = normalizeText(value);
  if (!text) return false;
  return NEGATIVE_STATE_WORDS.some((keyword) => text.includes(keyword));
}

export function shouldShowImmediateHelp({
  recentMood,
  recentJournalText,
  recentAiInsight,
  recentQuizResult,
}: ImmediateHelpSignals): boolean {
  if (typeof recentMood === "number" && recentMood <= 3) return true;

  const combinedText = [recentJournalText, recentAiInsight, recentQuizResult]
    .filter(Boolean)
    .join("\n");

  if (containsCriticalKeyword(combinedText)) return true;
  return (
    containsNegativeState(recentAiInsight) ||
    containsNegativeState(recentQuizResult)
  );
}
