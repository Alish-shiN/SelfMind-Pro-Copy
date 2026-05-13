import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import {
  AITone,
  DEFAULT_USER_PREFERENCES,
  PreferredReflectionFormat,
  ReminderFrequency,
  updateUserPreferences,
} from "../api/user";
import { useTranslation } from "../i18n/I18nContext";

type Props = { onDone: () => void };
type Step = 0 | 1 | 2 | 3 | 4 | 5;

const GOALS = [
  { key: "reduce_stress", label: "reduceStress", icon: "leaf-outline" },
  {
    key: "understand_mood",
    label: "understandMood",
    icon: "analytics-outline",
  },
  { key: "build_routine", label: "buildRoutine", icon: "calendar-outline" },
  { key: "prepare_exams", label: "prepareExams", icon: "school-outline" },
  { key: "feel_motivated", label: "feelMotivated", icon: "sparkles-outline" },
  { key: "sleep_better", label: "sleepBetter", icon: "moon-outline" },
];

const FORMATS: Array<{
  key: PreferredReflectionFormat;
  label: string;
  desc: string;
  icon: string;
}> = [
  { key: "diary", label: "diary", desc: "diaryDesc", icon: "journal-outline" },
  {
    key: "chat",
    label: "chat",
    desc: "chatDesc",
    icon: "chatbubble-ellipses-outline",
  },
  { key: "quiz", label: "quiz", desc: "quizDesc", icon: "help-circle-outline" },
];

const FREQUENCIES: Array<{ key: ReminderFrequency; label: string }> = [
  { key: "daily", label: "daily" },
  { key: "few_times_week", label: "fewTimesWeek" },
  { key: "weekly", label: "weekly" },
  { key: "none", label: "noReminders" },
];

const TONES: Array<{ key: AITone; label: string; desc: string }> = [
  { key: "calm", label: "calm", desc: "calmDesc" },
  { key: "practical", label: "practical", desc: "practicalDesc" },
  { key: "motivating", label: "motivating", desc: "motivatingDesc" },
  { key: "reflective", label: "reflective", desc: "reflectiveDesc" },
];

