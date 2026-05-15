import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ApiError } from "../api/client";
import { getDashboardHome } from "../api/dashboard";
import { getCurrentUser } from "../api/user";
import { getAiQuizHistory } from "../api/aiQuiz";
import { getMyChatSessions } from "../api/chat";
import {
  completeGoal,
  createGoal,
  deleteGoal,
  getGoalProgress,
  getGoalTemplates,
  getWeeklyGoalSummary,
  GoalProgress,
  GoalTemplate,
  updateGoal,
  WeeklyGoalSummary,
} from "../api/goals";
import { colors } from "../theme/colors";
import { useTranslation } from "../i18n/I18nContext";
import {
  getAchievementGoalPaused,
  getAchievementPrivacyReady,
  getAchievementWeeklyMoodReview,
  getAchievementWeeklySummaryCompleted,
  getTrustedPersonPhone,
  setAchievementGoalPaused,
  setAchievementWeeklySummaryCompleted,
} from "../lib/storage";
import {
  Achievement,
  AchievementCategory,
  ACHIEVEMENT_CATEGORIES,
  buildAchievements,
} from "../utils/achievements";

const starterGoalTemplates = [
  {
    key: "reflect_3_times",
    titleKey: "reflect3Times",
    descriptionKey: "reflect3TimesDesc",
    goal_type: "reflection" as const,
    target_count: 3,
    period: "weekly" as const,
  },
  {
    key: "track_mood_5_times",
    titleKey: "trackMood5Times",
    descriptionKey: "trackMood5TimesDesc",
    goal_type: "mood_tracking" as const,
    target_count: 5,
    period: "weekly" as const,
  },
];

function achievementCategoryLabel(
  category: AchievementCategory,
  t: (key: string) => string,
) {
  const labels: Record<AchievementCategory, string> = {
    easy: t("achievementCategoryEasy"),
    medium: t("achievementCategoryMedium"),
    hard: t("achievementCategoryHard"),
    balance: t("achievementCategoryBalance"),
  };
  return labels[category];
}

const SELF_CARE_TEMPLATE_TRANSLATION_KEYS: Record<
  string,
  { title: string; description: string }
> = {
  mindful_breathing: {
    title: "goalTemplateMindfulBreathingTitle",
    description: "goalTemplateMindfulBreathingDesc",
  },
  short_walk: {
    title: "goalTemplateShortWalkTitle",
    description: "goalTemplateShortWalkDesc",
  },
  sleep_reflection: {
    title: "goalTemplateSleepReflectionTitle",
    description: "goalTemplateSleepReflectionDesc",
  },
  gratitude_note: {
    title: "goalTemplateGratitudeNoteTitle",
    description: "goalTemplateGratitudeNoteDesc",
  },
  water_intake: {
    title: "goalTemplateWaterIntakeTitle",
    description: "goalTemplateWaterIntakeDesc",
  },
  screen_break: {
    title: "goalTemplateScreenBreakTitle",
    description: "goalTemplateScreenBreakDesc",
  },
  talk_to_someone: {
    title: "goalTemplateTalkToSomeoneTitle",
    description: "goalTemplateTalkToSomeoneDesc",
  },
  custom: {
    title: "goalTemplateCustomSelfCareTitle",
    description: "goalTemplateCustomSelfCareDesc",
  },
  reflect_3_times: {
    title: "reflect3Times",
    description: "reflect3TimesDesc",
  },
  track_mood_5_times: {
    title: "trackMood5Times",
    description: "trackMood5TimesDesc",
  },
};

const LEGACY_GOAL_TITLE_KEYS: Record<
  string,
  { title: string; description: string }
> = {
  "reflect 3 times this week":
    SELF_CARE_TEMPLATE_TRANSLATION_KEYS.reflect_3_times,
  "track mood 5 times": SELF_CARE_TEMPLATE_TRANSLATION_KEYS.track_mood_5_times,
  "mindful breathing": SELF_CARE_TEMPLATE_TRANSLATION_KEYS.mindful_breathing,
  "short walk": SELF_CARE_TEMPLATE_TRANSLATION_KEYS.short_walk,
  "sleep reflection": SELF_CARE_TEMPLATE_TRANSLATION_KEYS.sleep_reflection,
  "gratitude note": SELF_CARE_TEMPLATE_TRANSLATION_KEYS.gratitude_note,
  "water intake": SELF_CARE_TEMPLATE_TRANSLATION_KEYS.water_intake,
  "screen break": SELF_CARE_TEMPLATE_TRANSLATION_KEYS.screen_break,
  "talk to someone": SELF_CARE_TEMPLATE_TRANSLATION_KEYS.talk_to_someone,
  "custom self-care goal": SELF_CARE_TEMPLATE_TRANSLATION_KEYS.custom,
};

