export type AchievementStatus = "locked" | "in_progress" | "unlocked";

export type AchievementCategory =
  | "reflection"
  | "mood"
  | "ai_support"
  | "self_care";

export type Achievement = {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  icon: string;
  status: AchievementStatus;
  progress?: number;
  target?: number;
  unlockedAt?: string | null;
};

type Translate = (key: string) => string;

export type BuildAchievementsInput = {
  journalEntryCount?: number;
  journalEntryDates?: string[];
  moodEntryCount?: number;
  aiInsightCount?: number;
  quizResultCount?: number;
  trustedPersonPhone?: string | null;
  weeklySummaryViewed?: boolean;
  weeklyMoodReviewViewed?: boolean;
  privacyConfigured?: boolean;
};

type AchievementConfig = Omit<
  Achievement,
  "title" | "description" | "status" | "progress" | "target" | "unlockedAt"
> & {
  titleKey: string;
  descriptionKey: string;
  progress?: number;
  target?: number;
  unlocked: boolean;
  unlockedAt?: string | null;
};

function normalizeDateKey(value: string) {
  const datePart = value.split("T")[0];
  const parsed = new Date(`${datePart}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split("T")[0];
}

function hasConsecutiveDays(values: string[], target: number) {
  const uniqueTimes = Array.from(
    new Set(
      values
        .map(normalizeDateKey)
        .filter((value): value is string => Boolean(value))
        .map((value) => new Date(`${value}T00:00:00`).getTime()),
    ),
  ).sort((a, b) => a - b);

  let longest = 0;
  let current = 0;
  let previous: number | null = null;
  const oneDay = 24 * 60 * 60 * 1000;

  uniqueTimes.forEach((time) => {
    current = previous != null && time - previous === oneDay ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = time;
  });

  return {
    hasStreak: longest >= target,
    longest,
  };
}

function progressStatus(unlocked: boolean, progress = 0): AchievementStatus {
  if (unlocked) return "unlocked";
  return progress > 0 ? "in_progress" : "locked";
}

function buildAchievement(
  config: AchievementConfig,
  t: Translate,
): Achievement {
  const progress = config.progress ?? (config.unlocked ? config.target : 0);
  return {
    id: config.id,
    title: t(config.titleKey),
    description: t(config.descriptionKey),
    category: config.category,
    icon: config.icon,
    status: progressStatus(config.unlocked, progress),
    progress,
    target: config.target,
    unlockedAt: config.unlocked ? (config.unlockedAt ?? null) : null,
  };
}

export function buildAchievements(
  input: BuildAchievementsInput,
  t: Translate = (key) => key,
): Achievement[] {
  const journalCount = input.journalEntryCount ?? 0;
  const journalDates = input.journalEntryDates ?? [];
  const moodCount = input.moodEntryCount ?? 0;
  const aiInsightCount = input.aiInsightCount ?? 0;
  const quizCount = input.quizResultCount ?? 0;
  const threeDayReflection = hasConsecutiveDays(journalDates, 3);

  // TODO: Replace locally stored event flags with backend-backed user events when
  // achievement telemetry is available across devices.
  const configs: AchievementConfig[] = [
    {
      id: "first-reflection",
      titleKey: "achievementFirstReflection",
      descriptionKey: "achievementFirstReflectionDesc",
      category: "reflection",
      icon: "sparkles-outline",
      target: 1,
      progress: Math.min(journalCount, 1),
      unlocked: journalCount >= 1,
    },
    {
      id: "three-day-reflection",
      titleKey: "achievementThreeDayReflection",
      descriptionKey: "achievementThreeDayReflectionDesc",
      category: "reflection",
      icon: "leaf-outline",
      target: 3,
      progress: Math.min(threeDayReflection.longest, 3),
      unlocked: threeDayReflection.hasStreak,
    },
    {
      id: "consistent-journaling",
      titleKey: "achievementConsistentJournaling",
      descriptionKey: "achievementConsistentJournalingDesc",
      category: "reflection",
      icon: "journal-outline",
      target: 5,
      progress: Math.min(journalCount, 5),
      unlocked: journalCount >= 5,
    },
    {
      id: "first-mood-check-in",
      titleKey: "achievementFirstMoodCheckIn",
      descriptionKey: "achievementFirstMoodCheckInDesc",
      category: "mood",
      icon: "happy-outline",
      target: 1,
      progress: Math.min(moodCount, 1),
      unlocked: moodCount >= 1,
    },
    {
      id: "mood-awareness",
      titleKey: "achievementMoodAwareness",
      descriptionKey: "achievementMoodAwarenessDesc",
      category: "mood",
      icon: "analytics-outline",
      target: 5,
      progress: Math.min(moodCount, 5),
      unlocked: moodCount >= 5,
    },
    {
      id: "weekly-mood-review",
      titleKey: "achievementWeeklyMoodReview",
      descriptionKey: "achievementWeeklyMoodReviewDesc",
      category: "mood",
      icon: "calendar-clear-outline",
      target: 1,
      progress: input.weeklyMoodReviewViewed ? 1 : 0,
      unlocked: Boolean(input.weeklyMoodReviewViewed),
    },
    {
      id: "first-ai-insight",
      titleKey: "achievementFirstAiInsight",
      descriptionKey: "achievementFirstAiInsightDesc",
      category: "ai_support",
      icon: "bulb-outline",
      target: 1,
      progress: Math.min(aiInsightCount, 1),
      unlocked: aiInsightCount >= 1,
    },
    {
      id: "completed-ai-quiz",
      titleKey: "achievementCompletedAiQuiz",
      descriptionKey: "achievementCompletedAiQuizDesc",
      category: "ai_support",
      icon: "chatbubbles-outline",
      target: 1,
      progress: Math.min(quizCount, 1),
      unlocked: quizCount >= 1,
    },
    {
      id: "first-weekly-summary",
      titleKey: "achievementFirstWeeklySummary",
      descriptionKey: "achievementFirstWeeklySummaryDesc",
      category: "self_care",
      icon: "document-text-outline",
      target: 1,
      progress: input.weeklySummaryViewed ? 1 : 0,
      unlocked: Boolean(input.weeklySummaryViewed),
    },
    {
      id: "support-contact-added",
      titleKey: "achievementSupportContactAdded",
      descriptionKey: "achievementSupportContactAddedDesc",
      category: "self_care",
      icon: "shield-checkmark-outline",
      target: 1,
      progress: input.trustedPersonPhone?.trim() ? 1 : 0,
      unlocked: Boolean(input.trustedPersonPhone?.trim()),
    },
    {
      id: "privacy-ready",
      titleKey: "achievementPrivacyReady",
      descriptionKey: "achievementPrivacyReadyDesc",
      category: "self_care",
      icon: "lock-closed-outline",
      target: 1,
      progress: input.privacyConfigured ? 1 : 0,
      unlocked: Boolean(input.privacyConfigured),
    },
    // TODO: Unlock when journal entry creation exposes enough recent inactivity
    // context to detect a gentle return after a break without shame messaging.
    {
      id: "welcome-back",
      titleKey: "achievementWelcomeBack",
      descriptionKey: "achievementWelcomeBackDesc",
      category: "reflection",
      icon: "sunny-outline",
      target: 1,
      progress: 0,
      unlocked: false,
    },
  ];

  return configs.map((config) => buildAchievement(config, t));
}

export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = [
  "reflection",
  "mood",
  "ai_support",
  "self_care",
];
