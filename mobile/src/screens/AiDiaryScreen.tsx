import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ApiError, apiFetch } from "../api/client";
import { checkSafetyText } from "../api/safety";
import { getUserPreferences } from "../api/user";
import { scheduleJournalEntryReminder } from "../lib/notifications";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { languageLocales, useTranslation } from "../i18n/I18nContext";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { HomeStackParamList } from "../navigation/types";

// ─── Types ───────────────────────────────────────────────────────────────────
type JournalEntry = {
  id: number;
  title: string;
  content: string;
  mood_score: number;
  tags: string[] | null;
  is_private: boolean;
  push_notification_enabled: boolean;
  notification_title: string | null;
  notification_time: string | null;
  created_at: string;
  updated_at: string;
};

type JournalAnalysis = {
  id: number;
  journal_entry_id: number;
  sentiment_label: string;
  emotion_label: string;
  confidence_score: number;
  short_summary: string;
  recommendation: string;
  created_at: string;
};

// ─── API helpers ─────────────────────────────────────────────────────────────
const getEntries = () =>
  apiFetch<JournalEntry[]>("/journal/", { method: "GET", auth: true });

const createEntry = (payload: {
  title: string;
  content: string;
  mood_score: number;
  tags: string[];
  is_private: boolean;
  push_notification_enabled?: boolean;
  notification_title?: string | null;
  notification_time?: string | null;
  entry_date?: string;
  language?: string;
}) =>
  apiFetch<JournalEntry>("/journal/", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });

const deleteEntry = (id: number) =>
  apiFetch<void>(`/journal/${id}`, { method: "DELETE", auth: true });

const getAnalysis = (id: number, language = "en") =>
  apiFetch<JournalAnalysis>(
    `/analysis/journal/${id}?language=${encodeURIComponent(language)}`,
    { method: "GET", auth: true },
  );

// ─── Mood picker ─────────────────────────────────────────────────────────────
const MOOD_LABELS = [
  "😞",
  "😟",
  "😐",
  "🙂",
  "😊",
  "😄",
  "🌟",
  "💪",
  "🚀",
  "🤩",
];

function MoodPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={mpStyles.wrap}>
      <Text style={mpStyles.label}>
        {t("mood")}: {value}/10
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={mpStyles.row}>
          {MOOD_LABELS.map((emoji, i) => {
            const score = i + 1;
            return (
              <Pressable
                key={score}
                style={[mpStyles.pill, value === score && mpStyles.pillActive]}
                onPress={() => onChange(score)}
              >
                <Text style={mpStyles.emoji}>{emoji}</Text>
                <Text
                  style={[mpStyles.num, value === score && mpStyles.numActive]}
                >
                  {score}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const mpStyles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 13, color: colors.textMuted, marginBottom: 8 },
  row: { flexDirection: "row", gap: 8 },
  pill: {
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: colors.white,
  },
  pillActive: { borderColor: colors.coral, backgroundColor: "#FFF0EE" },
  emoji: { fontSize: 20 },
  num: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  numActive: { color: colors.coral, fontWeight: "700" },
});

function normalizeTime(value: string) {
  const [hourRaw = "20", minuteRaw = "00"] = value.split(":");
  const hour = Math.min(23, Math.max(0, Number(hourRaw) || 0));
  const minute = Math.min(59, Math.max(0, Number(minuteRaw) || 0));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function TimePickerModal({
  visible,
  value,
  title,
  onCancel,
  onSelect,
}: {
  visible: boolean;
  value: string;
  title: string;
  onCancel: () => void;
  onSelect: (time: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(normalizeTime(value));

  useEffect(() => {
    if (visible) setDraft(normalizeTime(value));
  }, [value, visible]);

  const [selectedHour, selectedMinute] = draft.split(":");
  const hours = Array.from({ length: 24 }, (_, index) =>
    String(index).padStart(2, "0"),
  );
  const minutes = [
    "00",
    "05",
    "10",
    "15",
    "20",
    "25",
    "30",
    "35",
    "40",
    "45",
    "50",
    "55",
  ];

  const setHour = (hour: string) =>
    setDraft(`${hour}:${selectedMinute || "00"}`);
  const setMinute = (minute: string) =>
    setDraft(`${selectedHour || "20"}:${minute}`);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={neStyles.timeModalBackdrop}>
        <View style={neStyles.timeModalCard}>
          <Text style={neStyles.timeModalTitle}>{title}</Text>
          <Text style={neStyles.timeModalValue}>{draft}</Text>
          <View style={neStyles.timePickerRow}>
            <ScrollView
              style={neStyles.timeColumn}
              showsVerticalScrollIndicator={false}
            >
              {hours.map((hour) => (
                <Pressable
                  key={hour}
                  style={[
                    neStyles.timeOption,
                    selectedHour === hour && neStyles.timeOptionActive,
                  ]}
                  onPress={() => setHour(hour)}
                >
                  <Text
                    style={[
                      neStyles.timeOptionText,
                      selectedHour === hour && neStyles.timeOptionTextActive,
                    ]}
                  >
                    {hour}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={neStyles.timeSeparator}>:</Text>
            <ScrollView
              style={neStyles.timeColumn}
              showsVerticalScrollIndicator={false}
            >
              {minutes.map((minute) => (
                <Pressable
                  key={minute}
                  style={[
                    neStyles.timeOption,
                    selectedMinute === minute && neStyles.timeOptionActive,
                  ]}
                  onPress={() => setMinute(minute)}
                >
                  <Text
                    style={[
                      neStyles.timeOptionText,
                      selectedMinute === minute &&
                        neStyles.timeOptionTextActive,
                    ]}
                  >
                    {minute}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <View style={neStyles.timeModalActions}>
            <Pressable style={neStyles.timeCancelBtn} onPress={onCancel}>
              <Text style={neStyles.timeCancelText}>{t("cancel")}</Text>
            </Pressable>
            <Pressable
              style={neStyles.timeSaveBtn}
              onPress={() => onSelect(draft)}
            >
              <Text style={neStyles.timeSaveText}>{t("save")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── New Entry Modal ──────────────────────────────────────────────────────────
function NewEntryModal({
  visible,
  onClose,
  onCreated,
  onSafetyNeeded,
  initialEntryDate,
  defaultPrivate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  onSafetyNeeded: () => void;
  initialEntryDate?: string;
  defaultPrivate: boolean;
}) {
  const { t, language } = useTranslation();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [moodScore, setMoodScore] = useState(5);
  const [tagsRaw, setTagsRaw] = useState("");
  const [isPrivate, setIsPrivate] = useState(defaultPrivate);
  const showNotificationOptions = !initialEntryDate;
  const [pushNotificationEnabled, setPushNotificationEnabled] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationTime, setNotificationTime] = useState("20:00");
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setTitle("");
    setContent("");
    setMoodScore(5);
    setTagsRaw("");
    setIsPrivate(defaultPrivate);
    setPushNotificationEnabled(false);
    setNotificationTitle("");
    setNotificationTime("20:00");
  };

  useEffect(() => {
    if (visible) setIsPrivate(defaultPrivate);
  }, [defaultPrivate, visible]);

  const submit = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert(t("missingFields"), t("missingEntryFields"));
      return;
    }
    setLoading(true);
    try {
      const tags = tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const shouldScheduleNotification =
        showNotificationOptions && pushNotificationEnabled;
      const notificationTitleValue = shouldScheduleNotification
        ? notificationTitle.trim() || title.trim()
        : null;

      const created = await createEntry({
        title: title.trim(),
        content: content.trim(),
        mood_score: moodScore,
        tags,
        is_private: isPrivate,
        push_notification_enabled: shouldScheduleNotification,
        notification_title: notificationTitleValue,
        notification_time: shouldScheduleNotification ? notificationTime : null,
        entry_date: initialEntryDate,
        language,
      });

      if (shouldScheduleNotification) {
        const scheduleResult = await scheduleJournalEntryReminder({
          entryId: created.id,
          entryDate: initialEntryDate,
          time: notificationTime,
          title: notificationTitleValue || t("journalReminder"),
        });
        if (!scheduleResult.scheduled && scheduleResult.unavailableReason) {
          Alert.alert(
            t("notificationNotScheduled"),
            scheduleResult.unavailableReason,
          );
        }
      }

      const safetyResult = await checkSafetyText(
        content.trim(),
        moodScore,
      ).catch(() => null);
      reset();
      onCreated();
      if (
        moodScore <= 2 ||
        safetyResult?.severity === "high" ||
        safetyResult?.severity === "crisis"
      ) {
        Alert.alert(t("supportAvailable"), t("supportAvailableMessage"), [
          { text: t("notNow"), style: "cancel" },
          { text: t("openSafetyResources"), onPress: onSafetyNeeded },
        ]);
      }
    } catch (e: any) {
      Alert.alert(t("error"), e?.message ?? t("couldNotSaveEntry"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView style={neStyles.safe} edges={["top", "bottom"]}>
          <View style={neStyles.topBar}>
            <Pressable
              onPress={() => {
                reset();
                onClose();
              }}
            >
              <Text style={neStyles.cancel}>{t("cancel")}</Text>
            </Pressable>
            <Text style={neStyles.modalTitle}>{t("newEntry")}</Text>
            <Pressable
              style={[neStyles.saveBtn, loading && { opacity: 0.6 }]}
              onPress={submit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={neStyles.saveText}>{t("save")}</Text>
              )}
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={neStyles.body}
            keyboardShouldPersistTaps="handled"
          >
            <TextInput
              style={neStyles.titleInput}
              placeholder={t("entryTitlePlaceholder")}
              placeholderTextColor={colors.textPlaceholder}
              selectionColor={colors.coral}
              cursorColor={colors.text}
              value={title}
              onChangeText={setTitle}
              maxLength={200}
            />

            {initialEntryDate ? (
              <Text style={neStyles.selectedDate}>
                {t("selectedDate")}: {initialEntryDate}
              </Text>
            ) : null}

            <MoodPicker value={moodScore} onChange={setMoodScore} />

            {showNotificationOptions ? (
              <View style={neStyles.notificationCard}>
                <Pressable
                  style={neStyles.notificationRow}
                  onPress={() => setPushNotificationEnabled((value) => !value)}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={20}
                    color={colors.coral}
                  />
                  <View style={neStyles.notificationTextWrap}>
                    <Text style={neStyles.notificationLabel}>
                      {t("pushNotification")}
                    </Text>
                    <Text style={neStyles.notificationHint}>
                      {pushNotificationEnabled
                        ? `${t("reminderScheduledFor")} ${notificationTime}.`
                        : t("noNotificationForEntry")}
                    </Text>
                  </View>
                  <View
                    style={[
                      neStyles.toggle,
                      pushNotificationEnabled && neStyles.toggleOn,
                    ]}
                  >
                    <View
                      style={[
                        neStyles.toggleThumb,
                        pushNotificationEnabled && neStyles.toggleThumbOn,
                      ]}
                    />
                  </View>
                </Pressable>

                {pushNotificationEnabled ? (
                  <View style={neStyles.notificationDetails}>
                    <Pressable
                      style={neStyles.notificationTimeRow}
                      onPress={() => setTimePickerVisible(true)}
                    >
                      <Ionicons
                        name="time-outline"
                        size={18}
                        color={colors.coral}
                      />
                      <Text style={neStyles.notificationTimeLabel}>
                        {t("notificationTime")}
                      </Text>
                      <Text style={neStyles.notificationTimeValue}>
                        {notificationTime}
                      </Text>
                    </Pressable>
                    <TextInput
                      style={neStyles.notificationTitleInput}
                      placeholder={t("notificationTitlePlaceholder")}
                      placeholderTextColor={colors.textPlaceholder}
                      selectionColor={colors.coral}
                      cursorColor={colors.text}
                      value={notificationTitle}
                      onChangeText={setNotificationTitle}
                      maxLength={200}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            <TimePickerModal
              visible={showNotificationOptions && timePickerVisible}
              value={notificationTime}
              title={t("journalNotificationTime")}
              onCancel={() => setTimePickerVisible(false)}
              onSelect={(time) => {
                setNotificationTime(time);
                setTimePickerVisible(false);
              }}
            />

            <TextInput
              style={neStyles.contentInput}
              placeholder={t("writeFeelingPlaceholder")}
              placeholderTextColor={colors.textPlaceholder}
              selectionColor={colors.coral}
              cursorColor={colors.text}
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
            />

            <TextInput
              style={neStyles.tagsInput}
              placeholder={t("tagsPlaceholder")}
              placeholderTextColor={colors.textPlaceholder}
              selectionColor={colors.coral}
              cursorColor={colors.text}
              value={tagsRaw}
              onChangeText={setTagsRaw}
              autoCapitalize="none"
            />

            <Pressable
              style={neStyles.privacyRow}
              onPress={() => setIsPrivate((p) => !p)}
            >
              <Ionicons
                name={isPrivate ? "lock-closed-outline" : "globe-outline"}
                size={18}
                color={colors.textMuted}
              />
              <Text style={neStyles.privacyText}>
                {isPrivate ? "Private entry" : "Public entry"}
              </Text>
              <View style={[neStyles.toggle, isPrivate && neStyles.toggleOn]}>
                <View
                  style={[
                    neStyles.toggleThumb,
                    isPrivate && neStyles.toggleThumbOn,
                  ]}
                />
              </View>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const neStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  cancel: { fontSize: 16, color: colors.textMuted },
  modalTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  saveBtn: {
    backgroundColor: colors.coral,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  body: { padding: 20, gap: 0 },
  titleInput: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.borderInput,
    paddingBottom: 12,
    marginBottom: 20,
  },
  selectedDate: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    marginBottom: 16,
  },
  contentInput: {
    fontSize: 15,
    color: colors.text,
    minHeight: 160,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  notificationCard: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    backgroundColor: colors.white,
  },
  notificationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  notificationTextWrap: { flex: 1 },
  notificationLabel: { fontSize: 14, color: colors.text, fontWeight: "800" },
  notificationHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 3,
    lineHeight: 16,
  },
  notificationDetails: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F2F7",
    paddingTop: 12,
    gap: 10,
  },
  notificationTimeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  notificationTimeLabel: {
    flex: 1,
    color: colors.text,
    fontWeight: "800",
    fontSize: 13,
  },
  notificationTimeValue: {
    color: colors.coral,
    fontWeight: "900",
    fontSize: 14,
  },
  notificationTitleInput: {
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  timeModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  timeModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 18,
  },
  timeModalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.text,
    textAlign: "center",
  },
  timeModalValue: {
    fontSize: 32,
    fontWeight: "900",
    color: colors.coral,
    textAlign: "center",
    marginVertical: 12,
  },
  timePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 220,
    gap: 10,
  },
  timeColumn: { flex: 1, maxHeight: 220 },
  timeSeparator: { fontSize: 28, fontWeight: "900", color: colors.textMuted },
  timeOption: {
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center",
    marginVertical: 2,
  },
  timeOptionActive: { backgroundColor: "#FFF3F1" },
  timeOptionText: { fontSize: 16, fontWeight: "800", color: colors.textMuted },
  timeOptionTextActive: { color: colors.coral },
  timeModalActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  timeCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "#EEF2F7",
  },
  timeCancelText: { color: colors.textMuted, fontWeight: "900" },
  timeSaveBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: colors.coral,
  },
  timeSaveText: { color: "#fff", fontWeight: "900" },
  tagsInput: {
    fontSize: 14,
    color: colors.text,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  privacyText: { flex: 1, fontSize: 14, color: colors.textMuted },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleOn: { backgroundColor: colors.coral },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  toggleThumbOn: { alignSelf: "flex-end" },
});

// ─── Entry Detail ─────────────────────────────────────────────────────────────
function EntryDetailModal({
  entry,
  onClose,
  onDeleted,
}: {
  entry: JournalEntry;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t, language } = useTranslation();
  const locale = languageLocales[language as keyof typeof languageLocales];
  const [analysis, setAnalysis] = useState<JournalAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getAnalysis(entry.id, language)
      .then(setAnalysis)
      .catch(() => setAnalysis(null))
      .finally(() => setAnalysisLoading(false));
  }, [entry.id, language]);

  const handleDelete = () => {
    Alert.alert(t("deleteEntry"), t("deleteEntryConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("deleteEntry"),
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteEntry(entry.id);
            onDeleted();
          } catch (e: any) {
            Alert.alert(t("error"), e?.message ?? t("couldNotDelete"));
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const moodColor =
    entry.mood_score >= 7
      ? "#34A853"
      : entry.mood_score >= 5
        ? "#FBBC04"
        : "#EE715F";

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={edStyles.safe} edges={["top", "bottom"]}>
        <View style={edStyles.topBar}>
          <Pressable onPress={onClose}>
            <Ionicons name="chevron-down" size={24} color={colors.text} />
          </Pressable>
          <Pressable onPress={handleDelete} disabled={deleting}>
            {deleting ? (
              <ActivityIndicator size="small" color={colors.coral} />
            ) : (
              <Ionicons name="trash-outline" size={22} color={colors.coral} />
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={edStyles.body}
          showsVerticalScrollIndicator={false}
        >
          <Text style={edStyles.entryTitle}>{entry.title}</Text>
          <View style={edStyles.meta}>
            <Text style={edStyles.metaDate}>
              {new Date(entry.created_at).toLocaleDateString(locale, {
                weekday: "short",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>
            <View
              style={[
                edStyles.moodBadge,
                { backgroundColor: `${moodColor}22` },
              ]}
            >
              <Text style={[edStyles.moodBadgeText, { color: moodColor }]}>
                {t("mood")} {entry.mood_score}/10
              </Text>
            </View>
          </View>

          {(entry.tags?.length ?? 0) > 0 && (
            <View style={edStyles.tagsRow}>
              {entry.tags!.map((tag) => (
                <View key={tag} style={edStyles.tag}>
                  <Text style={edStyles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {entry.push_notification_enabled && entry.notification_time ? (
            <View style={edStyles.notificationInfo}>
              <Ionicons
                name="notifications-outline"
                size={16}
                color={colors.coral}
              />
              <Text style={edStyles.notificationInfoText}>
                {t("reminderSetFor")} {entry.notification_time}
              </Text>
            </View>
          ) : null}

          <Text style={edStyles.content}>{entry.content}</Text>

          {/* Analysis section */}
          <View style={edStyles.analysisSection}>
            <Text style={edStyles.analysisSectionTitle}>{t("aiAnalysis")}</Text>
            {analysisLoading ? (
              <ActivityIndicator
                color={colors.coral}
                style={{ marginVertical: 16 }}
              />
            ) : analysis ? (
              <View style={edStyles.analysisCard}>
                <View style={edStyles.analysisRow}>
                  <View style={edStyles.analysisPill}>
                    <Text style={edStyles.analysisPillText}>
                      {analysis.sentiment_label}
                    </Text>
                  </View>
                  <View
                    style={[
                      edStyles.analysisPill,
                      edStyles.analysisPillEmotion,
                    ]}
                  >
                    <Text style={edStyles.analysisPillText}>
                      {analysis.emotion_label}
                    </Text>
                  </View>
                </View>
                <Text style={edStyles.analysisSummary}>
                  {analysis.short_summary}
                </Text>
                <View style={edStyles.recRow}>
                  <Ionicons
                    name="bulb-outline"
                    size={16}
                    color={colors.coral}
                  />
                  <Text style={edStyles.recText}>
                    {analysis.recommendation}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={edStyles.noAnalysis}>{t("noAnalysis")}</Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const edStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  body: { paddingHorizontal: 20, paddingBottom: 40 },
  entryTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 10,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  metaDate: { fontSize: 13, color: colors.textMuted },
  moodBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  moodBadgeText: { fontSize: 12, fontWeight: "600" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  tag: {
    backgroundColor: colors.periwinkle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagText: { fontSize: 12, color: colors.text },
  notificationInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFF3F1",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 18,
  },
  notificationInfoText: {
    color: colors.coral,
    fontSize: 13,
    fontWeight: "800",
  },
  content: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 24,
    marginBottom: 28,
  },
  analysisSection: {},
  analysisSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 12,
  },
  analysisCard: {
    backgroundColor: "#F8F0FF",
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  analysisRow: { flexDirection: "row", gap: 8 },
  analysisPill: {
    backgroundColor: colors.coral,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  analysisPillEmotion: { backgroundColor: "#8B5CF6" },
  analysisPillText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  analysisSummary: { fontSize: 14, color: colors.text, lineHeight: 20 },
  recRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  recText: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  noAnalysis: { color: colors.textMuted, fontSize: 14, fontStyle: "italic" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
const MOOD_EMOJI_SMALL = [
  "",
  "😞",
  "😟",
  "😐",
  "🙂",
  "😊",
  "😄",
  "🌟",
  "💪",
  "🚀",
  "🤩",
];

type Props = NativeStackScreenProps<HomeStackParamList, "AiDiary">;

export function AIDiaryScreen({ route, navigation }: Props) {
  const { signOut } = useAuth();
  const { t, language } = useTranslation();
  const locale = languageLocales[language as keyof typeof languageLocales];
  const initialEntryDate = route.params?.entryDate;

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<JournalEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [defaultPrivate, setDefaultPrivate] = useState(true);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [data, preferences] = await Promise.all([
        getEntries(),
        getUserPreferences().catch(() => null),
      ]);
      setEntries(data);
      if (preferences) {
        setDefaultPrivate(
          preferences.privacy_preferences.journal_private_default,
        );
      }
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        await signOut("sessionExpired");
        return;
      }
      setError(e instanceof ApiError ? e.message : t("couldNotLoadEntries"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [signOut]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // If user came from Dashboard "create for this day", open the modal immediately.
    if (initialEntryDate) setShowNew(true);
  }, [initialEntryDate]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const openJournalArchive = () => {
    const rootNavigation = navigation.getParent()?.getParent();
    (rootNavigation as any)?.navigate("ArchiveSearch", {
      initialTab: "journals",
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>{t("yourThoughts")}</Text>
          <Text style={styles.headerTitle}>{t("aiDiary")}</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            style={styles.searchButton}
            onPress={openJournalArchive}
            hitSlop={8}
          >
            <Ionicons name="search-outline" size={18} color={colors.coral} />
          </Pressable>
          <Text style={styles.entryCount}>
            {entries.length} {t("entries")}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.coral} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <View style={styles.errBox}>
              <Text style={styles.errText}>{error}</Text>
              <Pressable style={styles.retry} onPress={onRefresh}>
                <Text style={styles.retryText}>{t("retry")}</Text>
              </Pressable>
            </View>
          ) : null}
          {entries.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📝</Text>
              <Text style={styles.emptyTitle}>{t("noEntriesYet")}</Text>
              <Text style={styles.emptySub}>{t("noEntriesSub")}</Text>
            </View>
          ) : (
            entries.map((entry) => {
              const moodColor =
                entry.mood_score >= 7
                  ? "#34A853"
                  : entry.mood_score >= 5
                    ? "#FBBC04"
                    : "#EE715F";
              return (
                <Pressable
                  key={entry.id}
                  style={styles.card}
                  onPress={() => setSelected(entry)}
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {entry.title}
                    </Text>
                    <Text style={styles.cardEmoji}>
                      {MOOD_EMOJI_SMALL[entry.mood_score]}
                    </Text>
                  </View>
                  <Text style={styles.cardContent} numberOfLines={2}>
                    {entry.content}
                  </Text>
                  <View style={styles.cardBottom}>
                    <Text style={styles.cardDate}>
                      {new Date(entry.created_at).toLocaleDateString(locale, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>
                    <View
                      style={[
                        styles.moodChip,
                        { backgroundColor: `${moodColor}22` },
                      ]}
                    >
                      <View
                        style={[styles.moodDot, { backgroundColor: moodColor }]}
                      />
                      <Text style={[styles.moodChipText, { color: moodColor }]}>
                        {entry.mood_score}/10
                      </Text>
                    </View>
                    {!entry.is_private && (
                      <View style={styles.publicChip}>
                        <Ionicons
                          name="globe-outline"
                          size={11}
                          color={colors.textMuted}
                        />
                        <Text style={styles.publicText}>{t("public")}</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}

      {/* FAB */}
      <Pressable style={styles.fab} onPress={() => setShowNew(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      {/* Modals */}
      <NewEntryModal
        visible={showNew}
        onClose={() => setShowNew(false)}
        onCreated={() => {
          setShowNew(false);
          load();
        }}
        onSafetyNeeded={() => navigation.navigate("Safety")}
        initialEntryDate={initialEntryDate}
        defaultPrivate={defaultPrivate}
      />
      {selected && (
        <EntryDetailModal
          entry={selected}
          onClose={() => setSelected(null)}
          onDeleted={() => {
            setSelected(null);
            load();
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSoft },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errBox: {
    backgroundColor: "#FFE5E5",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  errText: { color: "#B91C1C", marginBottom: 10, fontWeight: "600" },
  retry: {
    alignSelf: "flex-start",
    backgroundColor: colors.coral,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  retryText: { color: colors.white, fontWeight: "700", fontSize: 13 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerSub: { fontSize: 13, color: colors.textMuted },
  headerTitle: { fontSize: 22, fontWeight: "700", color: colors.text },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchButton: { backgroundColor: "#FFF0EE", borderRadius: 999, padding: 8 },
  entryCount: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.coral,
    backgroundColor: "#FFF0EE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 100 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.text },
  cardEmoji: { fontSize: 22, marginLeft: 8 },
  cardContent: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 10,
  },
  cardBottom: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardDate: { fontSize: 12, color: colors.textMuted, flex: 1 },
  moodChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  moodDot: { width: 6, height: 6, borderRadius: 3 },
  moodChipText: { fontSize: 11, fontWeight: "600" },
  publicChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#F0F4FF",
  },
  publicText: { fontSize: 11, color: colors.textMuted },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: {
    fontSize: 20,
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
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.coral,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.coral,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