function normalizeGoalLookup(value?: string | null) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function templateTranslation(goal: {
  template_key?: string | null;
  title?: string | null;
}) {
  if (
    goal.template_key &&
    SELF_CARE_TEMPLATE_TRANSLATION_KEYS[goal.template_key]
  ) {
    return SELF_CARE_TEMPLATE_TRANSLATION_KEYS[goal.template_key];
  }
  return LEGACY_GOAL_TITLE_KEYS[normalizeGoalLookup(goal.title)];
}

function localizedGoalTitle(
  goal: { template_key?: string | null; title?: string | null },
  t: (key: string) => string,
) {
  const keys = templateTranslation(goal);
  return keys
    ? t(keys.title)
    : goal.title || t("goalTemplateCustomSelfCareTitle");
}

function localizedGoalDescription(
  goal: {
    template_key?: string | null;
    title?: string | null;
    description?: string | null;
  },
  t: (key: string) => string,
) {
  const keys = templateTranslation(goal);
  return keys
    ? t(keys.description)
    : goal.description || t("goalNoDescription");
}

function localizedProgressMessage(
  item: GoalProgress,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const periodKey = item.goal.period === "daily" ? "today" : "thisWeek";
  if (item.goal.goal_type === "reflection") {
    return item.current_count
      ? t("goalProgressReflection", {
          count: item.current_count,
          period: t(periodKey),
        })
      : t("goalProgressReflectionEmpty");
  }
  if (item.goal.goal_type === "mood_tracking") {
    return item.current_count
      ? t("goalProgressMood", {
          count: item.current_count,
          period: t(periodKey),
        })
      : t("goalProgressMoodEmpty");
  }
  if (item.is_completed) return t("goalProgressCompleted");
  if (item.current_count)
    return t("goalProgressSteps", { count: item.current_count });
  return t("goalProgressEmpty");
}

function localizedSummaryMessage(
  summary: WeeklyGoalSummary | null,
  t: (key: string) => string,
) {
  if (!summary || summary.active_goals === 0)
    return t("weeklySummaryEmptyDesc");
  if (summary.completed_goals === summary.active_goals)
    return t("weeklySummaryCompleteDesc");
  if (summary.completed_goals || summary.partially_completed_goals)
    return t("weeklySummaryProgressDesc");
  return t("weeklySummaryFreshDesc");
}

