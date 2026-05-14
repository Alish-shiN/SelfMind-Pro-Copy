export type AchievementStatus = "locked" | "in_progress" | "unlocked";

export type AchievementCategory = "easy" | "medium" | "hard" | "balance";

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
  aiChatCount?: number;
  aiChatDates?: string[];
  quizResultCount?: number;
  quizTypesCompleted?: string[];
  activeGoalCount?: number;
  completedGoalCount?: number;
  activeGoalCreatedDates?: string[];
  pausedGoal?: boolean;
  selfCareTemplateAdded?: boolean;
  gentleGoalDays?: number;
  recoveryPracticeCount?: number;
  trustedPersonPhone?: string | null;
  weeklySummaryViewed?: boolean;
  weeklySummaryCount?: number;
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

function uniqueDayCount(values: string[]) {
  return new Set(values.map(normalizeDateKey).filter(Boolean)).size;
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

function hasActiveGoalForDays(values: string[], targetDays: number) {
  const now = Date.now();
  const targetMs = targetDays * 24 * 60 * 60 * 1000;
  return values.some((value) => {
    const time = new Date(value).getTime();
    return !Number.isNaN(time) && now - time >= targetMs;
  });
}

function progressStatus(unlocked: boolean, progress = 0): AchievementStatus {
  if (unlocked) return "unlocked";
  return progress > 0 ? "in_progress" : "locked";
}

function capped(value: number, target: number) {
  return Math.min(Math.max(value, 0), target);
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
  const aiChatCount = input.aiChatCount ?? 0;
  const quizCount = input.quizResultCount ?? 0;
  const completedGoalCount = input.completedGoalCount ?? 0;
  const weeklySummaryCount = Math.max(
    input.weeklySummaryCount ?? 0,
    input.weeklySummaryViewed ? 1 : 0,
  );
  const threeDayReflection = hasConsecutiveDays(journalDates, 3);
  const sevenDayReflection = hasConsecutiveDays(journalDates, 7);
  const fourteenDayReflection = hasConsecutiveDays(journalDates, 14);
  const aiChatDays = uniqueDayCount(input.aiChatDates ?? []);
  const quizTypeCount = new Set(input.quizTypesCompleted ?? []).size;
  const activeGoalTwoWeeks = hasActiveGoalForDays(
    input.activeGoalCreatedDates ?? [],
    14,
  );

  // TODO: Replace locally stored event flags with backend-backed user events when
  // achievement telemetry is available across devices.
  const configs: AchievementConfig[] = [
    {
      id: "first-reflection",
      titleKey: "achievementFirstReflection",
      descriptionKey: "achievementFirstReflectionDesc",
      category: "easy",
      icon: "sparkles-outline",
      target: 1,
      progress: capped(journalCount, 1),
      unlocked: journalCount >= 1,
    },
    {
      id: "first-mood-check-in",
      titleKey: "achievementFirstMoodCheckIn",
      descriptionKey: "achievementFirstMoodCheckInDesc",
      category: "easy",
      icon: "happy-outline",
      target: 1,
      progress: capped(moodCount, 1),
      unlocked: moodCount >= 1,
    },
    {
      id: "first-ai-chat",
      titleKey: "achievementFirstAiChat",
      descriptionKey: "achievementFirstAiChatDesc",
      category: "easy",
      icon: "chatbubble-ellipses-outline",
      target: 1,
      progress: capped(aiChatCount, 1),
      unlocked: aiChatCount >= 1,
    },
    {
      id: "first-goal",
      titleKey: "achievementFirstGoal",
      descriptionKey: "achievementFirstGoalDesc",
      category: "easy",
      icon: "flag-outline",
      target: 1,
      progress: capped(input.activeGoalCount ?? 0, 1),
      unlocked: (input.activeGoalCount ?? 0) >= 1,
    },
    {
      id: "first-quiz",
      titleKey: "achievementFirstQuiz",
      descriptionKey: "achievementFirstQuizDesc",
      category: "easy",
      icon: "help-circle-outline",
      target: 1,
      progress: capped(quizCount, 1),
      unlocked: quizCount >= 1,
    },
    {
      id: "three-day-reflection",
      titleKey: "achievementThreeDayReflection",
      descriptionKey: "achievementThreeDayReflectionDesc",
      category: "medium",
      icon: "leaf-outline",
      target: 3,
      progress: capped(threeDayReflection.longest, 3),
      unlocked: threeDayReflection.hasStreak,
    },
    {
      id: "five-journal-entries",
      titleKey: "achievementFiveJournalEntries",
      descriptionKey: "achievementFiveJournalEntriesDesc",
      category: "medium",
      icon: "journal-outline",
      target: 5,
      progress: capped(journalCount, 5),
      unlocked: journalCount >= 5,
    },
    {
      id: "five-mood-check-ins",
      titleKey: "achievementFiveMoodCheckIns",
      descriptionKey: "achievementFiveMoodCheckInsDesc",
      category: "medium",
      icon: "analytics-outline",
      target: 5,
      progress: capped(moodCount, 5),
      unlocked: moodCount >= 5,
    },
    {
      id: "three-completed-goals",
      titleKey: "achievementThreeCompletedGoals",
      descriptionKey: "achievementThreeCompletedGoalsDesc",
      category: "medium",
      icon: "checkmark-done-outline",
      target: 3,
      progress: capped(completedGoalCount, 3),
      unlocked: completedGoalCount >= 3,
    },
    {
      id: "first-weekly-summary",
      titleKey: "achievementFirstWeeklySummary",
      descriptionKey: "achievementFirstWeeklySummaryDesc",
      category: "medium",
      icon: "document-text-outline",
      target: 1,
      progress: capped(weeklySummaryCount, 1),
      unlocked: weeklySummaryCount >= 1,
    },
    {
      id: "three-quiz-types",
      titleKey: "achievementThreeQuizTypes",
      descriptionKey: "achievementThreeQuizTypesDesc",
      category: "medium",
      icon: "library-outline",
      target: 3,
      progress: capped(quizTypeCount, 3),
      unlocked: quizTypeCount >= 3,
    },
    {
      id: "three-ai-chat-days",
      titleKey: "achievementThreeAiChatDays",
      descriptionKey: "achievementThreeAiChatDaysDesc",
      category: "medium",
      icon: "chatbubbles-outline",
      target: 3,
      progress: capped(aiChatDays, 3),
      unlocked: aiChatDays >= 3,
    },
    {
      id: "seven-day-reflection",
      titleKey: "achievementSevenDayReflection",
      descriptionKey: "achievementSevenDayReflectionDesc",
      category: "hard",
      icon: "calendar-clear-outline",
      target: 7,
      progress: capped(sevenDayReflection.longest, 7),
      unlocked: sevenDayReflection.hasStreak,
    },
    {
      id: "fourteen-day-reflection",
      titleKey: "achievementFourteenDayReflection",
      descriptionKey: "achievementFourteenDayReflectionDesc",
      category: "hard",
      icon: "calendar-outline",
      target: 14,
      progress: capped(fourteenDayReflection.longest, 14),
      unlocked: fourteenDayReflection.hasStreak,
    },
    {
      id: "twenty-journal-entries",
      titleKey: "achievementTwentyJournalEntries",
      descriptionKey: "achievementTwentyJournalEntriesDesc",
      category: "hard",
      icon: "book-outline",
      target: 20,
      progress: capped(journalCount, 20),
      unlocked: journalCount >= 20,
    },
    {
      id: "twenty-mood-check-ins",
      titleKey: "achievementTwentyMoodCheckIns",
      descriptionKey: "achievementTwentyMoodCheckInsDesc",
      category: "hard",
      icon: "pulse-outline",
      target: 20,
      progress: capped(moodCount, 20),
      unlocked: moodCount >= 20,
    },
    {
      id: "ten-completed-goals",
      titleKey: "achievementTenCompletedGoals",
      descriptionKey: "achievementTenCompletedGoalsDesc",
      category: "hard",
      icon: "trail-sign-outline",
      target: 10,
      progress: capped(completedGoalCount, 10),
      unlocked: completedGoalCount >= 10,
    },
    {
      id: "four-weekly-summaries",
      titleKey: "achievementFourWeeklySummaries",
      descriptionKey: "achievementFourWeeklySummariesDesc",
      category: "hard",
      icon: "documents-outline",
      target: 4,
      progress: capped(weeklySummaryCount, 4),
      unlocked: weeklySummaryCount >= 4,
    },
    {
      id: "active-goals-two-weeks",
      titleKey: "achievementActiveGoalsTwoWeeks",
      descriptionKey: "achievementActiveGoalsTwoWeeksDesc",
      category: "hard",
      icon: "hourglass-outline",
      target: 14,
      progress: activeGoalTwoWeeks ? 14 : 0,
      unlocked: activeGoalTwoWeeks,
    },
    {
      id: "took-a-pause",
      titleKey: "achievementTookPause",
      descriptionKey: "achievementTookPauseDesc",
      category: "balance",
      icon: "pause-circle-outline",
      target: 1,
      progress: input.pausedGoal ? 1 : 0,
      unlocked: Boolean(input.pausedGoal),
    },
    {
      id: "gentle-consistency",
      titleKey: "achievementGentleConsistency",
      descriptionKey: "achievementGentleConsistencyDesc",
      category: "balance",
      icon: "flower-outline",
      target: 3,
      progress: capped(input.gentleGoalDays ?? completedGoalCount, 3),
      unlocked: (input.gentleGoalDays ?? completedGoalCount) >= 3,
    },
    {
      id: "self-care-starter",
      titleKey: "achievementSelfCareStarter",
      descriptionKey: "achievementSelfCareStarterDesc",
      category: "balance",
      icon: "heart-outline",
      target: 1,
      progress: input.selfCareTemplateAdded ? 1 : 0,
      unlocked: Boolean(input.selfCareTemplateAdded),
    },
    {
      id: "recovery-focus",
      titleKey: "achievementRecoveryFocus",
      descriptionKey: "achievementRecoveryFocusDesc",
      category: "balance",
      icon: "moon-outline",
      target: 3,
      progress: capped(input.recoveryPracticeCount ?? 0, 3),
      unlocked: (input.recoveryPracticeCount ?? 0) >= 3,
    },
    {
      id: "support-contact-added",
      titleKey: "achievementSupportContactAdded",
      descriptionKey: "achievementSupportContactAddedDesc",
      category: "balance",
      icon: "shield-checkmark-outline",
      target: 1,
      progress: input.trustedPersonPhone?.trim() ? 1 : 0,
      unlocked: Boolean(input.trustedPersonPhone?.trim()),
    },
    {
      id: "privacy-ready",
      titleKey: "achievementPrivacyReady",
      descriptionKey: "achievementPrivacyReadyDesc",
      category: "balance",
      icon: "lock-closed-outline",
      target: 1,
      progress: input.privacyConfigured ? 1 : 0,
      unlocked: Boolean(input.privacyConfigured),
    },
  ];

  return configs.map((config) => buildAchievement(config, t));
}

export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = [
  "easy",
  "medium",
  "hard",
  "balance",
];
