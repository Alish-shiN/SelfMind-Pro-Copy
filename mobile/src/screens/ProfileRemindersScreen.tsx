import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ApiError } from "../api/client";
import { getReminderPreferences, ReminderPreference, updateReminderPreferences } from "../api/reminders";
import { scheduleReminderPreferences } from "../lib/notifications";
import type { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { useTranslation } from "../i18n/I18nContext";
import { useAuth } from "../context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "ProfileReminders">;
type ReminderTimeField = "journal_time" | "mood_checkin_time" | "ai_quiz_time";

export function ProfileRemindersScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const { t } = useTranslation();
  const [reminders, setReminders] = useState<ReminderPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<{ field: ReminderTimeField; label: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getReminderPreferences();
      setReminders(data);
      void scheduleReminderPreferences(data);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        await signOut("sessionExpired");
        return;
      }
      Alert.alert(t("reminderError"), e instanceof ApiError ? e.message : t("couldNotUpdateReminders"));
    } finally {
      setLoading(false);
    }
  }, [signOut, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateReminder = useCallback(
    async (payload: Partial<ReminderPreference>) => {
      setSaving(true);
      try {
        const updated = await updateReminderPreferences(payload);
        setReminders(updated);
        const scheduleResult = await scheduleReminderPreferences(updated);
        if (scheduleResult.unavailableReason) {
          Alert.alert(t("localNotificationsNotScheduled"), scheduleResult.unavailableReason);
        }
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          await signOut("sessionExpired");
          return;
        }
        Alert.alert(t("reminderError"), e instanceof ApiError ? e.message : t("couldNotUpdateReminders"));
      } finally {
        setSaving(false);
      }
    },
    [signOut, t],
  );

  const toggleReminder = (field: keyof ReminderPreference, value: boolean) => {
    void updateReminder({ [field]: value } as Partial<ReminderPreference>);
  };

  const saveReminderTime = (time: string) => {
    if (!timePickerTarget) return;
    void updateReminder({ [timePickerTarget.field]: time } as Partial<ReminderPreference>);
    setTimePickerTarget(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.topRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{t("reminders")}</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.coral} />
        </View>
      ) : reminders ? (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.card}>
            <ReminderRow icon="notifications-outline" label={t("allReminders")} value={reminders.reminders_enabled ? t("enabled") : t("paused")} enabled={reminders.reminders_enabled} disabled={saving} onPress={() => toggleReminder("reminders_enabled", !reminders.reminders_enabled)} />
            <View style={styles.divider} />
            <ReminderRow icon="journal-outline" label={t("dailyJournal")} value={reminders.journal_time} enabled={reminders.journal_enabled} disabled={saving} onPress={() => toggleReminder("journal_enabled", !reminders.journal_enabled)} onTimePress={() => setTimePickerTarget({ field: "journal_time", label: t("dailyJournalTime") })} />
            <View style={styles.divider} />
            <ReminderRow icon="happy-outline" label={t("moodCheckIn")} value={reminders.mood_checkin_time} enabled={reminders.mood_checkin_enabled} disabled={saving} onPress={() => toggleReminder("mood_checkin_enabled", !reminders.mood_checkin_enabled)} onTimePress={() => setTimePickerTarget({ field: "mood_checkin_time", label: t("moodCheckInTime") })} />
            <View style={styles.divider} />
            <ReminderRow icon="help-circle-outline" label={t("aiSelfCheck")} value={reminders.ai_quiz_time} enabled={reminders.ai_quiz_enabled} disabled={saving} onPress={() => toggleReminder("ai_quiz_enabled", !reminders.ai_quiz_enabled)} onTimePress={() => setTimePickerTarget({ field: "ai_quiz_time", label: t("aiSelfCheckTime") })} />
          </View>
          <Text style={styles.hint}>{t("reminderHint")}</Text>
        </ScrollView>
      ) : null}

      <TimePickerModal
        visible={Boolean(timePickerTarget && reminders)}
        value={timePickerTarget && reminders ? reminders[timePickerTarget.field] : "09:00"}
        title={timePickerTarget?.label ?? t("saveTime")}
        onCancel={() => setTimePickerTarget(null)}
        onSelect={saveReminderTime}
      />
    </SafeAreaView>
  );
}

function ReminderRow({ icon, label, value, enabled, disabled, onPress, onTimePress }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; enabled: boolean; disabled: boolean; onPress: () => void; onTimePress?: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color={colors.coral} />
      <View style={styles.infoTextWrap}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{enabled ? value : t("off")}</Text>
      </View>
      {onTimePress && enabled ? (
        <Pressable style={styles.timePill} onPress={onTimePress} disabled={disabled}>
          <Text style={styles.timePillText}>{value}</Text>
        </Pressable>
      ) : null}
      <Pressable style={[styles.togglePill, enabled ? styles.toggleOn : styles.toggleOff, disabled && { opacity: 0.5 }]} onPress={onPress} disabled={disabled}>
        <Text style={[styles.toggleText, enabled && styles.toggleTextOn]}>{enabled ? t("on") : t("off")}</Text>
      </Pressable>
    </View>
  );
}

