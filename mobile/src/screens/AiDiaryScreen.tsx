import { useCallback, useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, apiFetch } from '../api/client';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/types';

// ─── Types ───────────────────────────────────────────────────────────────────
type JournalEntry = {
  id: number;
  title: string;
  content: string;
  mood_score: number;
  tags: string[] | null;
  is_private: boolean;
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
  apiFetch<JournalEntry[]>('/journal/', { method: 'GET', auth: true });

const createEntry = (payload: {
  title: string; content: string; mood_score: number;
  tags: string[];
  is_private: boolean;
  entry_date?: string;
}) =>
  apiFetch<JournalEntry>('/journal/', {
    method: 'POST', auth: true, body: JSON.stringify(payload),
  });

const deleteEntry = (id: number) =>
  apiFetch<void>(`/journal/${id}`, { method: 'DELETE', auth: true });

const getAnalysis = (id: number) =>
  apiFetch<JournalAnalysis>(`/analysis/journal/${id}`, { method: 'GET', auth: true });

// ─── Mood picker ─────────────────────────────────────────────────────────────
const MOOD_LABELS = ['😞', '😟', '😐', '🙂', '😊', '😄', '🌟', '💪', '🚀', '🤩'];

function MoodPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={mpStyles.wrap}>
      <Text style={mpStyles.label}>Mood: {value}/10</Text>
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
                <Text style={[mpStyles.num, value === score && mpStyles.numActive]}>{score}</Text>
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
  row: { flexDirection: 'row', gap: 8 },
  pill: {
    alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB',
    backgroundColor: colors.white,
  },
  pillActive: { borderColor: colors.coral, backgroundColor: '#FFF0EE' },
  emoji: { fontSize: 20 },
  num: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  numActive: { color: colors.coral, fontWeight: '700' },
});

