import { useEffect, useState } from "react";
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
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ApiError } from "../api/client";
import {
  deleteAccount as deleteUserAccount,
  downloadWeeklyPdfReport,
  exportPersonalData,
  getPrivacyCenter,
  PersonalExportType,
  PrivacyCenterResponse,
  updateUserPreferences,
  UserPreferences,
} from "../api/user";
import { setAchievementPrivacyReady } from "../lib/storage";
import type { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { useTranslation } from "../i18n/I18nContext";
import { useAuth } from "../context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "ProfilePrivacyCenter">;

export function ProfilePrivacyCenterScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const { t } = useTranslation();
  const [center, setCenter] = useState<PrivacyCenterResponse | null>(null);
  const [draft, setDraft] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getPrivacyCenter();
        if (!cancelled) {
          setCenter(data);
          setDraft(data.preferences);
        }
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          await signOut("sessionExpired");
          return;
        }
        Alert.alert(t("privacyError"), e instanceof ApiError ? e.message : t("couldNotLoadPrivacy"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signOut, t]);

  const setPrivacy = (patch: Partial<UserPreferences["privacy_preferences"]>) => {
    setDraft((current) =>
      current ? { ...current, privacy_preferences: { ...current.privacy_preferences, ...patch } } : current,
    );
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const updated = await updateUserPreferences({ privacy_preferences: draft.privacy_preferences });
      await setAchievementPrivacyReady();
      setDraft(updated);
      Alert.alert(t("privacySaved"), t("privacySavedMessage"));
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        await signOut("sessionExpired");
        return;
      }
      Alert.alert(t("privacyError"), e instanceof ApiError ? e.message : t("couldNotSavePrivacy"));
    } finally {
      setSaving(false);
    }
  };

  const exportData = async (exportType: PersonalExportType, labelKey: string) => {
    setSaving(true);
    setExportStatus(t("preparingExport"));
    try {
      const data = await exportPersonalData(exportType);
      const baseDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!baseDirectory) throw new ApiError(t("localFileStorageUnavailable"), 0);
      const fileName = `selfmind-${exportType}-export.json`;
      const localUri = `${baseDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(localUri, JSON.stringify(data, null, 2));
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(localUri, { mimeType: "application/json", UTI: "public.json", dialogTitle: t(labelKey) });
      }
      setExportStatus(`${t(labelKey)} ${t("exportReady").toLowerCase()}: ${localUri}`);
      Alert.alert(t("exportReady"), canShare ? t("exportGeneratedSensitive") : `${t("exportGeneratedSensitive")}\n${localUri}`);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : `${t("couldNotExport")} ${t(labelKey)}.`;
      setExportStatus(message);
      Alert.alert(t("exportError"), message);
    } finally {
      setSaving(false);
    }
  };

  const downloadPdfReport = async () => {
    setSaving(true);
    setExportStatus(t("generatingPdf"));
    try {
      const pdf = await downloadWeeklyPdfReport();
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(pdf.localUri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: t("openSharePdf") });
      }
      setExportStatus(`${t("pdfGenerated")} ${pdf.localUri}.`);
      Alert.alert(t("pdfGenerated"), canShare ? t("pdfGeneratedMessage") : `${t("sharingUnavailable")}\n${pdf.localUri}`);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : t("couldNotGeneratePdf");
      setExportStatus(message);
      Alert.alert(t("pdfReportError"), message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(t("deleteAccountConfirmTitle"), t("deleteAccountConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("deleteAllData"),
        style: "destructive",
        onPress: async () => {
          setSaving(true);
          try {
            await deleteUserAccount();
            await signOut();
          } catch (e) {
            Alert.alert(t("deleteError"), e instanceof ApiError ? e.message : t("couldNotDeleteAccount"));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.topRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{t("privacyCenter")}</Text>
        <Pressable style={styles.saveTopBtn} onPress={save} disabled={saving || !draft}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTopText}>{t("save")}</Text>}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.coral} />
        </View>
      ) : draft ? (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.card}>
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.coral} />
            <Text style={styles.cardTitle}>{t("privacyTitle")}</Text>
            <Text style={styles.text}>{t("privacyCenterSubtitle")}</Text>
            <Text style={styles.text}>{t("emotionalDataNotice")}</Text>
          </View>

          <Text style={styles.sectionLabel}>{t("privacyDefaults")}</Text>
          <ToggleRow
            label={t("privateDiaryDefault")}
            description={t("privateDiaryDefaultDesc")}
            value={draft.privacy_preferences.journal_private_default}
            onPress={() => setPrivacy({ journal_private_default: !draft.privacy_preferences.journal_private_default })}
          />
          <ToggleRow
            label={t("anonymousCommunityDefault")}
            description={t("anonymousCommunityDefaultDesc")}
            value={draft.privacy_preferences.anonymous_community_default}
            onPress={() => setPrivacy({ anonymous_community_default: !draft.privacy_preferences.anonymous_community_default })}
          />
          <ToggleRow
            label={t("allowAiInsights")}
            description={t("allowAiInsightsDesc")}
            value={draft.privacy_preferences.share_ai_insights}
            onPress={() => setPrivacy({ share_ai_insights: !draft.privacy_preferences.share_ai_insights, ai_processing_consent: !draft.privacy_preferences.share_ai_insights })}
          />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("exportReports")}</Text>
            <Text style={styles.text}>{t("exportReportsDesc")}</Text>
            <ActionButton label={t("exportJournalHistory")} icon="journal-outline" onPress={() => exportData("journal", "exportJournalHistory")} secondary disabled={saving} />
            <ActionButton label={t("exportMoodHistory")} icon="analytics-outline" onPress={() => exportData("mood", "exportMoodHistory")} secondary disabled={saving} />
            <ActionButton label={t("exportInsights")} icon="sparkles-outline" onPress={() => exportData("insights", "exportInsights")} secondary disabled={saving} />
            <ActionButton label={t("exportFullPersonalData")} icon="archive-outline" onPress={() => exportData("full", "exportFullPersonalData")} secondary disabled={saving} />
            <ActionButton label={t("downloadWeeklyPdf")} icon="document-text-outline" onPress={downloadPdfReport} disabled={saving} />
            {exportStatus ? <Text style={styles.text}>{exportStatus}</Text> : null}
          </View>

          <ActionButton label={t("deleteAccount")} icon="trash-outline" onPress={confirmDelete} danger disabled={saving} />
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

function ToggleRow({ label, description, value, onPress }: { label: string; description: string; value: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable style={styles.toggleRow} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.text}>{description}</Text>
      </View>
      <Text style={[styles.toggleText, value && { color: colors.coral }]}>{value ? t("on") : t("off")}</Text>
    </Pressable>
  );
}

function ActionButton({ label, icon, onPress, secondary, danger, disabled }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean }) {
  return (
    <Pressable style={[styles.actionBtn, secondary && styles.secondaryBtn, danger && styles.dangerBtn, disabled && { opacity: 0.55 }]} onPress={onPress} disabled={disabled}>
      <Ionicons name={icon} size={18} color={secondary ? colors.coral : "#fff"} />
      <Text style={secondary ? styles.secondaryText : styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSoft },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: "#EEF2F7" },
  title: { fontSize: 17, fontWeight: "900", color: colors.text },
  saveTopBtn: { minWidth: 72, minHeight: 36, borderRadius: 999, backgroundColor: colors.coral, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  saveTopText: { color: "#fff", fontWeight: "900" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 16, paddingBottom: 40, gap: 12 },
  sectionLabel: { fontSize: 12, fontWeight: "900", color: colors.textMuted, letterSpacing: 0.6, marginTop: 8, textTransform: "uppercase" },
  card: { backgroundColor: colors.white, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#E8ECF4", gap: 9 },
  cardTitle: { fontSize: 18, fontWeight: "900", color: colors.text },
  text: { fontSize: 13, color: colors.textMuted, lineHeight: 19, fontWeight: "600" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#E8ECF4", gap: 12 },
  toggleLabel: { fontSize: 15, fontWeight: "900", color: colors.text, marginBottom: 4 },
  toggleText: { color: colors.textMuted, fontSize: 12, fontWeight: "900" },
  actionBtn: { backgroundColor: colors.coral, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  actionText: { color: "#fff", fontWeight: "900" },
  secondaryBtn: { backgroundColor: "#FFF3F1", borderWidth: 1, borderColor: colors.coral },
  secondaryText: { color: colors.coral, fontWeight: "900" },
  dangerBtn: { backgroundColor: "#B91C1C" },
});
