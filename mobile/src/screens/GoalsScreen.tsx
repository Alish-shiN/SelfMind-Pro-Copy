import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { getAiQuizHistory } from "../api/aiQuiz";
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
  getAchievementPrivacyReady,
  getAchievementWeeklyMoodReview,
  getAchievementWeeklySummaryCompleted,
  getTrustedPersonPhone,
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
    titleKey: "reflect3Times",
    descriptionKey: "reflect3TimesDesc",
    goal_type: "reflection" as const,
    target_count: 3,
    period: "weekly" as const,
  },
  {
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
    reflection: t("achievementCategoryReflection"),
    mood: t("achievementCategoryMood"),
    ai_support: t("achievementCategoryAiSupport"),
    self_care: t("achievementCategorySelfCare"),
  };
  return labels[category];
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
        trustedPhone,
        privacyReady,
        weeklyMoodReview,
        weeklySummaryCompleted,
      ] = await Promise.all([
        getGoalProgress(),
        getWeeklyGoalSummary(),
        getGoalTemplates(),
        getDashboardHome().catch(() => null),
        getAiQuizHistory(1).catch(() => []),
        getTrustedPersonPhone(),
        getAchievementPrivacyReady(),
        getAchievementWeeklyMoodReview(),
        getAchievementWeeklySummaryCompleted(),
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
      setAchievements(
        buildAchievements(
          {
            journalEntryCount,
            journalEntryDates: dashboard?.active_dates ?? [],
            moodEntryCount,
            aiInsightCount: dashboard?.latest_analysis ? 1 : 0,
            quizResultCount:
              quizHistory.length || dashboard?.latest_quiz_action_plan ? 1 : 0,
            trustedPersonPhone: trustedPhone,
            weeklyMoodReviewViewed: weeklyMoodReview,
            weeklySummaryViewed: weeklySummaryCompleted || Boolean(s),
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

  const run = async (action: () => Promise<unknown>, success: string) => {
    setSaving(true);
    try {
      await action();
      await load();
      Alert.alert(t("goalsTitle"), success);
    } catch (e) {
      Alert.alert(
        t("goalError"),
        e instanceof ApiError ? e.message : t("couldNotUpdateGoals"),
      );
    } finally {
      setSaving(false);
    }
  };

  const addTemplate = (template: GoalTemplate) =>
    run(
      () =>
        createGoal({
          title: template.title,
          description: template.description,
          goal_type: template.key === "custom" ? "custom" : template.goal_type,
          target_count: template.target_count,
          period: template.period,
          template_key: template.key,
        }),
      t("goalAdded"),
    );

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
              {summary?.supportive_message ?? t("chooseSmallGoal")}
            </Text>
            <Text style={styles.meta}>
              {t("completed")} {summary?.completed_goals ?? 0} • {t("partial")}{" "}
              {summary?.partially_completed_goals ?? 0} • {t("achievementStatusNotYet")}{" "}
              {summary?.missed_goals ?? 0}
            </Text>
          </View>

          <View style={styles.achievementsSection}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{t("achievements")}</Text>
                <Text style={styles.sectionSubtitle}>
                  {t("achievementsSubtitle")}
                </Text>
              </View>
              <Ionicons name="sparkles-outline" size={22} color={colors.coral} />
            </View>
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
          </View>

          <Text style={styles.sectionTitle}>{t("activeGoals")}</Text>
          {progress.length ? (
            progress.map((item) => (
              <View style={styles.card} key={item.goal.id}>
                <View style={styles.rowBetween}>
                  <Text style={styles.goalTitle}>{item.goal.title}</Text>
                  <Text style={styles.goalType}>{t(item.goal.goal_type)}</Text>
                </View>
                <Text style={styles.description}>{item.goal.description}</Text>
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
                <Text style={styles.message}>{item.message}</Text>
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
                      run(
                        () => updateGoal(item.goal.id, { is_active: false }),
                        t("goalPaused"),
                      )
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
          {starterGoalTemplates.map((goal) => (
            <Pressable
              key={goal.titleKey}
              style={styles.template}
              onPress={() =>
                run(
                  () =>
                    createGoal({
                      title: t(goal.titleKey),
                      description: t(goal.descriptionKey),
                      goal_type: goal.goal_type,
                      target_count: goal.target_count,
                      period: goal.period,
                    }),
                  t("goalAdded"),
                )
              }
              disabled={saving}
            >
              <Text style={styles.templateTitle}>{t(goal.titleKey)}</Text>
              <Text style={styles.description}>{t(goal.descriptionKey)}</Text>
            </Pressable>
          ))}

          <Text style={styles.sectionTitle}>{t("selfCareTemplates")}</Text>
          <View style={styles.templateGrid}>
            {templates.map((template) => (
              <Pressable
                key={template.key}
                style={styles.templateChip}
                onPress={() => addTemplate(template)}
                disabled={saving}
              >
                <Text style={styles.templateChipText}>{template.title}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
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
  achievementsSection: { marginBottom: 18 },
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
  templateTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  templateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  templateChip: {
    backgroundColor: "#FFF3F1",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.coral,
  },
  templateChipText: { color: colors.coral, fontWeight: "900", fontSize: 12 },
});