// ─── New Entry Modal ──────────────────────────────────────────────────────────
function NewEntryModal({
  visible,
  onClose,
  onCreated,
  initialEntryDate,
  initialDiaryType,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  initialEntryDate?: string;
  initialDiaryType?: string;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [moodScore, setMoodScore] = useState(5);
  const [tagsRaw, setTagsRaw] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [diaryType, setDiaryType] = useState<string>(initialDiaryType ?? 'journal');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setTitle('');
    setContent('');
    setMoodScore(5);
    setTagsRaw('');
    setIsPrivate(true);
    setDiaryType(initialDiaryType ?? 'journal');
  };

  const submit = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('Missing fields', 'Please fill in title and content.');
      return;
    }
    setLoading(true);
    try {
      const diaryTag = (diaryType || 'journal').toLowerCase();
      const userTags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
      const tags = Array.from(new Set([diaryTag, ...userTags]));

      await createEntry({
        title: title.trim(),
        content: content.trim(),
        mood_score: moodScore,
        tags,
        is_private: isPrivate,
        entry_date: initialEntryDate,
      });
      reset();
      onCreated();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save entry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={neStyles.safe} edges={['top', 'bottom']}>
          <View style={neStyles.topBar}>
            <Pressable onPress={() => { reset(); onClose(); }}>
              <Text style={neStyles.cancel}>Cancel</Text>
            </Pressable>
            <Text style={neStyles.modalTitle}>New Entry</Text>
            <Pressable
              style={[neStyles.saveBtn, loading && { opacity: 0.6 }]}
              onPress={submit}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={neStyles.saveText}>Save</Text>
              }
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={neStyles.body} keyboardShouldPersistTaps="handled">
            <TextInput
              style={neStyles.titleInput}
              placeholder="Entry title…"
              placeholderTextColor={colors.textPlaceholder}
              selectionColor={colors.coral}
              cursorColor={colors.text}
              value={title}
              onChangeText={setTitle}
              maxLength={200}
            />

            {initialEntryDate ? (
              <Text style={neStyles.selectedDate}>
                Selected date: {initialEntryDate}
              </Text>
            ) : null}

            <MoodPicker value={moodScore} onChange={setMoodScore} />

            <View style={neStyles.typeWrap}>
              <Text style={neStyles.typeLabel}>Diary type</Text>
              <View style={neStyles.typeRow}>
                {[
                  { id: 'journal', label: 'Journal' },
                  { id: 'notion', label: 'Notion' },
                  { id: 'etc', label: 'Etc' },
                ].map((t) => (
                  <Pressable
                    key={t.id}
                    style={[
                      neStyles.typeBtn,
                      diaryType === t.id && neStyles.typeBtnOn,
                    ]}
                    onPress={() => setDiaryType(t.id)}
                  >
                    <Text
                      style={[
                        neStyles.typeBtnText,
                        diaryType === t.id && neStyles.typeBtnTextOn,
                      ]}
                    >
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <TextInput
              style={neStyles.contentInput}
              placeholder="Write how you feel today…"
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
              placeholder="Tags (comma separated, e.g. work, stress)"
              placeholderTextColor={colors.textPlaceholder}
              selectionColor={colors.coral}
              cursorColor={colors.text}
              value={tagsRaw}
              onChangeText={setTagsRaw}
              autoCapitalize="none"
            />

            <Pressable
              style={neStyles.privacyRow}
              onPress={() => setIsPrivate(p => !p)}
            >
              <Ionicons
                name={isPrivate ? 'lock-closed-outline' : 'globe-outline'}
                size={18}
                color={colors.textMuted}
              />
              <Text style={neStyles.privacyText}>
                {isPrivate ? 'Private entry' : 'Public entry'}
              </Text>
              <View style={[neStyles.toggle, isPrivate && neStyles.toggleOn]}>
                <View style={[neStyles.toggleThumb, isPrivate && neStyles.toggleThumbOn]} />
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  cancel: { fontSize: 16, color: colors.textMuted },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  saveBtn: {
    backgroundColor: colors.coral, borderRadius: 999,
    paddingHorizontal: 18, paddingVertical: 8,
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  body: { padding: 20, gap: 0 },
  titleInput: {
    fontSize: 20, fontWeight: '700', color: colors.text,
    borderBottomWidth: 1.5, borderBottomColor: colors.borderInput,
    paddingBottom: 12, marginBottom: 20,
  },
  selectedDate: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 16,
  },
  contentInput: {
    fontSize: 15, color: colors.text, minHeight: 160,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 16,
    padding: 14, lineHeight: 22, marginBottom: 16,
  },
  typeWrap: { marginBottom: 16 },
  typeLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 10, fontWeight: '700' },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  typeBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  typeBtnOn: {
    borderColor: colors.coral,
    backgroundColor: '#FFF0EE',
  },
  typeBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMuted,
  },
  typeBtnTextOn: {
    color: colors.coral,
  },
  tagsInput: {
    fontSize: 14, color: colors.text,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16,
  },
  privacyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 4,
  },
  privacyText: { flex: 1, fontSize: 14, color: colors.textMuted },
  toggle: {
    width: 44, height: 26, borderRadius: 13, backgroundColor: '#E5E7EB',
    justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleOn: { backgroundColor: colors.coral },
  toggleThumb: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
});