export function PersonalizationOnboardingScreen({ onDone }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>(0);
  const [saving, setSaving] = useState(false);
  const [goals, setGoals] = useState<string[]>([]);
  const [format, setFormat] = useState<PreferredReflectionFormat>("diary");
  const [frequency, setFrequency] = useState<ReminderFrequency>("none");
  const [journalPrivate, setJournalPrivate] = useState(true);
  const [anonymousDefault, setAnonymousDefault] = useState(false);
  const [shareInsights, setShareInsights] = useState(false);
  const [tone, setTone] = useState<AITone>("calm");

  const progress = useMemo(() => `${step + 1}/6`, [step]);

  const toggleGoal = (key: string) => {
    setGoals((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  };

  const finish = async (skipped = false) => {
    setSaving(true);
    try {
      await updateUserPreferences(
        skipped
          ? {
              ...DEFAULT_USER_PREFERENCES,
              onboarding_completed: true,
              onboarding_skipped: true,
            }
          : {
              emotional_goals: goals,
              preferred_reflection_format: format,
              reminder_frequency: frequency,
              privacy_preferences: {
                journal_private_default: journalPrivate,
                anonymous_community_default: anonymousDefault,
                share_ai_insights: shareInsights,
                community_profile_visibility: "members",
                ai_processing_consent: shareInsights,
                privacy_notice_accepted: false,
                privacy_notice_version: null,
                privacy_notice_accepted_at: null,
              },
              ai_tone: tone,
              onboarding_completed: true,
              onboarding_skipped: false,
            },
      );
      onDone();
    } catch (e: any) {
      Alert.alert(
        t("couldNotSavePreferences"),
        e?.message ?? t("chooseLaterProfile"),
      );
      onDone();
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step < 5) setStep((value) => (value + 1) as Step);
    else void finish(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>{t("personalizeSelfMind")}</Text>
          <Text style={styles.progress}>{progress}</Text>
        </View>
        <Pressable
          style={styles.skipBtn}
          onPress={() => void finish(true)}
          disabled={saving}
        >
          <Text style={styles.skipText}>{t("chooseLater")}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {step === 0 ? (
          <View>
            <Text style={styles.title}>{t("supportQuestion")}</Text>
            <Text style={styles.subtitle}>{t("supportQuestionSub")}</Text>
            <View style={styles.grid}>
              {GOALS.map((goal) => {
                const active = goals.includes(goal.key);
                return (
                  <Pressable
                    key={goal.key}
                    style={[styles.optionCard, active && styles.optionOn]}
                    onPress={() => toggleGoal(goal.key)}
                  >
                    <Ionicons
                      name={goal.icon as any}
                      size={22}
                      color={active ? colors.coral : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.optionTitle,
                        active && styles.optionTitleOn,
                      ]}
                    >
                      {t(goal.label)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {step === 1 ? (
          <View>
            <Text style={styles.title}>{t("preferredReflectionFormat")}</Text>
            <Text style={styles.subtitle}>
              {t("reflectionFormatQuestionSub")}
            </Text>
            {FORMATS.map((item) => (
              <Pressable
                key={item.key}
                style={[
                  styles.fullOption,
                  format === item.key && styles.optionOn,
                ]}
                onPress={() => setFormat(item.key)}
              >
                <Ionicons
                  name={item.icon as any}
                  size={22}
                  color={format === item.key ? colors.coral : colors.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>{t(item.label)}</Text>
                  <Text style={styles.optionDesc}>{t(item.desc)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {step === 2 ? (
          <View>
            <Text style={styles.title}>{t("reminderFrequency")}</Text>
            <Text style={styles.subtitle}>{t("reminderFrequencySub")}</Text>
            {FREQUENCIES.map((item) => (
              <Pressable
                key={item.key}
                style={[
                  styles.fullOption,
                  frequency === item.key && styles.optionOn,
                ]}
                onPress={() => setFrequency(item.key)}
              >
                <Text style={styles.optionTitle}>{t(item.label)}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {step === 3 ? (
          <View>
            <Text style={styles.title}>{t("privacyPreferences")}</Text>
            <Text style={styles.subtitle}>{t("privacyPreferencesSub")}</Text>
            <Toggle
              label={t("newEntriesPrivateDefault")}
              value={journalPrivate}
              onPress={() => setJournalPrivate((v) => !v)}
            />
            <Toggle
              label={t("communityPostsAnonymousDefault")}
              value={anonymousDefault}
              onPress={() => setAnonymousDefault((v) => !v)}
            />
            <Toggle
              label={t("allowAiInsights")}
              value={shareInsights}
              onPress={() => setShareInsights((v) => !v)}
            />
          </View>
        ) : null}

        {step === 4 ? (
          <View>
            <Text style={styles.title}>{t("chooseAiTone")}</Text>
            <Text style={styles.subtitle}>{t("chooseAiToneSub")}</Text>
            {TONES.map((item) => (
              <Pressable
                key={item.key}
                style={[
                  styles.fullOption,
                  tone === item.key && styles.optionOn,
                ]}
                onPress={() => setTone(item.key)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>{t(item.label)}</Text>
                  <Text style={styles.optionDesc}>{t(item.desc)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {step === 5 ? (
          <View style={styles.finalCard}>
            <Text style={styles.finalEmoji}>✨</Text>
            <Text style={styles.title}>{t("allSet")}</Text>
            <Text style={styles.subtitle}>{t("allSetSub")}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 ? (
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => setStep((value) => (value - 1) as Step)}
            disabled={saving}
          >
            <Text style={styles.secondaryText}>{t("back")}</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.primaryBtn} onPress={next} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>
              {step === 5 ? t("enterApp") : t("continue")}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Toggle({
  label,
  value,
  onPress,
}: {
  label: string;
  value: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.toggleRow} onPress={onPress}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.switchTrack, value && styles.switchTrackOn]}>
        <View style={[styles.switchThumb, value && styles.switchThumbOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSoft },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
  },
  kicker: { color: colors.textMuted, fontSize: 13, fontWeight: "800" },
  progress: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 2,
  },
  skipBtn: {
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  skipText: { color: colors.coral, fontWeight: "900", fontSize: 13 },
  body: { padding: 20, paddingTop: 6, paddingBottom: 120 },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
    marginBottom: 10,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  optionCard: {
    width: "48%",
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E8ECF4",
    padding: 15,
    minHeight: 112,
    justifyContent: "space-between",
  },
  fullOption: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E8ECF4",
    padding: 16,
    marginBottom: 10,
  },
  optionOn: { backgroundColor: "#FFF3F1", borderColor: colors.coral },
  optionTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  optionTitleOn: { color: colors.coral },
  optionDesc: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E8ECF4",
  },
  toggleLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
    paddingRight: 12,
  },
  switchTrack: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#E5E7EB",
    padding: 3,
  },
  switchTrackOn: { backgroundColor: colors.coral },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  switchThumbOn: { transform: [{ translateX: 20 }] },
  finalCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
  },
  finalEmoji: { fontSize: 54, marginBottom: 10 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    padding: 20,
    backgroundColor: colors.backgroundSoft,
  },
  secondaryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderRadius: 999,
    backgroundColor: colors.white,
  },
  secondaryText: { color: colors.textMuted, fontWeight: "900" },
  primaryBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 999,
    alignItems: "center",
    backgroundColor: colors.coral,
  },
  primaryText: { color: "#fff", fontWeight: "900", fontSize: 16 },
});
