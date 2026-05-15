import { useCallback, useEffect, useMemo, useState } from "react";
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
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import {
  AdminAnalyticsOverview,
  AdminCommunityCommentModeration,
  AdminCommunityPostModeration,
  AdminRiskItem,
  AdminUserSummary,
  getAdminAnalyticsOverview,
  getAdminSummaryCsv,
  getAdminUsers,
  getModerationComments,
  getModerationPosts,
  getRiskItems,
  moderateComment,
  moderatePost,
  updateAdminUserRole,
  updateAdminUserStatus,
} from "../api/admin";
import { ApiError } from "../api/client";
import { getCurrentUser } from "../api/user";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../i18n/I18nContext";
import { colors } from "../theme/colors";

type AdminSection = "overview" | "users" | "moderation" | "safety";
type CurrentUser = {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
};

const sectionLabels: Array<{
  key: AdminSection;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: "overview", labelKey: "adminOverview", icon: "analytics-outline" },
  { key: "users", labelKey: "adminUsers", icon: "people-outline" },
  {
    key: "moderation",
    labelKey: "adminModeration",
    icon: "shield-checkmark-outline",
  },
  { key: "safety", labelKey: "adminSafety", icon: "warning-outline" },
];

const MODERATION_STATUS_ORDER: Record<string, number> = {
  pending_review: 0,
  visible: 1,
  hidden: 2,
};

function moderationStatusLabel(status: string, t: (key: string) => string) {
  if (status === "pending_review") return t("pendingReview");
  if (status === "visible") return t("visible");
  if (status === "hidden") return t("hidden");
  return status.replace(/_/g, " ");
}

function adminRoleLabel(role: string, t: (key: string) => string) {
  if (role === "admin") return t("adminRoleAdmin");
  if (role === "moderator") return t("adminRoleModerator");
  if (role === "user") return t("adminRoleUser");
  return role;
}

function sortModerationItems<
  T extends { moderation_status: string; updated_at: string },