// ─── Entry Detail ─────────────────────────────────────────────────────────────
function EntryDetailModal({
  entry, onClose, onDeleted,
}: { entry: JournalEntry; onClose: () => void; onDeleted: () => void }) {
  const [analysis, setAnalysis] = useState<JournalAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getAnalysis(entry.id)
      .then(setAnalysis)
      .catch(() => setAnalysis(null))
      .finally(() => setAnalysisLoading(false));
  }, [entry.id]);

  const handleDelete = () => {
    Alert.alert('Delete Entry', 'Are you sure you want to delete this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setDeleting(true);
          try {
            await deleteEntry(entry.id);
            onDeleted();
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Could not delete.');
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const moodColor = entry.mood_score >= 7 ? '#34A853' : entry.mood_score >= 5 ? '#FBBC04' : '#EE715F';

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={edStyles.safe} edges={['top', 'bottom']}>
        <View style={edStyles.topBar}>
          <Pressable onPress={onClose}>
            <Ionicons name="chevron-down" size={24} color={colors.text} />
          </Pressable>
          <Pressable onPress={handleDelete} disabled={deleting}>
            {deleting
              ? <ActivityIndicator size="small" color={colors.coral} />
              : <Ionicons name="trash-outline" size={22} color={colors.coral} />
            }
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={edStyles.body} showsVerticalScrollIndicator={false}>
          <Text style={edStyles.entryTitle}>{entry.title}</Text>
          <View style={edStyles.meta}>
            <Text style={edStyles.metaDate}>
              {new Date(entry.created_at).toLocaleDateString('en-US', {
                weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </Text>
            <View style={[edStyles.moodBadge, { backgroundColor: `${moodColor}22` }]}>
              <Text style={[edStyles.moodBadgeText, { color: moodColor }]}>
                Mood {entry.mood_score}/10
              </Text>
            </View>
          </View>

          {(entry.tags?.length ?? 0) > 0 && (
            <View style={edStyles.tagsRow}>
              {entry.tags!.map(tag => (
                <View key={tag} style={edStyles.tag}>
                  <Text style={edStyles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={edStyles.content}>{entry.content}</Text>

          {/* Analysis section */}
          <View style={edStyles.analysisSection}>
            <Text style={edStyles.analysisSectionTitle}>🧠 AI Analysis</Text>
            {analysisLoading ? (
              <ActivityIndicator color={colors.coral} style={{ marginVertical: 16 }} />
            ) : analysis ? (
              <View style={edStyles.analysisCard}>
                <View style={edStyles.analysisRow}>
                  <View style={edStyles.analysisPill}>
                    <Text style={edStyles.analysisPillText}>{analysis.sentiment_label}</Text>
                  </View>
                  <View style={[edStyles.analysisPill, edStyles.analysisPillEmotion]}>
                    <Text style={edStyles.analysisPillText}>{analysis.emotion_label}</Text>
                  </View>
                </View>
                <Text style={edStyles.analysisSummary}>{analysis.short_summary}</Text>
                <View style={edStyles.recRow}>
                  <Ionicons name="bulb-outline" size={16} color={colors.coral} />
                  <Text style={edStyles.recText}>{analysis.recommendation}</Text>
                </View>
              </View>
            ) : (
              <Text style={edStyles.noAnalysis}>No analysis available.</Text>
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  body: { paddingHorizontal: 20, paddingBottom: 40 },
  entryTitle: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  metaDate: { fontSize: 13, color: colors.textMuted },
  moodBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  moodBadgeText: { fontSize: 12, fontWeight: '600' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  tag: {
    backgroundColor: colors.periwinkle, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  tagText: { fontSize: 12, color: colors.text },
  content: { fontSize: 15, color: colors.text, lineHeight: 24, marginBottom: 28 },
  analysisSection: {},
  analysisSectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 },
  analysisCard: {
    backgroundColor: '#F8F0FF', borderRadius: 20, padding: 16, gap: 10,
  },
  analysisRow: { flexDirection: 'row', gap: 8 },
  analysisPill: {
    backgroundColor: colors.coral, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999,
  },
  analysisPillEmotion: { backgroundColor: '#8B5CF6' },
  analysisPillText: { color: '#fff', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  analysisSummary: { fontSize: 14, color: colors.text, lineHeight: 20 },
  recRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  recText: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  noAnalysis: { color: colors.textMuted, fontSize: 14, fontStyle: 'italic' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
const MOOD_EMOJI_SMALL = ['', '😞', '😟', '😐', '🙂', '😊', '😄', '🌟', '💪', '🚀', '🤩'];

type Props = NativeStackScreenProps<HomeStackParamList, 'AiDiary'>;

export function AIDiaryScreen({ route }: Props) {
  const { signOut } = useAuth();
  const initialEntryDate = route.params?.entryDate;
  const initialDiaryType = route.params?.diaryType;

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<JournalEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await getEntries();
      setEntries(data);
    } catch (e) {
      if (
        e instanceof ApiError &&
        (e.status === 401 || e.status === 403)
      ) {
        await signOut();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Could not load entries.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [signOut]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    // If user came from Dashboard "create for this day", open the modal immediately.
    if (initialEntryDate) setShowNew(true);
  }, [initialEntryDate]);

  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>Your thoughts,</Text>
          <Text style={styles.headerTitle}>AI Diary ✨</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.entryCount}>{entries.length} entries</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.coral} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <View style={styles.errBox}>
              <Text style={styles.errText}>{error}</Text>
              <Pressable style={styles.retry} onPress={onRefresh}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : null}
          {entries.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📝</Text>
              <Text style={styles.emptyTitle}>No entries yet</Text>
              <Text style={styles.emptySub}>
                Tap the + button to write your first journal entry. AI will analyze your mood automatically.
              </Text>
            </View>
          ) : (
            entries.map((entry) => {
              const moodColor = entry.mood_score >= 7 ? '#34A853' : entry.mood_score >= 5 ? '#FBBC04' : '#EE715F';
              return (
                <Pressable
                  key={entry.id}
                  style={styles.card}
                  onPress={() => setSelected(entry)}
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{entry.title}</Text>
                    <Text style={styles.cardEmoji}>{MOOD_EMOJI_SMALL[entry.mood_score]}</Text>
                  </View>
                  <Text style={styles.cardContent} numberOfLines={2}>{entry.content}</Text>
                  <View style={styles.cardBottom}>
                    <Text style={styles.cardDate}>
                      {new Date(entry.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </Text>
                    <View style={[styles.moodChip, { backgroundColor: `${moodColor}22` }]}>
                      <View style={[styles.moodDot, { backgroundColor: moodColor }]} />
                      <Text style={[styles.moodChipText, { color: moodColor }]}>
                        {entry.mood_score}/10
                      </Text>
                    </View>
                    {!entry.is_private && (
                      <View style={styles.publicChip}>
                        <Ionicons name="globe-outline" size={11} color={colors.textMuted} />
                        <Text style={styles.publicText}>Public</Text>
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
        onCreated={() => { setShowNew(false); load(); }}
        initialEntryDate={initialEntryDate}
        initialDiaryType={initialDiaryType}
      />
      {selected && (
        <EntryDetailModal
          entry={selected}
          onClose={() => setSelected(null)}
          onDeleted={() => { setSelected(null); load(); }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSoft },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errBox: {
    backgroundColor: '#FFE5E5',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  errText: { color: '#B91C1C', marginBottom: 10, fontWeight: '600' },
  retry: {
    alignSelf: 'flex-start',
    backgroundColor: colors.coral,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  retryText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  headerSub: { fontSize: 13, color: colors.textMuted },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  headerRight: {},
  entryCount: {
    fontSize: 13, fontWeight: '600', color: colors.coral,
    backgroundColor: '#FFF0EE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 100 },
  card: {
    backgroundColor: colors.white, borderRadius: 20, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  cardEmoji: { fontSize: 22, marginLeft: 8 },
  cardContent: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: 10 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardDate: { fontSize: 12, color: colors.textMuted, flex: 1 },
  moodChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  moodDot: { width: 6, height: 6, borderRadius: 3 },
  moodChipText: { fontSize: 11, fontWeight: '600' },
  publicChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: '#F0F4FF',
  },
  publicText: { fontSize: 11, color: colors.textMuted },
  empty: {
    alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 },
  emptySub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: colors.coral,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.coral, shadowOpacity: 0.4, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});