import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  AdminAnalyticsOverview,
  AdminCommunityCommentModeration,
  AdminCommunityPostModeration,
  AdminContentItem,
  AdminRiskItem,
  AdminUserSummary,
  createAdminContent,
  getAdminAnalyticsOverview,
  getAdminContent,
  getAdminSummaryCsv,
  getAdminUsers,
  getModerationComments,
  getModerationPosts,
  getRiskItems,
  moderateComment,
  moderatePost,
  updateAdminUserRole,
  updateAdminUserStatus,
} from '../api/admin';
import { ApiError } from '../api/client';
import { getCurrentUser } from '../api/user';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

type AdminSection = 'overview' | 'users' | 'moderation' | 'safety' | 'content';
type CurrentUser = { id: number; username: string; email: string; role: string; is_active: boolean };

const sectionLabels: Array<{ key: AdminSection; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'overview', label: 'Overview', icon: 'analytics-outline' },
  { key: 'users', label: 'Users', icon: 'people-outline' },
  { key: 'moderation', label: 'Moderation', icon: 'shield-checkmark-outline' },
  { key: 'safety', label: 'Safety', icon: 'warning-outline' },
  { key: 'content', label: 'Content', icon: 'create-outline' },
];

function shortDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function StatTile({ label, value, icon, tone = 'neutral' }: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  const color = tone === 'success' ? colors.accentGreen : tone === 'warning' ? '#F59E0B' : colors.coral;
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

function SectionTabs({ active, onChange, isAdmin }: {
  active: AdminSection;
  onChange: (section: AdminSection) => void;
  isAdmin: boolean;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
      {sectionLabels
        .filter((item) => isAdmin || item.key === 'moderation' || item.key === 'safety')
        .map((item) => {
          const selected = active === item.key;
          return (
            <Pressable
              key={item.key}
              style={[styles.tabPill, selected && styles.tabPillActive]}
              onPress={() => onChange(item.key)}
            >
              <Ionicons name={item.icon} size={15} color={selected ? '#fff' : colors.textMuted} />
              <Text style={[styles.tabText, selected && styles.tabTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
    </ScrollView>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorCard}>
      <Text style={styles.errorTitle}>Could not load admin data</Text>
      <Text style={styles.errorText}>{message}</Text>
      <Pressable style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>
  );
}

export function AdminPanelScreen() {
  const { signOut } = useAuth();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalyticsOverview | null>(null);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [posts, setPosts] = useState<AdminCommunityPostModeration[]>([]);
  const [comments, setComments] = useState<AdminCommunityCommentModeration[]>([]);
  const [risks, setRisks] = useState<AdminRiskItem[]>([]);
  const [content, setContent] = useState<AdminContentItem[]>([]);
  const [csvPreview, setCsvPreview] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isAdmin = currentUser?.role === 'admin';
  const isModerator = currentUser?.role === 'admin' || currentUser?.role === 'moderator';

  const load = useCallback(async () => {
    setError(null);
    try {
      const me = await getCurrentUser();
      setCurrentUser(me as CurrentUser);
      const moderatorRequests = [getModerationPosts(), getModerationComments(), getRiskItems(20)] as const;

      if (me.role === 'admin') {
        const [overview, userList, moderationPosts, moderationComments, riskItems, contentItems] = await Promise.all([
          getAdminAnalyticsOverview(),
          getAdminUsers(),
          ...moderatorRequests,
          getAdminContent(),
        ]);
        setAnalytics(overview);
        setUsers(userList);
        setPosts(moderationPosts);
        setComments(moderationComments);
        setRisks(riskItems);
        setContent(contentItems);
      } else if (me.role === 'moderator') {
        const [moderationPosts, moderationComments, riskItems] = await Promise.all(moderatorRequests);
        setPosts(moderationPosts);
        setComments(moderationComments);
        setRisks(riskItems);
        setActiveSection((section) => (section === 'moderation' || section === 'safety' ? section : 'moderation'));
      } else {
        setError('This screen is available only for admin or moderator accounts.');
      }
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        if (e.status === 401) {
          await signOut();
          return;
        }
        setError(e.message || 'Insufficient permissions.');
      } else {
        setError(e instanceof ApiError ? e.message : 'Could not load admin panel.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [signOut]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const visibleUsers = useMemo(() => users.slice(0, 8), [users]);
  const visiblePosts = useMemo(() => posts.slice(0, 5), [posts]);
  const visibleComments = useMemo(() => comments.slice(0, 5), [comments]);
  const visibleRisks = useMemo(() => risks.slice(0, 8), [risks]);
  const visibleContent = useMemo(() => content.slice(0, 6), [content]);

  const runAction = async (action: () => Promise<unknown>, successMessage: string) => {
    setActionLoading(true);
    try {
      await action();
      await load();
      Alert.alert('Done', successMessage);
    } catch (e) {
      Alert.alert('Action failed', e instanceof ApiError ? e.message : 'Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleUser = (user: AdminUserSummary) => {
    Alert.alert(
      user.is_active ? 'Deactivate user?' : 'Activate user?',
      `${user.username} will ${user.is_active ? 'lose access to the app' : 'be able to log in again'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: user.is_active ? 'Deactivate' : 'Activate',
          style: user.is_active ? 'destructive' : 'default',
          onPress: () => runAction(
            () => updateAdminUserStatus(user.id, !user.is_active),
            `User ${user.is_active ? 'deactivated' : 'activated'}.`
          ),
        },
      ]
    );
  };

  const handlePromoteUser = (user: AdminUserSummary) => {
    const nextRole = user.role === 'admin' ? 'user' : user.role === 'moderator' ? 'admin' : 'moderator';
    Alert.alert('Change role?', `Set ${user.username} role to ${nextRole}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: `Set ${nextRole}`,
        onPress: () => runAction(() => updateAdminUserRole(user.id, nextRole), `Role changed to ${nextRole}.`),
      },
    ]);
  };

  const handleModeratePost = (post: AdminCommunityPostModeration) => {
    const nextStatus = post.moderation_status === 'hidden' ? 'visible' : 'hidden';
    runAction(
      () => moderatePost(post.id, nextStatus, nextStatus === 'hidden' ? 'Hidden from mobile admin panel' : null),
      `Post marked as ${nextStatus}.`
    );
  };

  const handleModerateComment = (comment: AdminCommunityCommentModeration) => {
    const nextStatus = comment.moderation_status === 'hidden' ? 'visible' : 'hidden';
    runAction(
      () => moderateComment(comment.id, nextStatus, nextStatus === 'hidden' ? 'Hidden from mobile admin panel' : null),
      `Comment marked as ${nextStatus}.`
    );
  };

  const handleCreatePrompt = () => runAction(
    () => createAdminContent({
      content_type: 'motivational_prompt',
      title: 'Daily gentle reflection',
      body: 'Take a slow breath and write one honest sentence about what you need today.',
      content_metadata: { source: 'mobile-admin', language: 'en' },
      is_active: true,
    }),
    'Motivational prompt created.'
  );

  const handleCsvPreview = async () => {
    setActionLoading(true);
    try {
      const csv = await getAdminSummaryCsv();
      setCsvPreview(csv.split('\n').slice(0, 8).join('\n'));
    } catch (e) {
      Alert.alert('CSV error', e instanceof ApiError ? e.message : 'Could not load CSV report.');
    } finally {
      setActionLoading(false);
    }
  };

  const renderOverview = () => (
    <View style={styles.sectionBlock}>
      <View style={styles.grid}>
        <StatTile label="Total users" value={analytics?.total_users ?? '—'} icon="people-outline" />
        <StatTile label="Active users" value={analytics?.active_users ?? '—'} icon="pulse-outline" tone="success" />
        <StatTile label="Journal entries" value={analytics?.total_journal_entries ?? '—'} icon="journal-outline" />
        <StatTile label="AI chats" value={analytics?.total_ai_chat_sessions ?? '—'} icon="chatbubbles-outline" />
        <StatTile label="AI quizzes" value={analytics?.total_ai_quizzes ?? '—'} icon="help-circle-outline" />
        <StatTile label="Community posts" value={analytics?.total_community_posts ?? '—'} icon="people-circle-outline" />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Most common moods</Text>
          <Ionicons name="stats-chart-outline" size={18} color={colors.coral} />
        </View>
        {(analytics?.most_common_moods?.length ?? 0) === 0 ? (
          <Text style={styles.emptyText}>No mood data yet.</Text>
        ) : analytics?.most_common_moods.map((mood) => (
          <View style={styles.metricRow} key={mood.mood_score}>
            <Text style={styles.metricLabel}>Mood {mood.mood_score}/10</Text>
            <Text style={styles.metricValue}>{mood.count}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Top emotions</Text>
          <Ionicons name="heart-outline" size={18} color={colors.coral} />
        </View>
        {(analytics?.most_common_emotions?.length ?? 0) === 0 ? (
          <Text style={styles.emptyText}>No analyzed emotions yet.</Text>
        ) : analytics?.most_common_emotions.map((emotion) => (
          <View style={styles.metricRow} key={emotion.emotion}>
            <Text style={styles.metricLabel}>{emotion.emotion}</Text>
            <Text style={styles.metricValue}>{emotion.count}</Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.secondaryButton} onPress={handleCsvPreview} disabled={actionLoading}>
        <Ionicons name="download-outline" size={18} color={colors.coral} />
        <Text style={styles.secondaryButtonText}>Preview CSV report</Text>
      </Pressable>
      {csvPreview ? <Text style={styles.csvPreview}>{csvPreview}</Text> : null}
    </View>
  );

  const renderUsers = () => (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>Users and activity</Text>
      {visibleUsers.map((user) => (
        <View style={styles.userCard} key={user.id}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{user.username}</Text>
              <Text style={styles.itemSubtitle}>{user.email}</Text>
            </View>
            <View style={[styles.statusPill, user.is_active ? styles.statusActive : styles.statusHidden]}>
              <Text style={styles.statusText}>{user.is_active ? 'active' : 'blocked'}</Text>
            </View>
          </View>
          <Text style={styles.itemMeta}>Role: {user.role} · Joined {shortDate(user.created_at)}</Text>
          <View style={styles.countRow}>
            <Text style={styles.countText}>Journal {user.journal_entries_count}</Text>
            <Text style={styles.countText}>Chats {user.ai_chat_sessions_count}</Text>
            <Text style={styles.countText}>Quizzes {user.ai_quiz_sessions_count}</Text>
          </View>
          <View style={styles.actionRow}>
            <Pressable style={styles.smallButton} onPress={() => handleToggleUser(user)} disabled={actionLoading}>
              <Text style={styles.smallButtonText}>{user.is_active ? 'Block' : 'Activate'}</Text>
            </Pressable>
            <Pressable style={styles.smallButtonGhost} onPress={() => handlePromoteUser(user)} disabled={actionLoading}>
              <Text style={styles.smallButtonGhostText}>Change role</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );

  const renderModeration = () => (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>Community moderation</Text>
      <Text style={styles.sectionHint}>Posts</Text>
      {visiblePosts.length === 0 ? <Text style={styles.emptyText}>No posts to moderate.</Text> : null}
      {visiblePosts.map((post) => (
        <View style={styles.moderationCard} key={post.id}>
          <View style={styles.rowBetween}>
            <Text style={styles.itemTitle}>@{post.username}</Text>
            <Text style={styles.itemMeta}>{shortDate(post.created_at)}</Text>
          </View>
          <Text style={styles.contentText} numberOfLines={3}>{post.content}</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.itemMeta}>Status: {post.moderation_status}</Text>
            <Pressable style={styles.smallButton} onPress={() => handleModeratePost(post)} disabled={actionLoading}>
              <Text style={styles.smallButtonText}>{post.moderation_status === 'hidden' ? 'Show' : 'Hide'}</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Text style={styles.sectionHint}>Comments</Text>
      {visibleComments.length === 0 ? <Text style={styles.emptyText}>No comments to moderate.</Text> : null}
      {visibleComments.map((comment) => (
        <View style={styles.moderationCard} key={comment.id}>
          <View style={styles.rowBetween}>
            <Text style={styles.itemTitle}>@{comment.username}</Text>
            <Text style={styles.itemMeta}>Post #{comment.post_id}</Text>
          </View>
          <Text style={styles.contentText} numberOfLines={3}>{comment.content}</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.itemMeta}>Status: {comment.moderation_status}</Text>
            <Pressable style={styles.smallButton} onPress={() => handleModerateComment(comment)} disabled={actionLoading}>
              <Text style={styles.smallButtonText}>{comment.moderation_status === 'hidden' ? 'Show' : 'Hide'}</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );

  const renderSafety = () => (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>Safety signals</Text>
      {visibleRisks.length === 0 ? <Text style={styles.emptyText}>No risk keyword matches found.</Text> : null}
      {visibleRisks.map((risk) => (
        <View style={styles.riskCard} key={`${risk.source}-${risk.id}`}>
          <View style={styles.rowBetween}>
            <Text style={styles.itemTitle}>{risk.source.replace('_', ' ')}</Text>
            <Text style={styles.itemMeta}>{shortDate(risk.created_at)}</Text>
          </View>
          <Text style={styles.itemSubtitle}>User: {risk.username ?? `#${risk.user_id ?? 'unknown'}`}</Text>
          <Text style={styles.contentText} numberOfLines={4}>{risk.content}</Text>
          <Text style={styles.keywordText}>Matched: {risk.matched_keywords.join(', ')}</Text>
        </View>
      ))}
    </View>
  );

  const renderContent = () => (
    <View style={styles.sectionBlock}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.sectionTitle}>Managed content</Text>
          <Text style={styles.itemSubtitle}>Prompts, onboarding tips, quiz templates</Text>
        </View>
        <Pressable style={styles.iconButton} onPress={handleCreatePrompt} disabled={actionLoading}>
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>
      {visibleContent.length === 0 ? <Text style={styles.emptyText}>No content items yet. Tap + to create a prompt.</Text> : null}
      {visibleContent.map((item) => (
        <View style={styles.contentCard} key={item.id}>
          <View style={styles.rowBetween}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <View style={[styles.statusPill, item.is_active ? styles.statusActive : styles.statusHidden]}>
              <Text style={styles.statusText}>{item.is_active ? 'active' : 'off'}</Text>
            </View>
          </View>
          <Text style={styles.itemMeta}>{item.content_type}</Text>
          <Text style={styles.contentText} numberOfLines={3}>{item.body}</Text>
        </View>
      ))}
    </View>
  );

  const renderActiveSection = () => {
    if (!isModerator) return null;
    if (activeSection === 'overview') return isAdmin ? renderOverview() : null;
    if (activeSection === 'users') return isAdmin ? renderUsers() : null;
    if (activeSection === 'moderation') return renderModeration();
    if (activeSection === 'safety') return renderSafety();
    if (activeSection === 'content') return isAdmin ? renderContent() : null;
    return null;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>SelfMind Pro</Text>
          <Text style={styles.title}>Admin panel</Text>
        </View>
        <View style={styles.roleBadge}>
          <Ionicons name="person-circle-outline" size={16} color={colors.coral} />
          <Text style={styles.roleText}>{currentUser?.role ?? 'loading'}</Text>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.coral} />
          <Text style={styles.loadingText}>Loading system dashboard…</Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {error ? <ErrorCard message={error} onRetry={load} /> : null}
          {isModerator ? (
            <>
              <SectionTabs active={activeSection} onChange={setActiveSection} isAdmin={isAdmin} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: { fontSize: 12, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.6 },
  title: { fontSize: 28, fontWeight: '900', color: colors.text, marginTop: 2 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  roleText: { fontSize: 12, fontWeight: '900', color: colors.text, textTransform: 'uppercase' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.textMuted, fontWeight: '700' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
  tabsRow: { gap: 8, paddingBottom: 14 },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  tabPillActive: { backgroundColor: colors.coral, borderColor: colors.coral },
  tabText: { color: colors.textMuted, fontSize: 12, fontWeight: '900' },
  tabTextActive: { color: '#fff' },
  sectionBlock: { gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
  sectionHint: { fontSize: 13, fontWeight: '900', color: colors.textMuted, textTransform: 'uppercase', marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statTile: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  statIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 24, fontWeight: '900', color: colors.text, marginTop: 12 },
  statLabel: { fontSize: 12, fontWeight: '800', color: colors.textMuted, marginTop: 2 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: '900', color: colors.text },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F0F2F7' },
  metricLabel: { color: colors.textMuted, fontWeight: '700' },
  metricValue: { color: colors.text, fontWeight: '900' },
  emptyText: { color: colors.textMuted, fontWeight: '700', paddingVertical: 10 },
  errorCard: { backgroundColor: '#FFE5E5', borderRadius: 18, padding: 16, marginBottom: 12 },
  errorTitle: { fontSize: 15, fontWeight: '900', color: '#991B1B' },
  errorText: { color: '#B91C1C', marginTop: 6, lineHeight: 19 },
  retryButton: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: colors.coral, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { color: '#fff', fontWeight: '900' },
  userCard: { backgroundColor: colors.white, borderRadius: 18, padding: 15, borderWidth: 1, borderColor: '#E8ECF4' },
  moderationCard: { backgroundColor: colors.white, borderRadius: 18, padding: 15, borderWidth: 1, borderColor: '#E8ECF4' },
  riskCard: { backgroundColor: '#FFF7ED', borderRadius: 18, padding: 15, borderWidth: 1, borderColor: '#FED7AA' },
  contentCard: { backgroundColor: colors.white, borderRadius: 18, padding: 15, borderWidth: 1, borderColor: '#E8ECF4' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  itemTitle: { fontSize: 15, fontWeight: '900', color: colors.text, flexShrink: 1 },
  itemSubtitle: { fontSize: 12, color: colors.textMuted, fontWeight: '700', marginTop: 3 },
  itemMeta: { fontSize: 12, color: colors.textMuted, fontWeight: '700', marginTop: 8 },
  contentText: { color: colors.text, fontSize: 14, lineHeight: 20, marginTop: 10 },
  keywordText: { color: '#9A3412', fontSize: 12, fontWeight: '900', marginTop: 10 },
  countRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  countText: { backgroundColor: '#F5F7FA', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, color: colors.textMuted, fontSize: 11, fontWeight: '900' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  smallButton: { backgroundColor: colors.coral, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  smallButtonText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  smallButtonGhost: { backgroundColor: '#FFF3F1', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  smallButtonGhostText: { color: colors.coral, fontWeight: '900', fontSize: 12 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusActive: { backgroundColor: '#DCFCE7' },
  statusHidden: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 11, fontWeight: '900', color: colors.text },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: colors.coral, fontWeight: '900' },
  csvPreview: { backgroundColor: '#111827', color: '#E5E7EB', borderRadius: 14, padding: 12, fontSize: 11, lineHeight: 16, overflow: 'hidden' },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' },
});