>(items: T[]) {
  return [...items].sort((a, b) => {
    const aOrder = MODERATION_STATUS_ORDER[a.moderation_status] ?? 99;
    const bOrder = MODERATION_STATUS_ORDER[b.moderation_status] ?? 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

function shortDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function moderationStatusStyle(status: string) {
  if (status === "pending_review") return styles.statusPending;
  if (status === "hidden") return styles.statusHidden;
  return styles.statusActive;
}

function StatTile({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: "neutral" | "success" | "warning";
}) {
  const color =
    tone === "success"
      ? colors.accentGreen
      : tone === "warning"
        ? "#F59E0B"
        : colors.coral;
  return (
    <View style={styles.statTile}>
      <View style={[styles.statIcon, { backgroundColor: `${color}1A` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SectionTabs({
  active,
  onChange,
  isAdmin,
  t,
}: {
  active: AdminSection;
  onChange: (section: AdminSection) => void;
  isAdmin: boolean;
  t: (key: string) => string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabsRow}
    >
      {sectionLabels
        .filter(
          (item) =>
            isAdmin || item.key === "moderation" || item.key === "safety",
        )
        .map((item) => {
          const selected = active === item.key;
          return (
            <Pressable
              key={item.key}
              style={[styles.tabPill, selected && styles.tabPillActive]}
              onPress={() => onChange(item.key)}
            >
              <Ionicons
                name={item.icon}
                size={15}
                color={selected ? "#fff" : colors.textMuted}
              />
              <Text style={[styles.tabText, selected && styles.tabTextActive]}>
                {t(item.labelKey)}
              </Text>
            </Pressable>
          );
        })}
    </ScrollView>
  );
}

function ErrorCard({
  message,
  onRetry,
  t,
}: {
  message: string;
  onRetry: () => void;
  t: (key: string) => string;
}) {
  return (
    <View style={styles.errorCard}>
      <Text style={styles.errorTitle}>{t("adminCouldNotLoadData")}</Text>
      <Text style={styles.errorText}>{message}</Text>
      <Pressable style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryText}>{t("retry")}</Text>
      </Pressable>
    </View>
  );
}

export function AdminPanelScreen() {
  const { signOut } = useAuth();
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalyticsOverview | null>(
    null,
  );
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [posts, setPosts] = useState<AdminCommunityPostModeration[]>([]);
  const [comments, setComments] = useState<AdminCommunityCommentModeration[]>(
    [],
  );
  const [risks, setRisks] = useState<AdminRiskItem[]>([]);
  const [csvPreview, setCsvPreview] = useState<string | null>(null);
  const [csvData, setCsvData] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isAdmin = currentUser?.role === "admin";
  const isModerator =
    currentUser?.role === "admin" || currentUser?.role === "moderator";

  const load = useCallback(async () => {
    setError(null);
    try {
      const me = await getCurrentUser();
      setCurrentUser(me as CurrentUser);
      const moderatorRequests = [
        getModerationPosts(),
        getModerationComments(),
        getRiskItems(20),
      ] as const;

      if (me.role === "admin") {
        const [
          overview,
          userList,
          moderationPosts,
          moderationComments,
          riskItems,
        ] = await Promise.all([
          getAdminAnalyticsOverview(),
          getAdminUsers(),
          ...moderatorRequests,
        ]);
        setAnalytics(overview);
        setUsers(userList);
        setPosts(moderationPosts);
        setComments(moderationComments);
        setRisks(riskItems);
      } else if (me.role === "moderator") {
        const [moderationPosts, moderationComments, riskItems] =
          await Promise.all(moderatorRequests);
        setPosts(moderationPosts);
        setComments(moderationComments);
        setRisks(riskItems);
        setActiveSection((section) =>
          section === "moderation" || section === "safety"
            ? section
            : "moderation",
        );
      } else {
        setError(t("adminOnly"));
      }
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        if (e.status === 401) {
          await signOut("sessionExpired");
          return;
        }
        setError(e.message || t("adminInsufficientPermissions"));
      } else {
        setError(
          e instanceof ApiError ? e.message : t("adminCouldNotLoadPanel"),
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [signOut, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const visibleUsers = useMemo(() => users.slice(0, 8), [users]);
  const visiblePosts = useMemo(
    () => sortModerationItems(posts).slice(0, 20),
    [posts],
  );
  const visibleComments = useMemo(
    () => sortModerationItems(comments).slice(0, 20),
    [comments],
  );
  const visibleRisks = useMemo(() => risks.slice(0, 8), [risks]);

  const runAction = async (
    action: () => Promise<unknown>,
    successMessage: string,
  ) => {
    setActionLoading(true);
    try {
      await action();
      await load();
      Alert.alert(t("adminDone"), successMessage);
    } catch (e) {
      Alert.alert(
        t("adminActionFailed"),
        e instanceof ApiError ? e.message : t("pleaseTryAgain"),
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleUser = (user: AdminUserSummary) => {
    Alert.alert(
      user.is_active
        ? t("adminDeactivateUserTitle")
        : t("adminActivateUserTitle"),
      t("adminUserAccessChange", {
        username: user.username,
        action: user.is_active ? t("adminLoseAccess") : t("adminRegainAccess"),
      }),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: user.is_active ? t("adminDeactivate") : t("adminActivate"),
          style: user.is_active ? "destructive" : "default",
          onPress: () =>
            runAction(
              () => updateAdminUserStatus(user.id, !user.is_active),
              user.is_active
                ? t("adminUserDeactivated")
                : t("adminUserActivated"),
            ),
        },
      ],
    );
  };

  const handlePromoteUser = (user: AdminUserSummary) => {
    const nextRole =
      user.role === "admin"
        ? "user"
        : user.role === "moderator"
          ? "admin"
          : "moderator";
    const nextRoleLabel = adminRoleLabel(nextRole, t);
    Alert.alert(
      t("adminChangeRoleTitle"),
      t("adminSetRoleQuestion", {
        username: user.username,
        role: nextRoleLabel,
      }),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("adminSetRole", { role: nextRoleLabel }),
          onPress: () =>
            runAction(
              () => updateAdminUserRole(user.id, nextRole),
              t("adminRoleChanged", { role: nextRoleLabel }),
            ),
        },
      ],
    );
  };

  const handleModeratePost = (
    post: AdminCommunityPostModeration,
    nextStatus?: "visible" | "hidden",
  ) => {
    const status =
      nextStatus ??
      (post.moderation_status === "hidden" ? "visible" : "hidden");
    runAction(
      () =>
        moderatePost(
          post.id,
          status,
          status === "hidden" ? t("adminHiddenReason") : null,
        ),
      t("adminPostMarked", { status: moderationStatusLabel(status, t) }),
    );
  };

  const handleModerateComment = (
    comment: AdminCommunityCommentModeration,
    nextStatus?: "visible" | "hidden",
  ) => {
    const status =
      nextStatus ??
      (comment.moderation_status === "hidden" ? "visible" : "hidden");
    runAction(
      () =>
        moderateComment(
          comment.id,
          status,
          status === "hidden" ? t("adminHiddenReason") : null,
        ),
      t("adminCommentMarked", { status: moderationStatusLabel(status, t) }),
    );
  };

  const saveAndShareCsv = async (csv: string) => {
    const baseDirectory =
      FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
    if (!baseDirectory) throw new ApiError(t("localFileStorageUnavailable"), 0);
    const localUri = `${baseDirectory}selfmind-admin-summary-${Date.now()}.csv`;
    await FileSystem.writeAsStringAsync(localUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(localUri, {
        mimeType: "text/csv",
        UTI: "public.comma-separated-values-text",
        dialogTitle: t("adminDownloadCsv"),
      });
    }
    return { localUri, canShare };
  };

  const handleCsvDownload = async () => {
    setActionLoading(true);
    try {
      const csv = csvData ?? (await getAdminSummaryCsv());
      setCsvData(csv);
      setCsvPreview(csv.split("\n").slice(0, 8).join("\n"));
      const { localUri, canShare } = await saveAndShareCsv(csv);
      Alert.alert(
        t("adminCsvReady"),
        canShare ? t("adminCsvShared") : `${t("adminCsvSaved")}\n${localUri}`,
      );
    } catch (e) {
      Alert.alert(
        t("adminCsvError"),
        e instanceof ApiError ? e.message : t("adminCouldNotLoadCsv"),
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleCsvPreviewPress = async () => {
    if (!csvData) return;
    setActionLoading(true);
    try {
      const { localUri, canShare } = await saveAndShareCsv(csvData);
      Alert.alert(
        t("adminCsvReady"),
        canShare ? t("adminCsvShared") : `${t("adminCsvSaved")}\n${localUri}`,
      );
    } catch (e) {
      Alert.alert(
        t("adminCsvError"),
        e instanceof ApiError ? e.message : t("adminCouldNotLoadCsv"),
      );
    } finally {
      setActionLoading(false);
    }
  };

  const renderOverview = () => (
    <View style={styles.sectionBlock}>
      <View style={styles.grid}>
        <StatTile
          label={t("adminTotalUsers")}
          value={analytics?.total_users ?? "—"}
          icon="people-outline"
        />
        <StatTile
          label={t("adminActiveUsers")}
          value={analytics?.active_users ?? "—"}
          icon="pulse-outline"
          tone="success"
        />
        <StatTile
          label={t("adminJournalEntries")}
          value={analytics?.total_journal_entries ?? "—"}
          icon="journal-outline"
        />
        <StatTile
          label={t("adminAiChats")}
          value={analytics?.total_ai_chat_sessions ?? "—"}
          icon="chatbubbles-outline"
        />
        <StatTile
          label={t("adminAiQuizzes")}
          value={analytics?.total_ai_quizzes ?? "—"}
          icon="help-circle-outline"
        />
        <StatTile
          label={t("adminCommunityPosts")}
          value={analytics?.total_community_posts ?? "—"}
          icon="people-circle-outline"
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>{t("adminMostCommonMoods")}</Text>
          <Ionicons name="stats-chart-outline" size={18} color={colors.coral} />
        </View>
        {(analytics?.most_common_moods?.length ?? 0) === 0 ? (
          <Text style={styles.emptyText}>{t("adminNoMoodData")}</Text>
        ) : (
          analytics?.most_common_moods.map((mood) => (
            <View style={styles.metricRow} key={mood.mood_score}>
              <Text style={styles.metricLabel}>
                {t("adminMoodValue", { score: mood.mood_score })}
              </Text>
              <Text style={styles.metricValue}>{mood.count}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>{t("adminTopEmotions")}</Text>
          <Ionicons name="heart-outline" size={18} color={colors.coral} />
        </View>
        {(analytics?.most_common_emotions?.length ?? 0) === 0 ? (
          <Text style={styles.emptyText}>{t("adminNoEmotions")}</Text>
        ) : (
          analytics?.most_common_emotions.map((emotion) => (
            <View style={styles.metricRow} key={emotion.emotion}>
              <Text style={styles.metricLabel}>{emotion.emotion}</Text>
              <Text style={styles.metricValue}>{emotion.count}</Text>
            </View>
          ))
        )}
      </View>

      <Pressable
        style={styles.secondaryButton}
        onPress={handleCsvDownload}
        disabled={actionLoading}
      >
        <Ionicons name="download-outline" size={18} color={colors.coral} />
        <Text style={styles.secondaryButtonText}>{t("adminDownloadCsv")}</Text>
      </Pressable>
      {csvPreview ? (
        <Pressable onPress={handleCsvPreviewPress} disabled={actionLoading}>
          <Text style={styles.csvPreview}>{csvPreview}</Text>
          <Text style={styles.csvPreviewHint}>{t("adminCsvPreviewHint")}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const renderUsers = () => (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>{t("adminUsersActivity")}</Text>
      {visibleUsers.map((user) => (
        <View style={styles.userCard} key={user.id}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{user.username}</Text>
              <Text style={styles.itemSubtitle}>{user.email}</Text>
            </View>
            <View
              style={[
                styles.statusPill,
                user.is_active ? styles.statusActive : styles.statusHidden,
              ]}
            >
              <Text style={styles.statusText}>
                {user.is_active ? t("adminActive") : t("adminBlocked")}
              </Text>
            </View>
          </View>
          <Text style={styles.itemMeta}>
            {t("adminRoleJoined", {
              role: adminRoleLabel(user.role, t),
              date: shortDate(user.created_at),
            })}
          </Text>
          <View style={styles.countRow}>
            <Text style={styles.countText}>
              {t("adminJournalCount", { count: user.journal_entries_count })}
            </Text>
            <Text style={styles.countText}>
              {t("adminChatsCount", { count: user.ai_chat_sessions_count })}
            </Text>
            <Text style={styles.countText}>
              {t("adminQuizzesCount", { count: user.ai_quiz_sessions_count })}
            </Text>
          </View>
          <View style={styles.actionRow}>
            <Pressable
              style={styles.smallButton}
              onPress={() => handleToggleUser(user)}
              disabled={actionLoading}
            >
              <Text style={styles.smallButtonText}>
                {user.is_active ? t("adminBlock") : t("adminActivate")}
              </Text>
            </Pressable>
            <Pressable
              style={styles.smallButtonGhost}
              onPress={() => handlePromoteUser(user)}
              disabled={actionLoading}
            >
              <Text style={styles.smallButtonGhostText}>
                {t("adminChangeRole")}
              </Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );

  const renderModeration = () => (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>{t("adminCommunityModeration")}</Text>
      <Text style={styles.sectionHint}>{t("adminPosts")}</Text>
      {visiblePosts.length === 0 ? (
        <Text style={styles.emptyText}>{t("adminNoPostsModerate")}</Text>
      ) : null}
      {visiblePosts.map((post) => (
        <View style={styles.moderationCard} key={post.id}>
          <View style={styles.rowBetween}>
            <Text style={styles.itemTitle}>@{post.username}</Text>
            <Text style={styles.itemMeta}>{shortDate(post.created_at)}</Text>
          </View>
          <Text style={styles.contentText} numberOfLines={3}>
            {post.content}
          </Text>
          <View style={styles.rowBetween}>
            <View
              style={[
                styles.statusPill,
                moderationStatusStyle(post.moderation_status),
              ]}
            >
              <Text style={styles.statusText}>
                {moderationStatusLabel(post.moderation_status, t)}
              </Text>
            </View>
            <View style={styles.actionRowCompact}>
              {post.moderation_status === "pending_review" ? (
                <Pressable
                  style={styles.smallButtonGhost}
                  onPress={() => handleModeratePost(post, "hidden")}
                  disabled={actionLoading}
                >
                  <Text style={styles.smallButtonGhostText}>
                    {t("adminHide")}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                style={styles.smallButton}
                onPress={() =>
                  handleModeratePost(
                    post,
                    post.moderation_status === "pending_review"
                      ? "visible"
                      : undefined,
                  )
                }
                disabled={actionLoading}
              >
                <Text style={styles.smallButtonText}>
                  {post.moderation_status === "pending_review"
                    ? t("adminApprove")
                    : post.moderation_status === "hidden"
                      ? t("adminShow")
                      : t("adminHide")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ))}

      <Text style={styles.sectionHint}>{t("adminComments")}</Text>
      {visibleComments.length === 0 ? (
        <Text style={styles.emptyText}>{t("adminNoCommentsModerate")}</Text>
      ) : null}
      {visibleComments.map((comment) => (
        <View style={styles.moderationCard} key={comment.id}>
          <View style={styles.rowBetween}>
            <Text style={styles.itemTitle}>@{comment.username}</Text>
            <Text style={styles.itemMeta}>
              {t("adminPostNumber", { id: comment.post_id })}
            </Text>
          </View>
          <Text style={styles.contentText} numberOfLines={3}>
            {comment.content}
          </Text>
          <View style={styles.rowBetween}>
            <View
              style={[
                styles.statusPill,
                moderationStatusStyle(comment.moderation_status),
              ]}
            >
              <Text style={styles.statusText}>
                {moderationStatusLabel(comment.moderation_status, t)}
              </Text>
            </View>
            <View style={styles.actionRowCompact}>
              {comment.moderation_status === "pending_review" ? (
                <Pressable
                  style={styles.smallButtonGhost}
                  onPress={() => handleModerateComment(comment, "hidden")}
                  disabled={actionLoading}
                >
                  <Text style={styles.smallButtonGhostText}>
                    {t("adminHide")}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                style={styles.smallButton}
                onPress={() =>
                  handleModerateComment(
                    comment,
                    comment.moderation_status === "pending_review"
                      ? "visible"
                      : undefined,
                  )
                }
                disabled={actionLoading}
              >
                <Text style={styles.smallButtonText}>
                  {comment.moderation_status === "pending_review"
                    ? t("adminApprove")
                    : comment.moderation_status === "hidden"
                      ? t("adminShow")
                      : t("adminHide")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  const renderSafety = () => (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>{t("adminSafetySignals")}</Text>
      {visibleRisks.length === 0 ? (
        <Text style={styles.emptyText}>{t("adminNoRisks")}</Text>
      ) : null}
      {visibleRisks.map((risk) => (
        <View style={styles.riskCard} key={`${risk.source}-${risk.id}`}>
          <View style={styles.rowBetween}>
            <Text style={styles.itemTitle}>
              {risk.source === "journal_entry"
                ? t("adminJournalEntry")
                : risk.source === "community_post"
                  ? t("adminCommunityPost")
                  : risk.source.replace("_", " ")}
            </Text>
            <Text style={styles.itemMeta}>{shortDate(risk.created_at)}</Text>
          </View>
          <Text style={styles.itemSubtitle}>
            {t("adminUserLabel", {
              user:
                risk.username ?? `#${risk.user_id ?? t("adminUnknownUser")}`,
            })}
          </Text>
          <Text style={styles.contentText} numberOfLines={4}>
            {risk.content}
          </Text>
          <Text style={styles.keywordText}>
            {t("adminMatched", { keywords: risk.matched_keywords.join(", ") })}
          </Text>
        </View>
      ))}
    </View>
  );

  const renderActiveSection = () => {
    if (!isModerator) return null;
    if (activeSection === "overview") return isAdmin ? renderOverview() : null;
    if (activeSection === "users") return isAdmin ? renderUsers() : null;
    if (activeSection === "moderation") return renderModeration();
    if (activeSection === "safety") return renderSafety();
    return null;
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>SelfMind Pro</Text>
          <Text style={styles.title}>{t("adminPanel")}</Text>
        </View>
        <View style={styles.roleBadge}>
          <Ionicons
            name="person-circle-outline"
            size={16}
            color={colors.coral}
          />
          <Text style={styles.roleText}>
            {currentUser?.role ?? t("loading")}
          </Text>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.coral} />
          <Text style={styles.loadingText}>{t("adminLoadingDashboard")}</Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.coral}
            />
          }
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {error ? <ErrorCard message={error} onRetry={load} t={t} /> : null}
          {isModerator ? (
            <>
              <SectionTabs
                active={activeSection}
                onChange={setActiveSection}
                isAdmin={isAdmin}
                t={t}
              />
              {renderActiveSection()}
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSoft },
  header: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  title: { fontSize: 28, fontWeight: "900", color: colors.text, marginTop: 2 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E8ECF4",
  },
  roleText: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.text,
    textTransform: "uppercase",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: colors.textMuted, fontWeight: "700" },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
  tabsRow: { gap: 8, paddingBottom: 14 },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E8ECF4",
  },
  tabPillActive: { backgroundColor: colors.coral, borderColor: colors.coral },
  tabText: { color: colors.textMuted, fontSize: 12, fontWeight: "900" },
  tabTextActive: { color: "#fff" },
  sectionBlock: { gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "900", color: colors.text },
  sectionHint: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.textMuted,
    textTransform: "uppercase",
    marginTop: 6,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statTile: {
    width: "48%",
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E8ECF4",
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.text,
    marginTop: 12,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textMuted,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8ECF4",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: "900", color: colors.text },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#F0F2F7",
  },
  metricLabel: { color: colors.textMuted, fontWeight: "700" },
  metricValue: { color: colors.text, fontWeight: "900" },
  emptyText: {
    color: colors.textMuted,
    fontWeight: "700",
    paddingVertical: 10,
  },
  errorCard: {
    backgroundColor: "#FFE5E5",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  errorTitle: { fontSize: 15, fontWeight: "900", color: "#991B1B" },
  errorText: { color: "#B91C1C", marginTop: 6, lineHeight: 19 },
  retryButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: colors.coral,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: { color: "#fff", fontWeight: "900" },
  userCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E8ECF4",
  },
  moderationCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E8ECF4",
  },
  riskCard: {
    backgroundColor: "#FFF7ED",
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  contentCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E8ECF4",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.text,
    flexShrink: 1,
  },
  itemSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "700",
    marginTop: 3,
  },
  itemMeta: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "700",
    marginTop: 8,
  },
  contentText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  keywordText: {
    color: "#9A3412",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 10,
  },
  countRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  countText: {
    backgroundColor: "#F5F7FA",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
  },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  actionRowCompact: { flexDirection: "row", gap: 8, alignItems: "center" },
  smallButton: {
    backgroundColor: colors.coral,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  smallButtonText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  smallButtonGhost: {
    backgroundColor: "#FFF3F1",
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  smallButtonGhostText: {
    color: colors.coral,
    fontWeight: "900",
    fontSize: 12,
  },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusActive: { backgroundColor: "#DCFCE7" },
  statusPending: { backgroundColor: "#FEF3C7" },
  statusHidden: { backgroundColor: "#FEE2E2" },
  statusText: { fontSize: 11, fontWeight: "900", color: colors.text },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E8ECF4",
    justifyContent: "center",
  },
  secondaryButtonText: { color: colors.coral, fontWeight: "900" },
  csvPreview: {
    backgroundColor: "#111827",
    color: "#E5E7EB",
    borderRadius: 14,
    padding: 12,
    fontSize: 11,
    lineHeight: 16,
    overflow: "hidden",
  },
  csvPreviewHint: {
    color: colors.coral,
    fontWeight: "900",
    fontSize: 12,
    marginTop: 6,
    textAlign: "right",
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.coral,
    alignItems: "center",
    justifyContent: "center",
  },
});
