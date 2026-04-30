import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getDashboardHome, DashboardHome } from '../api/dashboard';
import { ApiError } from '../api/client';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

const MOOD_EMOJI: Record<string, string> = {
  joy: '😊', calm: '😌', stress: '😤', anxiety: '😰',
  sadness: '😢', anger: '😠', neutral: '😐',
};

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value ?? '—'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MoodBar({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 7 ? '#34A853' : score >= 5 ? '#FBBC04' : '#EE715F';
  return (
    <View style={styles.moodBarWrap}>
      <View style={[styles.moodBarFill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}

export function DashboardScreen({ navigation }: { navigation: any }) {
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardHome | null>(null);

  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [actionMode, setActionMode] = useState<'note' | 'notifier'>('note');

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

  const selectedKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(
    selectedDate.getDate()
  ).padStart(2, '0')}`;
  const activeDateSet = new Set(data?.active_dates ?? []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await getDashboardHome();
      setData(d);
    } catch (e) {
      if (
        e instanceof ApiError &&
        (e.status === 401 || e.status === 403)
      ) {
        await signOut();
        setError(null);
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Could not load dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [signOut]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  useEffect(() => {
    // Refresh calendar after coming back from AiDiary.
    const sub = navigation?.addListener?.('focus', () => {
      load();
    });
    return () => {
      sub?.();
    };
  }, [navigation, load]);

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.coral} />
        </View>
      </SafeAreaView>
    );
  }

  const analysis = data?.latest_analysis;
  const stats = data?.stats;
  const emojiKey = (analysis?.emotion_label || '').toLowerCase() as keyof typeof MOOD_EMOJI;
  const emoji = MOOD_EMOJI[emojiKey] || '😐';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>Good day,</Text>
            <Text style={styles.headerName}>{data?.user.username ?? 'User'} 👋</Text>
          </View>
          <Pressable
            style={styles.avatarCircle}
            onPress={() => navigation.navigate('Profile')}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={styles.avatarText}>
              {(data?.user.username?.[0] ?? 'U').toUpperCase()}
            </Text>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Mood card */}
        <View style={styles.moodCard}>
          <View style={styles.moodLeft}>
            <Text style={styles.moodCardLabel}>Current Mood</Text>
            <Text style={styles.moodCardEmotion}>
              {analysis
                ? analysis.emotion_label.charAt(0).toUpperCase() + analysis.emotion_label.slice(1)
                : 'No data yet'}
            </Text>
            {analysis && (
              <View style={styles.sentimentPill}>
                <Text style={styles.sentimentText}>{analysis.sentiment_label}</Text>
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
                setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
              }
            >
              <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
            </Pressable>
            <Text style={styles.calTitle}>
              {monthCursor.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </Text>
            <Pressable
              hitSlop={12}
              onPress={() =>
                setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
              }
            >
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.calDowRow}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
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

              const cellDate = new Date(monthDays.year, monthDays.monthIndex, dayNum);
              // Keys must match backend format: "YYYY-MM-DD"
              const cellKey = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(
                cellDate.getDate()
              ).padStart(2, '0')}`;
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
                  <Text style={[styles.calDayText, isSelected && styles.calDayTextSelected]}>
                    {dayNum}
                  </Text>
                  {isActive ? <View style={styles.calDot} /> : null}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.calModeRow}>
            <Pressable
              style={[styles.calModeBtn, actionMode === 'note' && styles.calModeBtnOn]}
              onPress={() => setActionMode('note')}
            >
              <Text style={[styles.calModeText, actionMode === 'note' && styles.calModeTextOn]}>
                Note
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.calModeBtn,
                actionMode === 'notifier' && styles.calModeBtnOn,
              ]}
              onPress={() => setActionMode('notifier')}
            >
              <Text
                style={[
                  styles.calModeText,
                  actionMode === 'notifier' && styles.calModeTextOn,
                ]}
              >
                Notifier
              </Text>
            </Pressable>
          </View>

          <Text style={styles.calSelectedText}>
            Selected:{' '}
            {selectedDate.toLocaleDateString('en-US', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </Text>

          <Pressable
            style={styles.calActionBtn}
            onPress={() => {
              const entryDate = `${selectedDate.getFullYear()}-${String(
                selectedDate.getMonth() + 1
              ).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
              const diaryType = actionMode === 'note' ? 'journal' : 'etc';

              // Navigate into HomeStack (AiDiary) from the nested tab navigator.
              navigation.navigate('Home', {
                screen: 'AiDiary',
                params: { entryDate, diaryType },
              });
            }}
          >
            <Text style={styles.calActionText}>
              {actionMode === 'note'
                ? 'Create note for this day'
                : 'Set notifier for this day'}
            </Text>
          </Pressable>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard label="Entries" value={stats?.total_entries ?? 0} icon="📝" />
          <StatCard
            label="Avg Mood"
            value={stats?.average_mood != null ? stats.average_mood.toFixed(1) : '—'}
            icon="📊"
          />
          <StatCard label="Streak" value={`${stats?.current_streak ?? 0}d`} icon="🔥" />
          <StatCard label="Best" value={`${stats?.longest_streak ?? 0}d`} icon="🏆" />
        </View>

        {/* Latest analysis */}
        {analysis && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Latest Insight</Text>
            <View style={styles.insightCard}>
              <Text style={styles.insightSummary}>{analysis.short_summary}</Text>
              <View style={styles.insightDivider} />
              <View style={styles.insightRow}>
                <Ionicons name="bulb-outline" size={16} color={colors.coral} />
                <Text style={styles.insightRec}>{analysis.recommendation}</Text>
              </View>
              <View style={styles.confidenceRow}>
                <Text style={styles.confidenceLabel}>Confidence</Text>
                <View style={styles.confidenceBarWrap}>
                  <View
                    style={[
                      styles.confidenceBarFill,
                      { width: `${Math.round(analysis.confidence_score * 100)}%` as any },
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
            <Text style={styles.sectionTitle}>Recent Journal Entries</Text>
            {data!.recent_entries.map((entry) => (
              <View key={entry.id} style={styles.entryCard}>
                <View style={styles.entryLeft}>
                  <Text style={styles.entryTitle} numberOfLines={1}>{entry.title}</Text>
                  <Text style={styles.entryDate}>
                    {new Date(entry.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric',
                    })}
                  </Text>
                </View>
                <View style={styles.entryRight}>
                  <MoodBar score={entry.mood_score} />
                  <Text style={styles.entryMoodScore}>{entry.mood_score}/10</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {!analysis && !loading && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📖</Text>
            <Text style={styles.emptyTitle}>Start your journey</Text>
            <Text style={styles.emptySub}>
              Write your first journal entry to unlock mood insights and personalized advice.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSoft },
  scroll: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 4,
  },
  headerSub: { fontSize: 13, color: colors.textMuted },
  headerName: { fontSize: 22, fontWeight: '700', color: colors.text },
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.periwinkle,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.text },

  errBox: { marginBottom: 16 },
  errText: { color: '#B91C1C', marginBottom: 8, fontSize: 13 },
  retryBtn: {
    alignSelf: 'flex-start', backgroundColor: colors.coral,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
  },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  moodCard: {
    backgroundColor: colors.periwinkle,
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  moodLeft: { flex: 1 },
  moodCardLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4, fontWeight: '500' },
  moodCardEmotion: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 8 },
  sentimentPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 999,
  },
  sentimentText: { fontSize: 12, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
  moodBigEmoji: { fontSize: 56 },

  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statIcon: { fontSize: 18, marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2, textAlign: 'center' },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 },

  calTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calTitle: { fontSize: 14, fontWeight: '800', color: colors.textMuted },

  calDowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calDowText: { width: 28, textAlign: 'center', fontSize: 11, color: colors.textMuted, fontWeight: '700' },

  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  calCell: {
    width: 28,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginBottom: 6,
    position: 'relative',
  },
  calCellSelected: {
    backgroundColor: colors.coral,
  },
  calCellActive: {
    backgroundColor: '#E9F0FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  calDot: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.coral,
  },
  calDayText: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  calDayTextSelected: { color: colors.white },

  calModeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  calModeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  calModeBtnOn: {
    backgroundColor: '#FFF0EE',
    borderColor: colors.coral,
  },
  calModeText: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  calModeTextOn: { color: colors.coral },

  calSelectedText: { fontSize: 13, color: colors.textMuted, marginBottom: 10 },
  calActionBtn: {
    backgroundColor: colors.periwinkle,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  calActionText: { color: colors.text, fontWeight: '900' },

  insightCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  insightSummary: { fontSize: 14, color: colors.text, lineHeight: 20 },
  insightDivider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 12 },
  insightRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  insightRec: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  confidenceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
  },
  confidenceLabel: { fontSize: 11, color: colors.textMuted, width: 68 },
  confidenceBarWrap: {
    flex: 1, height: 6, backgroundColor: '#F0F0F0', borderRadius: 3, overflow: 'hidden',
  },
  confidenceBarFill: { height: 6, backgroundColor: colors.coral, borderRadius: 3 },
  confidencePct: { fontSize: 11, fontWeight: '600', color: colors.text, width: 32, textAlign: 'right' },

  entryCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  entryLeft: { flex: 1 },
  entryTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 },
  entryDate: { fontSize: 12, color: colors.textMuted },
  entryRight: { alignItems: 'flex-end', gap: 4 },
  moodBarWrap: {
    width: 80, height: 6, backgroundColor: '#F0F0F0',
    borderRadius: 3, overflow: 'hidden',
  },
  moodBarFill: { height: 6, borderRadius: 3 },
  entryMoodScore: { fontSize: 12, fontWeight: '600', color: colors.text },

  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    marginTop: 8,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  emptySub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});