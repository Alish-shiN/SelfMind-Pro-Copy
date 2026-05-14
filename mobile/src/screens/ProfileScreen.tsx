import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import type { RootStackParamList } from "../navigation/types";
import { ApiError } from "../api/client";
import { getCurrentUser, getUserPreferences, UserPreferences } from "../api/user";
import { getReminderPreferences, ReminderPreference } from "../api/reminders";
import { scheduleReminderPreferences } from "../lib/notifications";
import { supportedLanguages, useTranslation } from "../i18n/I18nContext";
import type { UserResponse } from "../api/auth";

type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

const GOAL_LABEL_KEYS: Record<string, string> = {
  reduce_stress: "reduceStress",
  understand_mood: "understandMood",
  build_routine: "buildRoutine",
  prepare_exams: "prepareExams",
  feel_motivated: "feelMotivated",
  sleep_better: "sleepBetter",
};

function optionLabel(value: string, t: (key: string) => string) {
  return t(GOAL_LABEL_KEYS[value] ?? value);
}

function formatJoined(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function HubRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Ionicons name={icon} size={20} color={colors.coral} />
      <View style={styles.infoTextWrap}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable style={styles.infoRow} onPress={onPress}>
        {content}
      </Pressable>
    );
  }
  return <View style={styles.infoRow}>{content}</View>;
}

export function ProfileScreen({ navigation, route }: Props) {
  const { signOut } = useAuth();
  const { t, language } = useTranslation();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reminders, setReminders] = useState<ReminderPreference | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [u, reminderPrefs, userPrefs] = await Promise.all([
        getCurrentUser(),
        getReminderPreferences(),
        getUserPreferences(),
      ]);
      setUser(u);
      setReminders(reminderPrefs);
      setPreferences(userPrefs);
      void scheduleReminderPreferences(reminderPrefs);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        await signOut("sessionExpired");
        return;
      }
      setError(e instanceof ApiError ? e.message : t("couldNotLoadProfile"));
    } finally {
      setLoading(false);
    }
  }, [signOut, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (route.params?.openPersonalization) {
      navigation.navigate("ProfilePersonalization");
    }
  }, [navigation, route.params?.openPersonalization]);

  const onSignOut = useCallback(() => {
    Alert.alert(t("signOutConfirmTitle"), t("signOutConfirm"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("signOut"), style: "destructive", onPress: () => void signOut() },
    ]);
  }, [signOut, t]);

  const initials = user?.username
    ? user.username
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.topRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{t("profile")}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <Image
            source={require("../../assets/selfmind-logo.png")}
            style={styles.brandMark}
            resizeMode="contain"
            accessibilityLabel="SelfMindPro"
          />
        </View>

        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color={colors.coral} />
            <Text style={styles.loadingHint}>{t("loadingProfile")}</Text>
          </View>
        ) : null}

        {error && !loading ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryText}>{t("retry")}</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && user ? (
          <>
            <View style={styles.heroCard}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <Text style={styles.name}>{user.username}</Text>
              <Text style={styles.tagline}>{t("wellnessCompanion")}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t("account")}</Text>
              <View style={styles.infoCard}>
                <HubRow icon="mail-outline" label={t("email")} value={user.email} />
                <View style={styles.divider} />
                <HubRow icon="person-outline" label={t("username")} value={user.username} />
                <View style={styles.divider} />
                <HubRow icon="calendar-outline" label={t("memberSince")} value={formatJoined(user.created_at)} />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t("reflectionTools")}</Text>
              <View style={styles.infoCard}>
                <HubRow
                  icon="search-outline"
                  label={t("archiveSearch")}
                  value={t("archiveSearchDesc")}
                  onPress={() => navigation.navigate("ArchiveSearch")}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t("profileSettings")}</Text>
              <View style={styles.infoCard}>
                <HubRow
                  icon="sparkles-outline"
                  label={t("personalization")}
                  value={
                    preferences
                      ? `${t("aiTone")}: ${t(preferences.ai_tone)} · ${
                          preferences.emotional_goals.length
                            ? preferences.emotional_goals.map((goal) => optionLabel(goal, t)).join(", ")
                            : t("notSelectedYet")
                        }`
                      : t("personalizationDesc")
                  }
                  onPress={() => navigation.navigate("ProfilePersonalization")}
                />
                <View style={styles.divider} />
                <HubRow
                  icon="shield-checkmark-outline"
                  label={t("privacyCenter")}
                  value={
                    preferences?.privacy_preferences.journal_private_default
                      ? t("privateDiaryDefault")
                      : t("publicJournalEntries")
                  }
                  onPress={() => navigation.navigate("ProfilePrivacyCenter")}
                />
                <View style={styles.divider} />
                <HubRow
                  icon="notifications-outline"
                  label={t("reminders")}
                  value={reminders?.reminders_enabled ? t("enabled") : t("paused")}
                  onPress={() => navigation.navigate("ProfileReminders")}
                />
                <View style={styles.divider} />
                <HubRow
                  icon="language-outline"
                  label={t("language")}
                  value={supportedLanguages.find((item) => item.key === language)?.label ?? t("english")}
                />
              </View>
            </View>
          </>
        ) : null}

        <Pressable style={styles.signOutBtn} onPress={onSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.signOutText}>{t("signOut")}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSoft },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  title: { fontSize: 17, fontWeight: "800", color: colors.text },
  scrollContent: { paddingBottom: 32, paddingHorizontal: 16 },
  brandRow: { alignItems: "center", marginTop: 4, marginBottom: 8 },
  brandMark: { width: 160, height: 72, opacity: 0.95 },
  loadingBlock: { alignItems: "center", paddingVertical: 28, gap: 12 },
  loadingHint: { fontSize: 14, color: colors.textMuted, fontWeight: "600" },
  errBox: { backgroundColor: "#FFE5E5", borderRadius: 16, padding: 14, marginBottom: 12 },
  errText: { color: "#B91C1C", fontWeight: "700", marginBottom: 10 },
  retryBtn: { backgroundColor: colors.coral, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, alignSelf: "flex-start" },
  retryText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  heroCard: { backgroundColor: colors.white, borderRadius: 20, paddingVertical: 22, paddingHorizontal: 18, alignItems: "center", borderWidth: 1, borderColor: "#E8ECF4", marginBottom: 20 },
  avatarCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: "#F5F7FA", borderWidth: 2, borderColor: colors.coral, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 28, fontWeight: "900", color: colors.text },
  name: { marginTop: 14, fontSize: 22, fontWeight: "900", color: colors.text },
  tagline: { marginTop: 6, fontSize: 13, color: colors.textMuted, fontWeight: "600" },
  section: { marginBottom: 14 },
  sectionLabel: { fontSize: 12, fontWeight: "900", color: colors.textMuted, letterSpacing: 0.6, marginBottom: 10, marginLeft: 4, textTransform: "uppercase" },
  infoCard: { backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: "#E8ECF4", overflow: "hidden" },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 14 },
  divider: { height: 1, backgroundColor: "#F0F2F7", marginLeft: 50 },
  infoTextWrap: { flex: 1 },
  infoLabel: { fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 2 },
  infoValue: { fontSize: 15, fontWeight: "700", color: colors.text },
  signOutBtn: { marginTop: 12, backgroundColor: colors.coral, borderRadius: 16, paddingVertical: 15, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  signOutText: { color: colors.white, fontWeight: "800", fontSize: 16 },
});
