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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import type { HomeStackParamList } from '../navigation/types';
import { ApiError } from '../api/client';
import {
  AiQuizGenerateResponse,
  AiQuizHistoryItem,
  AiQuizResultDetail,
  AiQuizType,
  generateAiQuiz,
  getAiQuizHistory,
  getAiQuizResult,
  getAiQuizTypes,
  submitAiQuiz,
} from '../api/aiQuiz';
import { createGoal } from '../api/goals';

type Props = NativeStackScreenProps<HomeStackParamList, 'AiQuiz'>;
type ScreenMode = 'landing' | 'taking' | 'result';
type AnswersByIndex = Record<number, { answer_text: string; score: number }>;

const DISCLAIMER = 'This quiz is for self-reflection and is not a medical diagnosis.';

function titleCase(value?: string | null) {
  if (!value) return '—';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export function AiQuizScreen({ navigation }: Props) {
  const { signOut } = useAuth();

  const [mode, setMode] = useState<ScreenMode>('landing');
  const [loadingLanding, setLoadingLanding] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingResult, setLoadingResult] = useState(false);
  const [creatingGoal, setCreatingGoal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quizTypes, setQuizTypes] = useState<AiQuizType[]>([]);
  const [history, setHistory] = useState<AiQuizHistoryItem[]>([]);
  const [selectedQuizType, setSelectedQuizType] = useState<string>('stress');
  const [session, setSession] = useState<AiQuizGenerateResponse | null>(null);
  const [answers, setAnswers] = useState<AnswersByIndex>({});
  const [result, setResult] = useState<AiQuizResultDetail | null>(null);

  const selectedQuiz = quizTypes.find((item) => item.key === selectedQuizType) ?? quizTypes[0];
  const latestHistory = history[0];
  const questions = session?.generated_questions ?? [];

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const canSubmit = questions.length > 0 && answeredCount === questions.length && !submitting;

  const handleAuthError = useCallback(
    async (e: unknown, fallback: string) => {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        await signOut();
        return true;
      }
      setError(e instanceof ApiError ? e.message : fallback);
      return false;
    },
    [signOut]
  );

  const loadLanding = useCallback(async () => {
    setError(null);
    try {
      const [types, completed] = await Promise.all([getAiQuizTypes(), getAiQuizHistory()]);
      setQuizTypes(types);
      setHistory(completed);
      if (!selectedQuizType && types[0]) setSelectedQuizType(types[0].key);
    } catch (e) {
      await handleAuthError(e, 'Could not load AI Quiz.');
    } finally {
      setLoadingLanding(false);
      setRefreshing(false);
    }
  }, [handleAuthError, selectedQuizType]);

  useEffect(() => {
    void loadLanding();
  }, [loadLanding]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadLanding();
  }, [loadLanding]);

  const startQuiz = useCallback(
    async (quizType?: string) => {
      const typeToStart = quizType || selectedQuizType || quizTypes[0]?.key || 'stress';
      setError(null);
      setGenerating(true);
      setResult(null);
      setAnswers({});
      try {
        const generated = await generateAiQuiz(typeToStart);
        setSession(generated);
        setSelectedQuizType(generated.quiz_type);
        setMode('taking');
      } catch (e) {
        await handleAuthError(e, 'Could not start this quiz.');
      } finally {
        setGenerating(false);
      }
    },
    [handleAuthError, quizTypes, selectedQuizType]
  );

  const submit = useCallback(async () => {
    if (!session) return;
    setSubmitting(true);
    setError(null);
    try {
      const payloadAnswers = questions.map((q) => {
        const answer = answers[q.question_index];
        return {
          question_index: q.question_index,
          question_text: q.question_text,
          answer_text: answer.answer_text,
          score: answer.score,
        };
      });
      const submitted = await submitAiQuiz(session.id, payloadAnswers);
      setResult(submitted);
      setMode('result');
      await loadLanding();
    } catch (e) {
      await handleAuthError(e, 'Could not submit quiz.');
    } finally {
      setSubmitting(false);
    }
  }, [answers, handleAuthError, loadLanding, questions, session]);

  const viewResult = useCallback(
    async (resultId: number) => {
      setError(null);
      setLoadingResult(true);
      try {
        const detail = await getAiQuizResult(resultId);
        setResult(detail);
        setSelectedQuizType(detail.quiz_type || 'stress');
        setSession(null);
        setMode('result');
      } catch (e) {
        await handleAuthError(e, 'Could not load quiz result.');
      } finally {
        setLoadingResult(false);
      }
    },
    [handleAuthError]
  );

  const pickOption = useCallback((questionIndex: number, optionText: string, score: number) => {
    setAnswers((prev) => ({ ...prev, [questionIndex]: { answer_text: optionText, score } }));
  }, []);

  const createSuggestedGoal = useCallback(async () => {
    if (!result?.action_plan?.suggested_goal) return;
    setCreatingGoal(true);
    try {
      await createGoal({
        title: result.action_plan.suggested_goal,
        description: `Suggested from your ${titleCase(result.quiz_type)} quiz action plan.`,
        goal_type: 'custom',
        target_count: 3,
        period: 'weekly',
      });
      Alert.alert('Goal created', 'Your suggested goal was added to Goals.');
    } catch (e) {
      Alert.alert('Could not create goal', e instanceof ApiError ? e.message : 'Please try again.');
    } finally {
      setCreatingGoal(false);
    }
  }, [result]);

  const goToLanding = useCallback(() => {
    setMode('landing');
    setSession(null);
    setResult(null);
    setAnswers({});
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        <Pressable onPress={() => (mode === 'landing' ? navigation.goBack() : goToLanding())} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>AI Quiz</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={mode === 'landing' ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.disclaimerBox}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
          <Text style={styles.disclaimerText}>{DISCLAIMER}</Text>
        </View>

        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={mode === 'landing' ? loadLanding : () => startQuiz(selectedQuizType)}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {mode === 'landing' ? (
          loadingLanding ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.coral} />
            </View>
          ) : (
            <View style={styles.stack}>
              <View style={styles.heroCard}>
                <Text style={styles.heroEmoji}>🧠</Text>
                <Text style={styles.heroTitle}>Choose a self-reflection quiz</Text>
                <Text style={styles.heroText}>Pick the area you want to understand today. Nothing starts until you tap start.</Text>
                {latestHistory ? (
                  <Text style={styles.latestText}>
                    Latest: {latestHistory.quiz_title} • {Math.round(latestHistory.score)} • {titleCase(latestHistory.severity_level)}
                  </Text>
                ) : (
                  <Text style={styles.latestText}>No completed quizzes yet. Start your first quiz when you feel ready.</Text>
                )}
                <Pressable
                  style={[styles.submitBtn, generating && { opacity: 0.7 }]}
                  onPress={() => startQuiz(selectedQuiz?.key)}
                  disabled={generating}
                >
                  <Text style={styles.submitText}>{generating ? 'Starting...' : history.length ? 'Start selected quiz' : 'Start your first quiz'}</Text>
                </Pressable>
              </View>

              <Text style={styles.sectionLabel}>Available quiz types</Text>
              {quizTypes.map((item) => {
                const selected = selectedQuizType === item.key;
                return (
                  <Pressable
                    key={item.key}
                    style={[styles.typeCard, selected && styles.typeCardOn]}
                    onPress={() => setSelectedQuizType(item.key)}
                  >
                    <View style={styles.typeTop}>
                      <Text style={styles.typeEmoji}>{item.emoji || '✨'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.typeTitle}>{item.title}</Text>
                        <Text style={styles.typeDescription}>{item.description}</Text>
                      </View>
                      <Text style={[styles.statusPill, selected && styles.statusPillOn]}>{item.status.replace(/_/g, ' ')}</Text>
                    </View>
                    <View style={styles.typeFooter}>
                      <Text style={styles.metaText}>{item.estimated_minutes} min</Text>
                      {item.latest_score != null ? <Text style={styles.metaText}>Last score {Math.round(item.latest_score)}</Text> : null}
                      <Pressable style={styles.smallBtn} onPress={() => startQuiz(item.key)} disabled={generating}>
                        <Text style={styles.smallBtnText}>{item.status === 'not_started' ? 'Start' : 'Retake'}</Text>
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })}

              <Text style={styles.sectionLabel}>Quiz history</Text>
              {history.length ? (
                history.map((item) => (
                  <Pressable key={item.result_id} style={styles.historyCard} onPress={() => viewResult(item.result_id)}>
                    <View style={styles.historyTop}>
                      <Text style={styles.historyTitle}>{item.quiz_title}</Text>
                      <Text style={styles.historyScore}>{Math.round(item.score)}</Text>
                    </View>
                    <Text style={styles.metaText}>{new Date(item.completed_at).toLocaleDateString()} • {titleCase(item.severity_level)} • {titleCase(item.trend_direction)}</Text>
                    <Text style={styles.historySummary} numberOfLines={2}>{item.summary}</Text>
                    <Text style={styles.metaText}>{item.has_action_plan ? 'Action plan saved' : 'No action plan'} • Tap to view</Text>
                  </Pressable>
                ))
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyEmoji}>🌱</Text>
                  <Text style={styles.emptyTitle}>No quiz history yet</Text>
                  <Text style={styles.emptyText}>Complete your first quiz to see score trends, recommendations, and action plans here.</Text>
                  <Pressable style={styles.submitBtn} onPress={() => startQuiz(selectedQuiz?.key)} disabled={generating}>
                    <Text style={styles.submitText}>Start your first quiz</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )
        ) : null}

        {mode === 'taking' && session ? (
          <View style={styles.quizWrap}>
            <View style={styles.quizHeaderCard}>
              <Text style={styles.heroTitle}>{titleCase(session.quiz_type)} quiz</Text>
              <Text style={styles.heroText}>Answer honestly based on the last few days. You can retake later to compare trends.</Text>
            </View>
            {questions.map((q) => (
              <View key={q.question_index} style={styles.questionCard}>
                <Text style={styles.questionIndex}>Q{q.question_index}</Text>
                <Text style={styles.questionText}>{q.question_text}</Text>
                <View style={styles.optionsCol}>
                  {(q.options || []).map((opt, idx) => {
                    const picked = answers[q.question_index]?.answer_text === opt;
                    return (
                      <Pressable
                        key={`${q.question_index}-${opt}-${idx}`}
                        style={[styles.optionBtn, picked && styles.optionBtnOn]}
                        onPress={() => pickOption(q.question_index, opt, idx)}
                      >
                        <Text style={[styles.optionText, picked && styles.optionTextOn]}>{opt}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            <View style={styles.footer}>
              <Text style={styles.progress}>{answeredCount}/{questions.length} answered</Text>
              <Pressable style={[styles.submitBtn, !canSubmit && { opacity: 0.6 }]} onPress={submit} disabled={!canSubmit}>
                <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit quiz'}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {mode === 'result' ? (
          loadingResult ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.coral} />
            </View>
          ) : result ? (
            <View style={styles.stack}>
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>{titleCase(result.quiz_type)} result</Text>
                <Text style={styles.resultScore}>{Math.round(result.overall_score)} / 100</Text>
                <Text style={styles.resultSeverity}>{titleCase(result.severity_level)}</Text>
                <Text style={styles.resultSectionLabel}>Interpretation</Text>
                <Text style={styles.resultText}>{result.insight}</Text>
                <Text style={styles.resultSectionLabel}>Trend comparison</Text>
                <Text style={styles.resultText}>
                  Previous: {result.previous_score == null ? '—' : Math.round(result.previous_score)} • Current: {Math.round(result.overall_score)} • Difference: {result.score_difference == null ? '—' : result.score_difference > 0 ? `+${result.score_difference}` : result.score_difference}
                </Text>
                <Text style={styles.resultText}>{result.trend_explanation || 'Future results will show a clearer trend.'}</Text>
              </View>

              <View style={styles.resultCard}>
                <Text style={styles.resultSectionLabel}>Recommendations</Text>
                {(result.recommendations?.length ? result.recommendations : [result.recommendation]).map((item) => (
                  <Text key={item} style={styles.bullet}>• {item}</Text>
                ))}
              </View>

              <View style={styles.resultCard}>
                <Text style={styles.resultSectionLabel}>Micro-practices</Text>
                {(result.micro_practices || []).map((practice) => (
                  <View key={practice.title} style={styles.practiceCard}>
                    <Text style={styles.practiceTitle}>{practice.title} • {practice.estimated_time}</Text>
                    <Text style={styles.resultText}>{practice.description}</Text>
                    {practice.action ? <Text style={styles.metaText}>Linked action: {practice.action}</Text> : null}
                  </View>
                ))}
              </View>

              {result.action_plan ? (
                <View style={styles.resultCard}>
                  <Text style={styles.resultSectionLabel}>Personalized action plan</Text>
                  {result.action_plan.steps.map((step, index) => (
                    <Text key={step} style={styles.bullet}>{index + 1}. {step}</Text>
                  ))}
                  <Text style={styles.resultSectionLabel}>Reflection prompt</Text>
                  <Text style={styles.resultText}>{result.action_plan.reflection_prompt}</Text>
                  {result.action_plan.suggested_goal ? (
                    <View style={styles.goalBox}>
                      <Text style={styles.practiceTitle}>Suggested goal</Text>
                      <Text style={styles.resultText}>{result.action_plan.suggested_goal}</Text>
                      <Pressable style={styles.smallBtn} onPress={createSuggestedGoal} disabled={creatingGoal}>
                        <Text style={styles.smallBtnText}>{creatingGoal ? 'Creating...' : 'Create this goal'}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  <Text style={styles.resultText}>{result.action_plan.supportive_message}</Text>
                </View>
              ) : null}

              <View style={styles.footer}>
                <Pressable style={styles.submitBtn} onPress={() => startQuiz(result.quiz_type || selectedQuizType)} disabled={generating}>
                  <Text style={styles.submitText}>{generating ? 'Starting...' : 'Retake quiz'}</Text>
                </Pressable>
                <Pressable style={styles.secondaryBtn} onPress={goToLanding}>
                  <Text style={styles.secondaryText}>Back to quiz landing</Text>
                </Pressable>
              </View>
            </View>
          ) : null
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSoft },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  title: { fontSize: 17, fontWeight: '900', color: colors.text },
  body: { padding: 16, paddingBottom: 110, gap: 14 },
  stack: { gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  disclaimerBox: { flexDirection: 'row', gap: 8, backgroundColor: '#F8FAFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  disclaimerText: { flex: 1, color: colors.textMuted, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  errBox: { backgroundColor: '#FFE5E5', borderRadius: 16, padding: 14 },
  errText: { color: '#B91C1C', fontWeight: '800', marginBottom: 10 },
  retryBtn: { backgroundColor: colors.coral, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start' },
  retryText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  heroCard: { backgroundColor: colors.white, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#EEF2FF', gap: 10 },
  heroEmoji: { fontSize: 34 },
  heroTitle: { fontSize: 20, fontWeight: '900', color: colors.text },
  heroText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  latestText: { color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: '800' },
  sectionLabel: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 4 },
  typeCard: { backgroundColor: colors.white, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#EEF2FF', gap: 12 },
  typeCardOn: { borderColor: colors.coral, backgroundColor: '#FFF9F7' },
  typeTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  typeEmoji: { fontSize: 24 },
  typeTitle: { color: colors.text, fontSize: 15, fontWeight: '900', marginBottom: 3 },
  typeDescription: { color: colors.textMuted, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  statusPill: { overflow: 'hidden', color: colors.textMuted, backgroundColor: '#F3F4F6', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: '900', textTransform: 'capitalize' },
  statusPillOn: { color: colors.coral, backgroundColor: '#FFF0EE' },
  typeFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  metaText: { fontSize: 11, color: colors.textMuted, fontWeight: '800', textTransform: 'capitalize' },
  smallBtn: { backgroundColor: colors.coral, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start' },
  smallBtnText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  historyCard: { backgroundColor: colors.white, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#EEF2FF', gap: 7 },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyTitle: { fontSize: 15, fontWeight: '900', color: colors.text },
  historyScore: { fontSize: 18, fontWeight: '900', color: colors.coral },
  historySummary: { fontSize: 12, color: colors.text, lineHeight: 17 },
  emptyCard: { backgroundColor: colors.white, borderRadius: 20, padding: 18, alignItems: 'center', gap: 10 },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { fontSize: 17, fontWeight: '900', color: colors.text },
  emptyText: { color: colors.textMuted, textAlign: 'center', lineHeight: 19, fontWeight: '700' },
  quizWrap: { gap: 14 },
  quizHeaderCard: { backgroundColor: colors.white, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#EEF2FF', gap: 8 },
  questionCard: { backgroundColor: colors.white, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#EEF2FF' },
  questionIndex: { fontSize: 12, fontWeight: '900', color: colors.coral, marginBottom: 6 },
  questionText: { fontSize: 16, fontWeight: '900', color: colors.text, marginBottom: 10, lineHeight: 22 },
  optionsCol: { flexDirection: 'column', gap: 10, alignSelf: 'stretch' },
  optionBtn: { backgroundColor: '#F8FAFF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#E5E7EB', alignSelf: 'stretch' },
  optionBtnOn: { borderColor: colors.coral, backgroundColor: '#FFF0EE' },
  optionText: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  optionTextOn: { color: colors.coral },
  footer: { gap: 10, marginTop: 4 },
  progress: { fontSize: 13, color: colors.textMuted, fontWeight: '800' },
  submitBtn: { backgroundColor: colors.coral, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '900' },
  secondaryBtn: { backgroundColor: colors.white, borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  secondaryText: { color: colors.text, fontWeight: '900' },
  resultCard: { backgroundColor: colors.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#EEF2FF', gap: 8 },
  resultTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
  resultScore: { fontSize: 32, fontWeight: '900', color: colors.coral },
  resultSeverity: { fontSize: 14, fontWeight: '900', color: colors.textMuted, textTransform: 'capitalize' },
  resultSectionLabel: { fontSize: 13, fontWeight: '900', color: colors.textMuted, marginTop: 6, marginBottom: 2 },
  resultText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  bullet: { fontSize: 14, color: colors.text, lineHeight: 21, fontWeight: '700' },
  practiceCard: { backgroundColor: '#F8FAFF', borderRadius: 14, padding: 12, gap: 4 },
  practiceTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  goalBox: { backgroundColor: '#FFF9F7', borderRadius: 14, padding: 12, gap: 8, marginTop: 4 },
});
