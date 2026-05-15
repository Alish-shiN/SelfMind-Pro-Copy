import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ApiError } from "../api/client";
import {
  AITone,
  getCurrentUser,
  getUserPreferences,
  updateUserPreferences,
  UserPreferences,
} from "../api/user";
import { getTrustedPersonPhone, setTrustedPersonPhone } from "../lib/storage";
import type { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { supportedLanguages, useTranslation } from "../i18n/I18nContext";
import { useAuth } from "../context/AuthContext";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "ProfilePersonalization"
>;

const GOAL_OPTIONS = [
  "reduce_stress",
  "understand_mood",
  "build_routine",
  "prepare_exams",
  "feel_motivated",
  "sleep_better",
];
const TONE_OPTIONS: AITone[] = [
  "calm",
  "practical",
  "motivating",
  "reflective",
];
const OPTION_LABEL_KEYS: Record<string, string> = {
  reduce_stress: "reduceStress",
  understand_mood: "understandMood",
  build_routine: "buildRoutine",
  prepare_exams: "prepareExams",
  feel_motivated: "feelMotivated",
  sleep_better: "sleepBetter",
  calm: "calm",
  practical: "practical",
  motivating: "motivating",
  reflective: "reflective",
};

function optionLabel(value: string, t: (key: string) => string) {
  return t(OPTION_LABEL_KEYS[value] ?? value);
}

export function ProfilePersonalizationScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const { language, setLanguage, t } = useTranslation();
  const [draft, setDraft] = useState<UserPreferences | null>(null);
  const [trustedPhone, setTrustedPhone] = useState("");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [trustedPhoneError, setTrustedPhoneError] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [prefs, user] = await Promise.all([
          getUserPreferences(),
          getCurrentUser(),
        ]);
        const phone = await getTrustedPersonPhone(user.id);
        if (!cancelled) {
          setCurrentUserId(user.id);
          setDraft(prefs);
          setTrustedPhone(phone ?? "");
        }
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          await signOut("sessionExpired");
          return;
        }
        Alert.alert(
          t("preferencesError"),
          e instanceof ApiError ? e.message : t("couldNotLoadPreferences"),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signOut, t]);

  const toggleGoal = (goal: string) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            emotional_goals: current.emotional_goals.includes(goal)
              ? current.emotional_goals.filter((item) => item !== goal)
              : [...current.emotional_goals, goal],
          }
        : current,
    );
  };

  const save = async () => {
    if (!draft) return;
    if (!currentUserId) {
      setTrustedPhoneError(t("couldNotSavePreferences"));
      return;
    }
    const phone = trustedPhone.trim();
    if (phone && !/^[+()\d\s-]+$/.test(phone)) {
      setTrustedPhoneError(t("trustedPersonPhoneInvalid"));
      return;
    }

    setSaving(true);
    try {
      const updated = await updateUserPreferences({
        emotional_goals: draft.emotional_goals,
        ai_tone: draft.ai_tone,
        reminder_frequency: draft.reminder_frequency,
        onboarding_completed: true,
      });
      await setTrustedPersonPhone(phone, currentUserId);
      setDraft(updated);
      Alert.alert(t("preferencesSaved"), t("preferencesSavedMessage"));
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        await signOut("sessionExpired");
        return;
      }
      Alert.alert(
        t("preferencesError"),
        e instanceof ApiError ? e.message : t("couldNotSavePreferences"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.topRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("personalization")}</Text>
          <Pressable
            style={styles.saveTopBtn}
            onPress={save}
            disabled={saving || !draft}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveTopText}>{t("save")}</Text>
            )}
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.coral} />
          </View>
        ) : draft ? (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
          >
            <Text style={styles.description}>{t("personalizationDesc")}</Text>

            <Text style={styles.sectionLabel}>{t("language")}</Text>
            <View style={styles.chipWrap}>
              {supportedLanguages.map((item) => (
                <Pressable
                  key={item.key}
                  style={[styles.chip, language === item.key && styles.chipOn]}
                  onPress={() => void setLanguage(item.key)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      language === item.key && styles.chipTextOn,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>{t("aiTone")}</Text>
            <View style={styles.chipWrap}>
              {TONE_OPTIONS.map((tone) => (
                <Pressable
                  key={tone}
                  style={[styles.chip, draft.ai_tone === tone && styles.chipOn]}
                  onPress={() => setDraft({ ...draft, ai_tone: tone })}
                >
                  <Text
                    style={[
                      styles.chipText,
                      draft.ai_tone === tone && styles.chipTextOn,
                    ]}
                  >
                    {optionLabel(tone, t)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hint}>{t("aiToneAffectsChat")}</Text>

            <Text style={styles.sectionLabel}>{t("emotionalGoals")}</Text>
            <View style={styles.chipWrap}>
              {GOAL_OPTIONS.map((goal) => {
                const active = draft.emotional_goals.includes(goal);
                return (
                  <Pressable
                    key={goal}
                    style={[styles.chip, active && styles.chipOn]}
                    onPress={() => toggleGoal(goal)}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextOn]}
                    >
                      {optionLabel(goal, t)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>{t("trustedPerson")}</Text>
            <TextInput
              style={styles.input}
              value={trustedPhone}
              onChangeText={(value) => {
                setTrustedPhone(value);
                setTrustedPhoneError(null);
              }}
              placeholder={t("trustedPersonPhoneNumber")}
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              returnKeyType="done"
              onFocus={() =>
                setTimeout(
                  () => scrollRef.current?.scrollToEnd({ animated: true }),
                  250,
                )
              }
            />
            <Text style={styles.hint}>{t("trustedPersonHelper")}</Text>
            {trustedPhoneError ? (
              <Text style={styles.errorText}>{trustedPhoneError}</Text>
            ) : null}
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSoft },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  title: { fontSize: 17, fontWeight: "900", color: colors.text },
  saveTopBtn: {
    minWidth: 72,
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: colors.coral,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  saveTopText: { color: "#fff", fontWeight: "900" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 16, paddingBottom: 180, gap: 12 },
  description: {
    color: colors.textMuted,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.textMuted,
    letterSpacing: 0.6,
    marginTop: 10,
    textTransform: "uppercase",
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E8ECF4",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: "#FFF3F1", borderColor: colors.coral },
  chipText: { color: colors.textMuted, fontWeight: "800" },
  chipTextOn: { color: colors.coral },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E8ECF4",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontWeight: "700",
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  errorText: { color: "#B91C1C", fontSize: 12, fontWeight: "800" },
});
