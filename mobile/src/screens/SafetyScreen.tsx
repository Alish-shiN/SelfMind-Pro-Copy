import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import { CrisisResource, getCrisisResources } from "../api/safety";
import { SUPPORT_CONTACTS, SupportContact } from "../constants/supportContacts";
import type { HomeStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { useTranslation } from "../i18n/I18nContext";
import { getTrustedPersonPhone } from "../lib/storage";
import { getCurrentUser } from "../api/user";

type Props = NativeStackScreenProps<HomeStackParamList, "Safety">;

type ContactAction = "call" | "sms";

function normalizePhoneForUrl(value: string) {
  return value.replace(/[^+\d]/g, "");
}

async function openContactUrl(
  phone: string,
  action: ContactAction,
  fallbackMessage: string,
) {
  const normalized = normalizePhoneForUrl(phone);
  if (!normalized) {
    Alert.alert(fallbackMessage);
    return;
  }

  const url = `${action === "call" ? "tel" : "sms"}:${normalized}`;
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert(fallbackMessage);
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert(fallbackMessage);
  }
}

function SupportContactCard({ contact }: { contact: SupportContact }) {
  const { t } = useTranslation();
  return (
    <View style={styles.supportContactCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.resourceTitle}>{t(contact.nameKey)}</Text>
        <Text style={styles.contactRole}>{t(contact.roleKey)}</Text>
        {contact.descriptionKey ? (
          <Text style={styles.resourceDescription}>
            {t(contact.descriptionKey)}
          </Text>
        ) : null}
        <Text style={styles.contactPhone}>{contact.phone}</Text>
      </View>
      <View style={styles.contactActions}>
        <Pressable
          style={styles.smallContactButton}
          onPress={() =>
            openContactUrl(contact.phone, "call", t("couldNotOpenPhone"))
          }
        >
          <Text style={styles.smallContactButtonText}>{t("call")}</Text>
        </Pressable>
        <Pressable
          style={[styles.smallContactButton, styles.smsButton]}
          onPress={() =>
            openContactUrl(contact.phone, "sms", t("couldNotOpenSms"))
          }
        >
          <Text style={styles.smsButtonText}>{t("sms")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function SafetyScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [resources, setResources] = useState<CrisisResource[]>([]);
  const [trustedPhone, setTrustedPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [resourceData, user] = await Promise.all([
        getCrisisResources(),
        getCurrentUser(),
      ]);
      const savedTrustedPhone = await getTrustedPersonPhone(user.id);
      setResources(resourceData.filter((resource) => resource.action_value !== "trusted_person"));
      setTrustedPhone(savedTrustedPhone);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("couldNotLoadSafety"));
      setTrustedPhone(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const goToTrustedPersonSettings = () => {
    Alert.alert(t("trustedPersonMissing"));
    const rootNavigation = navigation.getParent()?.getParent();
    (rootNavigation as any)?.navigate("Profile", { openPersonalization: true });
  };

  const onTrustedPersonAction = (action: ContactAction) => {
    if (!trustedPhone?.trim()) {
      goToTrustedPersonSettings();
      return;
    }
    void openContactUrl(
      trustedPhone,
      action,
      action === "call" ? t("couldNotOpenPhone") : t("couldNotOpenSms"),
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("immediateHelp")}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.crisisCard}>
          <Ionicons name="warning-outline" size={30} color="#B91C1C" />
          <Text style={styles.crisisTitle}>{t("safetyDangerTitle")}</Text>
          <Text style={styles.crisisText}>{t("safetyDisclaimer")}</Text>
        </View>

        {loading ? (
          <ActivityIndicator
            color={colors.coral}
            style={{ marginVertical: 20 }}
          />
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.trustedCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="people-outline" size={22} color={colors.coral} />
            <View style={{ flex: 1 }}>
              <Text style={styles.checkTitle}>{t("trustedPerson")}</Text>
              <Text style={styles.checkHint}>{t("trustedPersonHelper")}</Text>
            </View>
          </View>
          {trustedPhone ? (
            <Text style={styles.contactPhone}>{trustedPhone}</Text>
          ) : (
            <Text style={styles.missingText}>{t("trustedPersonMissing")}</Text>
          )}
          <View style={styles.trustedActions}>
            <Pressable
              style={styles.contactButton}
              onPress={() => onTrustedPersonAction("call")}
            >
              <Ionicons name="call-outline" size={18} color="#fff" />
              <Text style={styles.contactButtonText}>{t("call")}</Text>
            </Pressable>
            <Pressable
              style={[styles.contactButton, styles.smsContactButton]}
              onPress={() => onTrustedPersonAction("sms")}
            >
              <Ionicons
                name="chatbubble-outline"
                size={18}
                color={colors.coral}
              />
              <Text style={styles.smsContactButtonText}>{t("sms")}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.checkCard}>
          <Text style={styles.checkTitle}>{t("therapistMentorMode")}</Text>
          <Text style={styles.checkHint}>{t("therapistMentorSubtitle")}</Text>
          <Text style={styles.disclaimerText}>{t("safetyDisclaimer")}</Text>
          {SUPPORT_CONTACTS.map((contact) => (
            <SupportContactCard key={contact.id} contact={contact} />
          ))}
        </View>

        {resources.map((resource) => (
          <View style={styles.resourceCard} key={resource.title}>
            <Text style={styles.resourceTitle}>{resource.title}</Text>
            <Text style={styles.resourceDescription}>
              {resource.description}
            </Text>
            <Pressable
              style={styles.resourceButton}
              onPress={() =>
                openContactUrl(
                  resource.action_value,
                  "call",
                  t("couldNotOpenPhone"),
                )
              }
            >
              <Ionicons name="call-outline" size={18} color="#fff" />
              <Text style={styles.resourceButtonText}>
                {resource.action_label}
              </Text>
            </Pressable>
          </View>
        ))}

        <View style={styles.groundingCard}>
          <Text style={styles.groundingTitle}>{t("rightNowSafetyStep")}</Text>
          <Text style={styles.groundingText}>{t("safetyStep1")}</Text>
          <Text style={styles.groundingText}>{t("safetyStep2")}</Text>
          <Text style={styles.groundingText}>{t("safetyStep3")}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSoft },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  headerTitle: { fontSize: 18, fontWeight: "900", color: colors.text },
  content: { paddingHorizontal: 18, paddingBottom: 28, gap: 14 },
  crisisCard: {
    backgroundColor: "#FEE2E2",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  crisisTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#991B1B",
    marginTop: 10,
  },
  crisisText: {
    color: "#7F1D1D",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    fontWeight: "600",
  },
  errorText: { color: "#B91C1C", fontWeight: "700" },
  resourceCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8ECF4",
  },
  resourceTitle: { fontSize: 16, fontWeight: "900", color: colors.text },
  resourceDescription: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  resourceButton: {
    marginTop: 12,
    backgroundColor: colors.coral,
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  resourceButtonText: { color: "#fff", fontWeight: "900" },
  groundingCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  groundingTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#92400E",
    marginBottom: 8,
  },
  groundingText: {
    color: "#78350F",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    marginTop: 4,
  },
  checkCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8ECF4",
    gap: 10,
  },
  trustedCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8ECF4",
    gap: 12,
  },
  cardHeaderRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  checkTitle: { fontSize: 16, fontWeight: "900", color: colors.text },
  checkHint: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  disclaimerText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  contactPhone: { color: colors.text, fontWeight: "800", marginTop: 6 },
  contactRole: { color: colors.coral, fontWeight: "900", marginTop: 3 },
  missingText: { color: "#B91C1C", fontWeight: "700" },
  trustedActions: { flexDirection: "row", gap: 10 },
  contactButton: {
    flex: 1,
    backgroundColor: colors.coral,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  contactButtonText: { color: "#fff", fontWeight: "900" },
  smsContactButton: { backgroundColor: "#FFF3F1" },
  smsContactButtonText: { color: colors.coral, fontWeight: "900" },
  supportContactCard: {
    borderWidth: 1,
    borderColor: "#EEF2F7",
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  contactActions: { flexDirection: "row", gap: 8 },
  smallContactButton: {
    backgroundColor: colors.coral,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  smallContactButtonText: { color: "#fff", fontWeight: "900" },
  smsButton: { backgroundColor: "#FFF3F1" },
  smsButtonText: { color: colors.coral, fontWeight: "900" },
});