function AddStateButton({
  label,
  addedLabel,
  loading,
  added,
}: {
  label: string;
  addedLabel: string;
  loading: boolean;
  added: boolean;
}) {
  return (
    <View
      style={[
        styles.addBadge,
        added && styles.addBadgeAdded,
        loading && styles.addBadgeLoading,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.coral} />
      ) : (
        <>
          <Ionicons
            name={added ? "checkmark" : "add"}
            size={15}
            color={added ? "#fff" : colors.coral}
          />
          <Text
            style={[styles.addBadgeText, added && styles.addBadgeTextAdded]}
          >
            {added ? addedLabel : label}
          </Text>
        </>
      )}
    </View>
  );
}

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const { t } = useTranslation();
  const isCompleted = achievement.status === "unlocked";
  const isInProgress = achievement.status === "in_progress";
  const statusText = isCompleted
    ? t("achievementStatusCompleted")
    : isInProgress
      ? t("achievementStatusInProgress")
      : t("achievementStatusNotYet");
  const encouragement = isCompleted
    ? t("achievementEncouragementShowedUp")
    : isInProgress
      ? t("achievementEncouragementAwareness")
      : t("achievementEncouragementSmallSteps");
  const progressText =
    achievement.target && achievement.progress != null
      ? `${Math.min(achievement.progress, achievement.target)}/${achievement.target}`
      : null;

  return (
    <View
      style={[
        styles.achievementCard,
        isCompleted && styles.achievementCardCompleted,
      ]}
    >
      <View style={styles.achievementTopRow}>
        <View
          style={[
            styles.achievementIconWrap,
            isCompleted && styles.achievementIconCompleted,
          ]}
        >
          <Ionicons
            name={achievement.icon as keyof typeof Ionicons.glyphMap}
            size={20}
            color={isCompleted ? colors.coral : colors.textMuted}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.achievementTitle}>{achievement.title}</Text>
          <Text style={styles.achievementDescription}>
            {achievement.description}
          </Text>
        </View>
        <Text
          style={[
            styles.achievementStatus,
            isCompleted && styles.achievementStatusCompleted,
            isInProgress && styles.achievementStatusProgress,
          ]}
        >
          {statusText}
        </Text>
      </View>
      {progressText ? (
        <View style={styles.achievementProgressRow}>
          <View style={styles.achievementProgressTrack}>
            <View
              style={[
                styles.achievementProgressFill,
                {
                  width: `${Math.min(
                    ((achievement.progress ?? 0) / achievement.target) * 100,
                    100,
                  )}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.achievementProgressText}>{progressText}</Text>
        </View>
      ) : null}
      <Text style={styles.achievementEncouragement}>{encouragement}</Text>
    </View>
  );
}

export function GoalsScreen() {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<GoalProgress[]>([]);
  const [summary, setSummary] = useState<WeeklyGoalSummary | null>(null);
  const [templates, setTemplates] = useState<GoalTemplate[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [addedKey, setAddedKey] = useState<string | null>(null);
  const [achievementsVisible, setAchievementsVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [
        p,
        s,
        templatesData,
        dashboard,
        quizHistory,
        chatSessions,
        currentUser,
        privacyReady,
        weeklyMoodReview,
        weeklySummaryCompleted,
        goalPaused,
      ] = await Promise.all([
        getGoalProgress(),
        getWeeklyGoalSummary(),
        getGoalTemplates(),
        getDashboardHome().catch(() => null),
        getAiQuizHistory(100).catch(() => []),
        getMyChatSessions().catch(() => []),
        getCurrentUser().catch(() => null),
        getAchievementPrivacyReady(),
        getAchievementWeeklyMoodReview(),
        getAchievementWeeklySummaryCompleted(),
        getAchievementGoalPaused(),
      ]);
      if (s) {
        void setAchievementWeeklySummaryCompleted();
      }
      setProgress(p);
      setSummary(s);
      setTemplates(templatesData);
      const reflectionProgress = p.find(
        (item) => item.goal.goal_type === "reflection",
      );
      const moodProgress = p.find(
        (item) => item.goal.goal_type === "mood_tracking",
      );
      const journalEntryCount =
        dashboard?.stats.total_entries ??
        reflectionProgress?.current_count ??
        0;
      const moodEntryCount =
        dashboard?.stats.total_entries ?? moodProgress?.current_count ?? 0;
      const completedGoalCount =
        s?.completed_goals ?? p.filter((item) => item.is_completed).length;
      const selfCareTemplateAdded = p.some(
        (item) =>
          item.goal.goal_type === "self_care" &&
          Boolean(item.goal.template_key),
      );
      const recoveryPracticeCount = p
        .filter((item) =>
          ["mindful_breathing", "sleep_reflection", "screen_break"].includes(
            item.goal.template_key || "",
          ),
        )
        .reduce((total, item) => total + item.current_count, 0);
      setAchievements(
        buildAchievements(
          {
            journalEntryCount,
            journalEntryDates: dashboard?.active_dates ?? [],
            moodEntryCount,
            aiChatCount: chatSessions.length,
            aiChatDates: chatSessions.map((session) => session.created_at),
            quizResultCount:
              quizHistory.length || dashboard?.latest_quiz_action_plan ? 1 : 0,
            quizTypesCompleted: quizHistory.map((item) => item.quiz_type),
            activeGoalCount: p.length,
            completedGoalCount,
            activeGoalCreatedDates: p.map((item) => item.goal.created_at),
            pausedGoal: goalPaused,
            selfCareTemplateAdded,
            gentleGoalDays: completedGoalCount,
            recoveryPracticeCount,
            trustedPersonPhone: currentUser
              ? await getTrustedPersonPhone(currentUser.id)
              : null,
            weeklyMoodReviewViewed: weeklyMoodReview,
            weeklySummaryViewed: weeklySummaryCompleted || Boolean(s),
            weeklySummaryCount: weeklySummaryCompleted || Boolean(s) ? 1 : 0,
            privacyConfigured: privacyReady,
          },
          t,
        ),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("couldNotLoadGoals"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (
    action: () => Promise<unknown>,
    success: string,
    options?: { feedbackKey?: string; silentSuccess?: boolean },
  ) => {
    setSaving(true);
    if (options?.feedbackKey) {
      setSavingKey(options.feedbackKey);
      setAddedKey(null);
    }
    try {
      await action();
      await load();
      if (options?.feedbackKey) {
        setAddedKey(options.feedbackKey);
        setTimeout(
          () =>
            setAddedKey((current) =>
              current === options.feedbackKey ? null : current,
            ),
          1600,
        );
      }
      if (!options?.silentSuccess) {
        Alert.alert(t("goalsTitle"), success);
      }
    } catch (e) {
      Alert.alert(
        t("goalError"),
        e instanceof ApiError ? e.message : t("couldNotUpdateGoals"),
      );
    } finally {
      setSaving(false);
      if (options?.feedbackKey) setSavingKey(null);
    }
  };

  const addTemplate = (template: GoalTemplate) => {
    const keys = SELF_CARE_TEMPLATE_TRANSLATION_KEYS[template.key];
    return run(
      () =>
        createGoal({
          title: keys ? t(keys.title) : template.title,
          description: keys ? t(keys.description) : template.description,
          goal_type: template.key === "custom" ? "custom" : template.goal_type,
          target_count: template.target_count,
          period: template.period,
          template_key: template.key,
        }),
      t("goalAdded"),
      { feedbackKey: `template:${template.key}`, silentSuccess: true },
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>{t("selfImprovement")}</Text>
          <Text style={styles.title}>{t("goalsTitle")}</Text>
        </View>
        {saving ? (
          <ActivityIndicator color={colors.coral} />
        ) : (
          <Ionicons name="sparkles-outline" size={24} color={colors.coral} />
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.coral} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>{t("weeklySummary")}</Text>
            <Text style={styles.percent}>
              {summary?.overall_completion_percentage ?? 0}%
            </Text>
            <Text style={styles.message}>
              {localizedSummaryMessage(summary, t)}
            </Text>
            <Text style={styles.meta}>
              {t("completed")} {summary?.completed_goals ?? 0} • {t("partial")}{" "}
              {summary?.partially_completed_goals ?? 0} •{" "}
              {t("achievementStatusNotYet")} {summary?.missed_goals ?? 0}
            </Text>
          </View>

          <Pressable
            style={styles.achievementEntryCard}
            onPress={() => setAchievementsVisible(true)}
          >
            <View style={styles.achievementEntryIcon}>
              <Ionicons
                name="sparkles-outline"
                size={22}
                color={colors.coral}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.achievementEntryTitle}>
                {t("achievements")}
              </Text>
              <Text style={styles.achievementEntrySubtitle}>
                {t("achievementsEntrySubtitle")}
              </Text>
              <Text style={styles.achievementEntryMeta}>
                {t("achievementsUnlockedCount", {
                  unlocked: achievements.filter(
                    (item) => item.status === "unlocked",
                  ).length,
                  total: achievements.length,
                })}
              </Text>
            </View>
            <View style={styles.achievementEntryAction}>
              <Text style={styles.achievementEntryActionText}>
                {t("viewAchievements")}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.coral} />
            </View>
          </Pressable>

          <Text style={styles.sectionTitle}>{t("activeGoals")}</Text>
          {progress.length ? (
            progress.map((item) => (
              <View style={styles.card} key={item.goal.id}>
                <View style={styles.rowBetween}>
                  <Text style={styles.goalTitle}>
                    {localizedGoalTitle(item.goal, t)}
                  </Text>
                  <Text style={styles.goalType}>{t(item.goal.goal_type)}</Text>
                </View>
                <Text style={styles.description}>
                  {localizedGoalDescription(item.goal, t)}
                </Text>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.min(item.progress_percentage, 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.meta}>
                  {item.current_count}/{item.target_count} •{" "}
                  {item.progress_percentage}%
                </Text>
                <Text style={styles.message}>
                  {localizedProgressMessage(item, t)}
                </Text>
                <View style={styles.actions}>
                  {item.goal.goal_type === "self_care" ||
                  item.goal.goal_type === "custom" ? (
                    <Pressable
                      style={styles.smallBtn}
                      onPress={() =>
                        run(
                          () => completeGoal(item.goal.id),
                          t("completionAdded"),
                        )
                      }
                      disabled={saving}
                    >
                      <Text style={styles.smallBtnText}>{t("markDone")}</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={styles.smallBtnLight}
                    onPress={() =>
                      run(async () => {
                        await updateGoal(item.goal.id, { is_active: false });
                        await setAchievementGoalPaused();
                      }, t("goalPaused"))
                    }
                    disabled={saving}
                  >
                    <Text style={styles.smallBtnLightText}>{t("pause")}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.smallBtnDanger}
                    onPress={() =>
                      run(() => deleteGoal(item.goal.id), t("goalDeleted"))
                    }
                    disabled={saving}
                  >
                    <Text style={styles.smallBtnText}>{t("delete")}</Text>
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>{t("noActiveGoals")}</Text>
          )}

          <Text style={styles.sectionTitle}>{t("quickGoals")}</Text>
          {starterGoalTemplates.map((goal) => {
            const feedbackKey = `quick:${goal.key}`;
            const isSaving = savingKey === feedbackKey;
            const isAdded = addedKey === feedbackKey;
            return (
              <Pressable
                key={goal.key}
                style={({ pressed }) => [
                  styles.template,
                  pressed && !saving ? styles.templatePressed : null,
                  isAdded ? styles.templateAdded : null,
                ]}
                onPress={() =>
                  run(
                    () =>
                      createGoal({
                        title: t(goal.titleKey),
                        description: t(goal.descriptionKey),
                        goal_type: goal.goal_type,
                        target_count: goal.target_count,
                        period: goal.period,
                        template_key: goal.key,
                      }),
                    t("goalAdded"),
                    { feedbackKey, silentSuccess: true },
                  )
                }
                disabled={saving}
              >
                <View style={styles.templateTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.templateTitle}>{t(goal.titleKey)}</Text>
                    <Text style={styles.description}>
                      {t(goal.descriptionKey)}
                    </Text>
                  </View>
                  <AddStateButton
                    label={t("add")}
                    addedLabel={t("added")}
                    loading={isSaving}
                    added={isAdded}
                  />
                </View>
              </Pressable>
            );
          })}

          <Text style={styles.sectionTitle}>{t("selfCareTemplates")}</Text>
          <Text style={styles.sectionSubtitle}>
            {t("selfCareTemplatesSub")}
          </Text>
          <View style={styles.templateGrid}>
            {templates.map((template) => {
              const keys = SELF_CARE_TEMPLATE_TRANSLATION_KEYS[template.key];
              const feedbackKey = `template:${template.key}`;
              const isSaving = savingKey === feedbackKey;
              const isAdded = addedKey === feedbackKey;
              return (
                <Pressable
                  key={template.key}
                  style={({ pressed }) => [
                    styles.templateChip,
                    pressed && !saving ? styles.templateChipPressed : null,
                    isAdded ? styles.templateChipAdded : null,
                  ]}
                  onPress={() => addTemplate(template)}
                  disabled={saving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={colors.coral} />
                  ) : (
                    <Text
                      style={[
                        styles.templateChipText,
                        isAdded && styles.templateChipTextAdded,
                      ]}
                    >
                      {isAdded
                        ? t("added")
                        : keys
                          ? t(keys.title)
                          : template.title}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      <Modal
        visible={achievementsVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAchievementsVisible(false)}
      >
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>
                {t("achievementsEntrySubtitle")}
              </Text>
              <Text style={styles.title}>{t("achievements")}</Text>
            </View>
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setAchievementsVisible(false)}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <Text style={styles.sectionSubtitle}>
              {t("achievementsUnlockedCount", {
                unlocked: achievements.filter(
                  (item) => item.status === "unlocked",
                ).length,
                total: achievements.length,
              })}
            </Text>
            {ACHIEVEMENT_CATEGORIES.map((category) => {
              const categoryAchievements = achievements.filter(
                (achievement) => achievement.category === category,
              );
              if (!categoryAchievements.length) return null;
              return (
                <View key={category} style={styles.achievementCategoryBlock}>
                  <Text style={styles.achievementCategoryTitle}>
                    {achievementCategoryLabel(category, t)}
                  </Text>
                  {categoryAchievements.map((achievement) => (
                    <AchievementCard
                      key={achievement.id}
                      achievement={achievement}
                    />
                  ))}
                </View>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSoft },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  kicker: { color: colors.textMuted, fontWeight: "800", fontSize: 13 },
  title: { color: colors.text, fontWeight: "900", fontSize: 28 },
  scroll: { padding: 16, paddingBottom: 36 },
  error: {
    backgroundColor: "#FFE5E5",
    color: "#B91C1C",
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
    fontWeight: "700",
  },
  summaryCard: {
    backgroundColor: colors.coral,
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
  },
  percent: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "900",
    marginVertical: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.text,
    marginBottom: 10,
    marginTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: -4,
  },
  achievementEntryCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#E8ECF4",
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  achievementEntryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF3F1",
  },
  achievementEntryTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  achievementEntrySubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    marginTop: 2,
  },
  achievementEntryMeta: {
    color: colors.coral,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 6,
  },
  achievementEntryAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
    width: 92,
  },
  achievementEntryActionText: {
    color: colors.coral,
    fontSize: 12,
    fontWeight: "900",
    flexShrink: 1,
    flexWrap: "wrap",
    lineHeight: 14,
    textAlign: "right",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E8ECF4",
  },
  modalScroll: { padding: 16, paddingBottom: 36 },
  achievementCategoryBlock: { marginBottom: 12 },
  achievementCategoryTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  achievementCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E8ECF4",
  },
  achievementCardCompleted: {
    borderColor: "#FFD9D1",
    backgroundColor: "#FFFDFC",
  },
  achievementTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  achievementIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F7FA",
  },
  achievementIconCompleted: { backgroundColor: "#FFF3F1" },
  achievementTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  achievementDescription: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
    fontWeight: "600",
  },
  achievementStatus: {
    color: colors.textMuted,
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: "900",
  },
  achievementStatusCompleted: {
    color: colors.coral,
    backgroundColor: "#FFF3F1",
  },
  achievementStatusProgress: { color: colors.text, backgroundColor: "#EEF2FF" },
  achievementProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  achievementProgressTrack: {
    flex: 1,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#EEF2F7",
    overflow: "hidden",
  },
  achievementProgressFill: {
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.accentGreen,
  },
  achievementProgressText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
  },
  achievementEncouragement: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    marginTop: 10,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E8ECF4",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  goalTitle: { flex: 1, fontSize: 16, fontWeight: "900", color: colors.text },
  goalType: {
    color: colors.coral,
    fontWeight: "900",
    fontSize: 12,
    textTransform: "capitalize",
  },
  description: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  progressTrack: {
    height: 8,
    backgroundColor: "#EEF2F7",
    borderRadius: 999,
    marginTop: 12,
    overflow: "hidden",
  },
  progressFill: { height: 8, backgroundColor: colors.coral, borderRadius: 999 },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 8,
  },
  message: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 8,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  smallBtn: {
    backgroundColor: colors.coral,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallBtnDanger: {
    backgroundColor: "#B91C1C",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallBtnLight: {
    backgroundColor: "#FFF3F1",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallBtnText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  smallBtnLightText: { color: colors.coral, fontWeight: "900", fontSize: 12 },
  empty: { color: colors.textMuted, fontWeight: "700", marginBottom: 14 },
  template: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E8ECF4",
  },
  templatePressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  templateAdded: {
    borderColor: colors.accentGreen,
    backgroundColor: "#F4FBF7",
  },
  templateTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  templateTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  templateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  templateChip: {
    backgroundColor: "#FFF3F1",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.coral,
    minHeight: 36,
    justifyContent: "center",
  },
  templateChipPressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
  templateChipAdded: {
    backgroundColor: colors.accentGreen,
    borderColor: colors.accentGreen,
  },
  templateChipPressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
  templateChipAdded: { backgroundColor: colors.accentGreen, borderColor: colors.accentGreen },
  templateChipText: { color: colors.coral, fontWeight: "900", fontSize: 12 },
  templateChipTextAdded: { color: "#fff" },
  addBadge: {
    minWidth: 76,
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.coral,
    backgroundColor: "#FFF3F1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addBadgeLoading: { backgroundColor: "#FFF9F7" },
  addBadgeAdded: {
    backgroundColor: colors.accentGreen,
    borderColor: colors.accentGreen,
  },
  addBadgeText: { color: colors.coral, fontWeight: "900", fontSize: 12 },
  addBadgeTextAdded: { color: "#fff" },
});
