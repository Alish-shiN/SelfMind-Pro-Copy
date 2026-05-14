import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getDashboardHome, DashboardHome } from "../api/dashboard";
import { getMoodAnalytics, MoodAnalytics } from "../api/analytics";
import { ApiError } from "../api/client";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { languageLocales, useTranslation } from "../i18n/I18nContext";
import { setAchievementWeeklyMoodReview } from "../lib/storage";

const MOOD_EMOJI: Record<string, string> = {
  joy: "😊",
  calm: "😌",
  stress: "😤",
  anxiety: "😰",
  sadness: "😢",
  anger: "😠",
  neutral: "😐",
};

const PERIOD_OPTIONS = ["7d", "30d", "90d"] as const;
type AnalyticsPeriod = (typeof PERIOD_OPTIONS)[number];
type AnalyticsGranularity = "day" | "week" | "month";

const EMOTION_LABEL_KEYS: Record<string, string> = {
  joy: "emotionJoy",
  happy: "emotionJoy",
  happiness: "emotionJoy",
  calm: "emotionCalm",
  stress: "emotionStress",
  stressed: "emotionStress",
  anxiety: "emotionAnxiety",
  anxious: "emotionAnxiety",
  sadness: "emotionSadness",
  sad: "emotionSadness",
  anger: "emotionAnger",
  angry: "emotionAnger",
  neutral: "emotionNeutral",
};

const SENTIMENT_LABEL_KEYS: Record<string, string> = {
  positive: "sentimentPositive",
  neutral: "sentimentNeutral",
  negative: "sentimentNegative",
  mixed: "sentimentMixed",
};
function moodColor(score: number | null) {
  if (score == null) return "#E5E7EB";
  if (score >= 7) return "#34A853";
  if (score >= 5) return "#FBBC04";
  return "#EE715F";
}

function emotionColor(emotion: string | null) {
  switch ((emotion || "").toLowerCase()) {
    case "joy":
      return "#FDE68A";
    case "calm":
      return "#BFDBFE";
    case "stress":
      return "#FDBA74";
    case "anxiety":
      return "#DDD6FE";
    case "sadness":
      return "#A7F3D0";
    case "anger":
      return "#FCA5A5";
    default:
      return "#E5E7EB";
  }
}