function TimePickerModal({ visible, value, title, onCancel, onSelect }: { visible: boolean; value: string; title: string; onCancel: () => void; onSelect: (time: string) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [value, visible]);

  const [selectedHour, selectedMinute] = draft.split(":");
  const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
  const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
  const setHour = (hour: string) => setDraft(`${hour}:${selectedMinute || "00"}`);
  const setMinute = (minute: string) => setDraft(`${selectedHour || "09"}:${minute}`);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.timeModalBackdrop}>
        <View style={styles.timeModalCard}>
          <Text style={styles.timeModalTitle}>{title}</Text>
          <Text style={styles.timeModalValue}>{draft}</Text>
          <View style={styles.timePickerRow}>
            <ScrollView style={styles.timeColumn} showsVerticalScrollIndicator={false}>
              {hours.map((hour) => (
                <Pressable key={hour} style={[styles.timeOption, selectedHour === hour && styles.timeOptionActive]} onPress={() => setHour(hour)}>
                  <Text style={[styles.timeOptionText, selectedHour === hour && styles.timeOptionTextActive]}>{hour}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.timeSeparator}>:</Text>
            <ScrollView style={styles.timeColumn} showsVerticalScrollIndicator={false}>
              {minutes.map((minute) => (
                <Pressable key={minute} style={[styles.timeOption, selectedMinute === minute && styles.timeOptionActive]} onPress={() => setMinute(minute)}>
                  <Text style={[styles.timeOptionText, selectedMinute === minute && styles.timeOptionTextActive]}>{minute}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <View style={styles.timeModalActions}>
            <Pressable style={styles.timeCancelBtn} onPress={onCancel}>
              <Text style={styles.timeCancelText}>{t("cancel")}</Text>
            </Pressable>
            <Pressable style={styles.timeSaveBtn} onPress={() => onSelect(draft)}>
              <Text style={styles.timeSaveText}>{t("saveTime")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSoft },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: "#EEF2F7" },
  title: { fontSize: 17, fontWeight: "900", color: colors.text },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: "#E8ECF4", overflow: "hidden" },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 14 },
  divider: { height: 1, backgroundColor: "#F0F2F7", marginLeft: 50 },
  infoTextWrap: { flex: 1 },
  infoLabel: { fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 2 },
  infoValue: { fontSize: 15, fontWeight: "700", color: colors.text },
  hint: { fontSize: 12, color: colors.textMuted, fontWeight: "600", marginTop: 8, marginLeft: 4, lineHeight: 17 },
  timePill: { backgroundColor: "#FFF3F1", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  timePillText: { color: colors.coral, fontWeight: "900", fontSize: 12 },
  togglePill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, minWidth: 48, alignItems: "center" },
  toggleOn: { backgroundColor: colors.coral },
  toggleOff: { backgroundColor: "#EEF2F7" },
  toggleText: { color: colors.textMuted, fontSize: 12, fontWeight: "900" },
  toggleTextOn: { color: "#fff" },
  timeModalBackdrop: { flex: 1, backgroundColor: "rgba(17, 24, 39, 0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  timeModalCard: { width: "100%", maxWidth: 360, backgroundColor: colors.white, borderRadius: 24, padding: 18 },
  timeModalTitle: { fontSize: 18, fontWeight: "900", color: colors.text, textAlign: "center" },
  timeModalValue: { fontSize: 32, fontWeight: "900", color: colors.coral, textAlign: "center", marginVertical: 12 },
  timePickerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: 220, gap: 10 },
  timeColumn: { flex: 1, maxHeight: 220 },
  timeSeparator: { fontSize: 28, fontWeight: "900", color: colors.textMuted },
  timeOption: { paddingVertical: 10, borderRadius: 14, alignItems: "center", marginVertical: 2 },
  timeOptionActive: { backgroundColor: "#FFF3F1" },
  timeOptionText: { fontSize: 16, fontWeight: "800", color: colors.textMuted },
  timeOptionTextActive: { color: colors.coral },
  timeModalActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  timeCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 16, alignItems: "center", backgroundColor: "#EEF2F7" },
  timeCancelText: { color: colors.textMuted, fontWeight: "900" },
  timeSaveBtn: { flex: 1, paddingVertical: 13, borderRadius: 16, alignItems: "center", backgroundColor: colors.coral },
  timeSaveText: { color: "#fff", fontWeight: "900" },
});
