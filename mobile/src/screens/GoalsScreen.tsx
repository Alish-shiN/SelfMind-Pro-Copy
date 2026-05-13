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

export function GoalsScreen() {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<GoalProgress[]>([]);
  const [summary, setSummary] = useState<WeeklyGoalSummary | null>(null);
  const [templates, setTemplates] = useState<GoalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [p, s, t] = await Promise.all([
        getGoalProgress(),
        getWeeklyGoalSummary(),
        getGoalTemplates(),
      ]);
      setProgress(p);
      setSummary(s);
      setTemplates(t);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("couldNotLoadGoals"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
          <Ionicons name="flag-outline" size={24} color={colors.coral} />
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
              {summary?.partially_completed_goals ?? 0} • {t("missed")}{" "}
              {summary?.missed_goals ?? 0}
            </Text>
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