function normalizeLabel(value?: string | null) {
  return (value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function translatedEmotionLabel(value: string | null | undefined, t: (key: string) => string) {
  const normalized = normalizeLabel(value);
  const key = EMOTION_LABEL_KEYS[normalized];
  return key ? t(key) : value || t("emotionNeutral");
}

function translatedSentimentLabel(value: string | null | undefined, t: (key: string) => string) {
  const normalized = normalizeLabel(value);
  const key = SENTIMENT_LABEL_KEYS[normalized];
  return key ? t(key) : value || t("sentimentNeutral");
}

function granularityForPeriod(period: AnalyticsPeriod): AnalyticsGranularity {
  if (period === "7d") return "day";
  if (period === "30d") return "week";
  return "month";
}

function periodLabel(period: AnalyticsPeriod, t: (key: string) => string) {
  if (period === "7d") return t("last7Days");
  if (period === "30d") return t("last30Days");
  return t("last90Days");
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatShortDate(value: string, locale: string, options?: Intl.DateTimeFormatOptions) {
  return parseDate(value).toLocaleDateString(
    locale,
    options ?? { month: "short", day: "numeric" },
  );
}

function formatTrendLabel(
  point: MoodAnalytics["mood_history"][number],
  granularity: AnalyticsGranularity,
  locale: string,
) {
  if (granularity === "month") {
    return formatShortDate(point.period_start, locale, { month: "short" });
  }
  if (granularity === "week") {
    return `${formatShortDate(point.period_start, locale)}–${formatShortDate(
      point.period_end,
      locale,
    )}`;
  }
  return formatShortDate(point.period_start, locale);
}

function translatedInsightTitle(value: string, t: (key: string) => string) {
  switch (normalizeLabel(value)) {
    case "mood_baseline":
      return t("moodBaselineInsight");
    case "mood_trend":
      return t("moodTrendInsight");
    case "top_emotion":
      return t("topEmotionInsight");
    case "journaling_consistency":
      return t("journalingConsistencyInsight");
    case "mood_vs_journaling_frequency":
      return t("moodVsJournalingFrequency");
    case "mood_vs_quiz_severity":
      return t("moodVsQuizSeverity");
    default:
      return value;
  }
}

function translatedCorrelationStrength(value: string, t: (key: string) => string) {
  switch (normalizeLabel(value)) {
    case "strong":
      return t("correlationStrong");
    case "moderate":
      return t("correlationModerate");
    case "weak":
      return t("correlationWeak");
    case "minimal":
      return t("correlationMinimal");
    case "insufficient_data":
      return t("correlationInsufficientData");
    default:
      return value;
  }
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value ?? "—"}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MoodBar({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 7 ? "#34A853" : score >= 5 ? "#FBBC04" : "#EE715F";
  return (
    <View style={styles.moodBarWrap}>
      <View
        style={[
          styles.moodBarFill,
          { width: `${pct}%` as any, backgroundColor: color },
        ]}
      />
    </View>
  );
}

function DashboardMoodTrendChart({
  points,
  granularity,
  locale,
}: {
  points: MoodAnalytics["mood_history"];
  granularity: AnalyticsGranularity;
  locale: string;
}) {
  const visible = points.slice(-12);
  const maxMood = 10;
  return (
    <View style={styles.trendChart}>
      {visible.map((point) => {
        const height =
          point.average_mood == null
            ? 8
            : Math.max(8, (point.average_mood / maxMood) * 92);
        return (
          <View key={point.period_start} style={styles.trendItem}>
            <View style={styles.trendBarTrack}>
              <View
                style={[
                  styles.trendBarFill,
                  {
                    height: `${height}%` as any,
                    backgroundColor: moodColor(point.average_mood),
                  },
                ]}
              />
            </View>
            <Text style={styles.trendLabel} numberOfLines={2}>
              {formatTrendLabel(point, granularity, locale)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function DashboardMiniHeatmap({
  days,
  locale,
}: {
  days: MoodAnalytics["emotion_heatmap"];
  locale: string;
}) {
  const visible = days.slice(-35);
  const first = visible[0];
  const last = visible[visible.length - 1];

  return (
    <View>
      <View style={styles.heatmapGrid}>
        {visible.map((day) => (
          <View
            key={day.date}
            style={[
              styles.heatmapCell,
              {
                backgroundColor: emotionColor(day.dominant_emotion),
                opacity:
                  day.entries_count > 0 ? Math.max(0.35, day.intensity) : 0.25,
              },
            ]}
          />
        ))}
      </View>
      {first && last ? (
        <View style={styles.heatmapRangeRow}>
          <Text style={styles.heatmapRangeText}>
            {formatShortDate(first.date, locale)}
          </Text>
          <Text style={styles.heatmapRangeText}>
            {formatShortDate(last.date, locale)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function DashboardScreen({ navigation }: { navigation: any }) {
  const { signOut } = useAuth();
  const { t, language } = useTranslation();
  const locale = languageLocales[language as keyof typeof languageLocales];
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardHome | null>(null);
  const [analytics, setAnalytics] = useState<MoodAnalytics | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] =
    useState<AnalyticsPeriod>("30d");
  const analyticsGranularity = granularityForPeriod(analyticsPeriod);

  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  const monthDays = (() => {
    const year = monthCursor.getFullYear();
    const monthIndex = monthCursor.getMonth();
    const first = new Date(year, monthIndex, 1);
    const startOffset = first.getDay(); // Sunday=0
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    const cells: Array<number | null> = [];
    for (let i = 0; i < 42; i += 1) {
      const dayNum = i - startOffset + 1;
      cells.push(dayNum >= 1 && dayNum <= daysInMonth ? dayNum : null);
    }
    return { year, monthIndex, cells };
  })();

  const selectedKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(
    selectedDate.getDate(),
  ).padStart(2, "0")}`;
  const activeDateSet = new Set(data?.active_dates ?? []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [d, moodAnalytics] = await Promise.all([
        getDashboardHome(),
        getMoodAnalytics(analyticsPeriod, analyticsGranularity),
      ]);
      setData(d);
      setAnalytics(moodAnalytics);
      void setAchievementWeeklyMoodReview();
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        await signOut("sessionExpired");
        setError(null);
        return;
      }
      setError(e instanceof ApiError ? e.message : t("couldNotLoadProfile"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [analyticsGranularity, analyticsPeriod, signOut]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  useEffect(() => {
    // Refresh calendar after coming back from AiDiary.
    const sub = navigation?.addListener?.("focus", () => {
      load();
    });
    return () => {
      sub?.();
    };
  }, [navigation, load]);

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.coral} />
        </View>
      </SafeAreaView>
    );
  }

  const analysis = data?.latest_analysis;
  const stats = data?.stats;
  const emojiKey = normalizeLabel(analysis?.emotion_label) as keyof typeof MOOD_EMOJI;
  const emoji = MOOD_EMOJI[emojiKey] || "😐";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>{t("dashboardGreeting")}</Text>
            <Text style={styles.headerName}>
              {data?.user.username ?? t("userFallback")} 👋
            </Text>
          </View>
          <Pressable
            style={styles.avatarCircle}
            onPress={() => navigation.navigate("Profile")}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={styles.avatarText}>
              {(data?.user.username?.[0] ?? "U").toUpperCase()}
            </Text>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryText}>{t("retry")}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Mood card */}
        <View style={styles.moodCard}>
          <View style={styles.moodLeft}>
            <Text style={styles.moodCardLabel}>{t("currentMood")}</Text>
            <Text style={styles.moodCardEmotion}>
              {analysis
                ? translatedEmotionLabel(analysis.emotion_label, t)
                : t("noDataYet")}
            </Text>
            {analysis && (
              <View style={styles.sentimentPill}>
                <Text style={styles.sentimentText}>
                  {translatedSentimentLabel(analysis.sentiment_label, t)}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.moodBigEmoji}>{emoji}</Text>
        </View>

        {/* Calendar */}
        <View style={styles.section}>
          <View style={styles.calTopRow}>
            <Pressable
              hitSlop={12}
              onPress={() =>
                setMonthCursor(
                  (d) => new Date(d.getFullYear(), d.getMonth() - 1, 1),
                )
              }
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
            <Text style={styles.calTitle}>
              {monthCursor.toLocaleDateString(locale, {
                month: "long",
                year: "numeric",
              })}
            </Text>
            <Pressable
              hitSlop={12}
              onPress={() =>
                setMonthCursor(
                  (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1),
                )
              }
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          </View>

          <View style={styles.calDowRow}>
            {Array.from({ length: 7 }, (_, idx) =>
              new Date(2024, 0, 7 + idx)
                .toLocaleDateString(locale, { weekday: "short" })
                .slice(0, 1),
            ).map((d, idx) => (
              <Text key={`${d}-${idx}`} style={styles.calDowText}>
                {d}
              </Text>
            ))}
          </View>

          <View style={styles.calGrid}>
            {monthDays.cells.map((dayNum, idx) => {
              if (!dayNum) {
                return <View key={`e-${idx}`} style={styles.calCell} />;
              }

              const cellDate = new Date(
                monthDays.year,
                monthDays.monthIndex,
                dayNum,
              );
              // Keys must match backend format: "YYYY-MM-DD"
              const cellKey = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, "0")}-${String(
                cellDate.getDate(),
              ).padStart(2, "0")}`;
              const isSelected = cellKey === selectedKey;
              const isActive = activeDateSet.has(cellKey);

              return (
                <Pressable
                  key={`d-${idx}`}
                  style={[
                    styles.calCell,
                    isSelected && styles.calCellSelected,
                    isActive && styles.calCellActive,
                  ]}
                  onPress={() => setSelectedDate(cellDate)}
                >
                  <Text
                    style={[
                      styles.calDayText,
                      isSelected && styles.calDayTextSelected,
                    ]}
                  >
                    {dayNum}
                  </Text>
                  {isActive ? <View style={styles.calDot} /> : null}
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.calSelectedText}>
            {t("selected")}:{" "}
            {selectedDate.toLocaleDateString(locale, {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </Text>

          <Pressable
            style={styles.calActionBtn}
            onPress={() => {
              const entryDate = `${selectedDate.getFullYear()}-${String(
                selectedDate.getMonth() + 1,
              ).padStart(
                2,
                "0",
              )}-${String(selectedDate.getDate()).padStart(2, "0")}`;
              // Navigate into HomeStack (AiDiary) from the nested tab navigator.
              navigation.navigate("Home", {
                screen: "AiDiary",
                params: { entryDate },
              });
            }}
          >
            <Text style={styles.calActionText}>{t("createNoteForDay")}</Text>
          </Pressable>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard
            label={t("entriesStat")}
            value={stats?.total_entries ?? 0}
            icon="📝"
          />
          <StatCard
            label={t("avgMood")}
            value={
              stats?.average_mood != null ? stats.average_mood.toFixed(1) : "—"
            }
            icon="📊"
          />
          <StatCard
            label={t("streak")}
            value={`${stats?.current_streak ?? 0}${t("dayShort")}`}
            icon="🔥"
          />
          <StatCard
            label={t("best")}
            value={`${stats?.longest_streak ?? 0}${t("dayShort")}`}
            icon="🏆"
          />
        </View>

        {data?.latest_quiz_action_plan ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                {t("latestQuizActionPlan")}
              </Text>
              <Text style={styles.sectionHint}>
                {data.latest_quiz_action_plan.quiz_title}
              </Text>
            </View>
            <View style={styles.quizPlanCard}>
              <View style={styles.quizPlanTop}>
                <Text style={styles.quizPlanTitle}>
                  {data.latest_quiz_action_plan.quiz_title}
                </Text>
                <Text style={styles.quizPlanScore}>
                  {Math.round(data.latest_quiz_action_plan.score)}
                </Text>
              </View>
              <Text style={styles.quizPlanMeta}>
                {new Date(
                  data.latest_quiz_action_plan.created_at,
                ).toLocaleDateString()}{" "}
                • {data.latest_quiz_action_plan.severity_level}
              </Text>
              <Text style={styles.quizPlanSummary} numberOfLines={3}>
                {data.latest_quiz_action_plan.summary}
              </Text>
              {data.latest_quiz_action_plan.next_actions
                .slice(0, 3)
                .map((action) => (
                  <View key={action} style={styles.quizPlanActionRow}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={15}
                      color={colors.coral}
                    />
                    <Text style={styles.quizPlanAction}>{action}</Text>
                  </View>
                ))}
              <Pressable
                style={styles.quizPlanButton}
                onPress={() =>
                  navigation.navigate("Home", { screen: "AiQuiz" })
                }
              >
                <Text style={styles.quizPlanButtonText}>
                  {t("viewResultOrRetakeQuiz")}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Mood analytics */}
        {analytics ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{t("moodAnalytics")}</Text>
              <Text style={styles.sectionHint}>
                {analytics.start_date} → {analytics.end_date}
              </Text>
            </View>

            <View style={styles.filterRow}>
              {PERIOD_OPTIONS.map((period) => (
                <Pressable
                  key={period}
                  style={[
                    styles.filterChip,
                    analyticsPeriod === period && styles.filterChipOn,
                  ]}
                  onPress={() => setAnalyticsPeriod(period)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      analyticsPeriod === period && styles.filterChipTextOn,
                    ]}
                  >
                    {periodLabel(period, t)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsTitle}>{t("moodOverTime")}</Text>
              <DashboardMoodTrendChart
                points={analytics.mood_history}
                granularity={analyticsGranularity}
                locale={locale}
              />
            </View>

            <View style={styles.analyticsMiniGrid}>
              <View style={styles.analyticsMiniCard}>
                <Text style={styles.analyticsMiniValue}>
                  {analytics.journaling_frequency.entries_per_week}
                </Text>
                <Text style={styles.analyticsMiniLabel}>
                  {t("entriesPerWeek")}
                </Text>
              </View>
              <View style={styles.analyticsMiniCard}>
                <Text style={styles.analyticsMiniValue}>
                  {analytics.journaling_frequency.consistency_percentage}%
                </Text>
                <Text style={styles.analyticsMiniLabel}>
                  {t("consistency")}
                </Text>
              </View>
              <View style={styles.analyticsMiniCard}>
                <Text style={styles.analyticsMiniValue}>
                  {analytics.streak.longest_streak}
                  {t("dayShort")}
                </Text>
                <Text style={styles.analyticsMiniLabel}>{t("bestStreak")}</Text>
              </View>
            </View>

            {analytics.top_emotions.length > 0 ? (
              <View style={styles.analyticsCard}>
                <Text style={styles.analyticsTitle}>{t("topEmotions")}</Text>
                {analytics.top_emotions.map((emotion) => (
                  <View key={emotion.emotion_label} style={styles.emotionRow}>
                    <Text style={styles.emotionName}>
                      {MOOD_EMOJI[normalizeLabel(emotion.emotion_label)] ?? "✨"}{" "}
                      {translatedEmotionLabel(emotion.emotion_label, t)}
                    </Text>
                    <View style={styles.emotionBarTrack}>
                      <View
                        style={[
                          styles.emotionBarFill,
                          { width: `${emotion.percentage}%` as any },
                        ]}
                      />
                    </View>
                    <Text style={styles.emotionPct}>{emotion.percentage}%</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsTitle}>{t("emotionHeatmap")}</Text>
              <DashboardMiniHeatmap
                days={analytics.emotion_heatmap}
                locale={locale}
              />
              <Text style={styles.analyticsCaption}>{t("heatmapCaption")}</Text>
            </View>

            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsTitle}>
                {t("interpretationLayer")}
              </Text>
              {analytics.insights.slice(0, 3).map((insight) => (
                <View key={insight.title} style={styles.insightBullet}>
                  <Ionicons
                    name="sparkles-outline"
                    size={15}
                    color={colors.coral}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.insightBulletTitle}>
                      {translatedInsightTitle(insight.title, t)}
                    </Text>
                    <Text style={styles.insightBulletText}>
                      {insight.description}
                    </Text>
                  </View>
                </View>
              ))}
              {analytics.correlations.map((correlation) => (
                <Text key={correlation.metric} style={styles.correlationText}>
                  {translatedInsightTitle(correlation.metric, t)}: {" "}
                  {translatedCorrelationStrength(correlation.strength, t)}
                  {correlation.coefficient != null
                    ? ` (${correlation.coefficient})`
                    : ""}
                </Text>
              ))}
            </View>
          </View>
        ) : null}

        {/* Latest analysis */}
        {analysis && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("latestInsight")}</Text>
            <View style={styles.insightCard}>
              <Text style={styles.insightSummary}>
                {analysis.short_summary}
              </Text>
              <View style={styles.insightDivider} />
              <View style={styles.insightRow}>
                <Ionicons name="bulb-outline" size={16} color={colors.coral} />
                <Text style={styles.insightRec}>{analysis.recommendation}</Text>
              </View>
              <View style={styles.confidenceRow}>
                <Text style={styles.confidenceLabel}>{t("confidence")}</Text>
                <View style={styles.confidenceBarWrap}>
                  <View
                    style={[
                      styles.confidenceBarFill,
                      {
                        width:
                          `${Math.round(analysis.confidence_score * 100)}%` as any,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.confidencePct}>
                  {Math.round(analysis.confidence_score * 100)}%
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Recent entries */}
        {(data?.recent_entries?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("recentJournalEntries")}</Text>
            {data!.recent_entries.map((entry) => (
              <View key={entry.id} style={styles.entryCard}>
                <View style={styles.entryLeft}>
                  <Text style={styles.entryTitle} numberOfLines={1}>
                    {entry.title}
                  </Text>
                  <Text style={styles.entryDate}>
                    {new Date(entry.created_at).toLocaleDateString(locale, {
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </View>
                <View style={styles.entryRight}>
                  <MoodBar score={entry.mood_score} />
                  <Text style={styles.entryMoodScore}>
                    {entry.mood_score}/10
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {!analysis && !loading && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📖</Text>
            <Text style={styles.emptyTitle}>{t("startJourney")}</Text>
            <Text style={styles.emptySub}>{t("startJourneySub")}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSoft },
  scroll: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    marginTop: 4,
  },
  headerSub: { fontSize: 13, color: colors.textMuted },
  headerName: { fontSize: 22, fontWeight: "700", color: colors.text },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.periwinkle,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "700", color: colors.text },

  errBox: { marginBottom: 16 },
  errText: { color: "#B91C1C", marginBottom: 8, fontSize: 13 },
  retryBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.coral,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  retryText: { color: "#fff", fontWeight: "600", fontSize: 13 },

  moodCard: {
    backgroundColor: colors.periwinkle,
    borderRadius: 24,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  moodLeft: { flex: 1 },
  moodCardLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
    fontWeight: "500",
  },
  moodCardEmotion: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  sentimentPill: {
    alignSelf: "flex-start",
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  sentimentText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
    textTransform: "capitalize",
  },
  moodBigEmoji: { fontSize: 56 },

  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statIcon: { fontSize: 18, marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: "700", color: colors.text },
  statLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: "center",
  },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 10,
  },

  calTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  calTitle: { fontSize: 14, fontWeight: "800", color: colors.textMuted },

  calDowRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  calDowText: {
    width: 28,
    textAlign: "center",
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "700",
  },

  calGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%",
  },
  calCell: {
    width: 28,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    marginBottom: 6,
    position: "relative",
  },
  calCellSelected: {
    backgroundColor: colors.coral,
  },
  calCellActive: {
    backgroundColor: "#E9F0FF",
    borderWidth: 1,
    borderColor: "#93C5FD",
  },
  calDot: {
    position: "absolute",
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.coral,
  },
  calDayText: { fontSize: 12, color: colors.textMuted, fontWeight: "700" },
  calDayTextSelected: { color: colors.white },

  calSelectedText: { fontSize: 13, color: colors.textMuted, marginBottom: 10 },
  calActionBtn: {
    backgroundColor: colors.periwinkle,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  calActionText: { color: colors.text, fontWeight: "900" },

  insightCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  insightSummary: { fontSize: 14, color: colors.text, lineHeight: 20 },
  insightDivider: { height: 1, backgroundColor: "#F0F0F0", marginVertical: 12 },
  insightRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  insightRec: {
    flex: 1,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  confidenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  confidenceLabel: { fontSize: 11, color: colors.textMuted, width: 68 },
  confidenceBarWrap: {
    flex: 1,
    height: 6,
    backgroundColor: "#F0F0F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  confidenceBarFill: {
    height: 6,
    backgroundColor: colors.coral,
    borderRadius: 3,
  },
  confidencePct: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.text,
    width: 32,
    textAlign: "right",
  },

  entryCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  entryLeft: { flex: 1 },
  entryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 4,
  },
  entryDate: { fontSize: 12, color: colors.textMuted },
  entryRight: { alignItems: "flex-end", gap: 4 },
  moodBarWrap: {
    width: 80,
    height: 6,
    backgroundColor: "#F0F0F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  moodBarFill: { height: 6, borderRadius: 3 },
  entryMoodScore: { fontSize: 12, fontWeight: "600", color: colors.text },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionHint: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterChipOn: { backgroundColor: "#FFF0EE", borderColor: colors.coral },
  filterChipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  filterChipTextOn: { color: colors.coral },

  quizPlanCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    gap: 8,
  },
  quizPlanTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quizPlanTitle: { fontSize: 15, fontWeight: "900", color: colors.text },
  quizPlanScore: { fontSize: 22, fontWeight: "900", color: colors.coral },
  quizPlanMeta: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  quizPlanSummary: { fontSize: 13, color: colors.text, lineHeight: 18 },
  quizPlanActionRow: { flexDirection: "row", gap: 7, alignItems: "flex-start" },
  quizPlanAction: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    fontWeight: "700",
  },
  quizPlanButton: {
    backgroundColor: colors.coral,
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 4,
  },
  quizPlanButtonText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  analyticsCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 14,
    marginTop: 8,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  analyticsTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 10,
  },
  trendChart: {
    height: 150,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 5,
  },
  trendItem: { flex: 1, alignItems: "center", gap: 5, minWidth: 0 },
  trendBarTrack: {
    flex: 1,
    width: "100%",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  trendBarFill: { width: "100%", borderRadius: 10 },
  trendLabel: {
    fontSize: 9,
    color: colors.textMuted,
    maxWidth: 64,
    minHeight: 24,
    textAlign: "center",
    lineHeight: 11,
  },
  analyticsMiniGrid: { flexDirection: "row", gap: 8, marginTop: 8 },
  analyticsMiniCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
  },
  analyticsMiniValue: { fontSize: 16, fontWeight: "900", color: colors.text },
  analyticsMiniLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 2,
  },
  emotionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  emotionName: {
    width: 104,
    fontSize: 12,
    color: colors.text,
    fontWeight: "700",
  },
  emotionBarTrack: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  emotionBarFill: { height: 7, borderRadius: 4, backgroundColor: colors.coral },
  emotionPct: {
    width: 48,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: "right",
    fontWeight: "700",
  },
  heatmapGrid: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  heatmapCell: { width: 16, height: 16, borderRadius: 5 },
  heatmapRangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  heatmapRangeText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: "700",
  },
  analyticsCaption: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 10,
    lineHeight: 15,
  },
  insightBullet: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginBottom: 10,
  },
  insightBulletTitle: { fontSize: 12, color: colors.text, fontWeight: "800" },
  insightBulletText: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    marginTop: 2,
  },
  correlationText: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
    textTransform: "capitalize",
  },

  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    marginTop: 8,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
});
