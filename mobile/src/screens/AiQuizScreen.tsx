import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
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
import { generateAiQuiz, submitAiQuiz } from '../api/aiQuiz';

type Props = NativeStackScreenProps<HomeStackParamList, 'AiQuiz'>;

type AnswersByIndex = Record<
  number,
  {
    answer_text: string;
    score: number; // 0..4 (backend constraint)
  }
>;

export function AiQuizScreen({ navigation }: Props) {
  const { signOut } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [quizType] = useState('stress_reflection');
  const [questions, setQuestions] = useState<
    Array<{
      question_index: number;
      question_text: string;
      answer_type: string;
      options?: string[] | null;
    }>
  >([]);

  const [answers, setAnswers] = useState<AnswersByIndex>({});
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const answeredCount = useMemo(() => {
    return Object.keys(answers).length;
  }, [answers]);

  const canSubmit = useMemo(() => {
    if (!questions.length) return false;
    return answeredCount === questions.length && !submitting;
  }, [answeredCount, questions.length, submitting]);

  const loadQuiz = useCallback(async () => {
    setError(null);
    setLoading(true);
    setResult(null);
    setAnswers({});
    setSessionId(null);

    try {
      const gen = await generateAiQuiz(quizType);
      setSessionId(gen.id);
      setQuestions(gen.generated_questions || []);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        await signOut();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Could not generate quiz.');
    } finally {
      setLoading(false);
    }
  }, [quizType, signOut]);

  const submit = useCallback(async () => {
    if (!sessionId) return;
    setSubmitting(true);
    setError(null);
    try {
      const payloadAnswers = questions.map((q) => {
        const a = answers[q.question_index];
        return {
          question_index: q.question_index,
          question_text: q.question_text,
          answer_text: a.answer_text,
          score: a.score,
        };
      });

      const res = await submitAiQuiz(sessionId, payloadAnswers);
      setResult(res);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        await signOut();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Could not submit quiz.');
    } finally {
      setSubmitting(false);
    }
  }, [answers, questions, sessionId, signOut]);

  const onPickOption = useCallback(
    (questionIndex: number, optionText: string, score: number) => {
      setAnswers((prev) => ({
        ...prev,
        [questionIndex]: { answer_text: optionText, score },
      }));
    },
    []
  );

  useEffect(() => {
    // Auto generate on first mount.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadQuiz();
  }, [loadQuiz]);

  const headerTitle = 'AI Quiz';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{headerTitle}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={loadQuiz}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.coral} />
          </View>
        ) : null}

        {!loading && questions.length ? (
          <View style={styles.quizWrap}>
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
                        onPress={() => onPickOption(q.question_index, opt, idx)}
                      >
                        <Text style={[styles.optionText, picked && styles.optionTextOn]}>
                          {opt}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            <View style={styles.footer}>
              <Text style={styles.progress}>
                {answeredCount}/{questions.length} answered
              </Text>
              <Pressable
                style={[styles.submitBtn, !canSubmit && { opacity: 0.6 }]}
                onPress={submit}
                disabled={!canSubmit}
              >
                <Text style={styles.submitText}>
                  {submitting ? 'Submitting...' : 'Submit'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {!loading && result ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Quiz result</Text>
            <Text style={styles.resultScore}>
              Overall score: {result.overall_score ?? '—'}
            </Text>
            <Text style={styles.resultSeverity}>
              Severity: {result.severity_level ?? '—'}
            </Text>

            <Text style={styles.resultSectionLabel}>Insight</Text>
            <Text style={styles.resultText}>{result.insight ?? ''}</Text>

            <Text style={styles.resultSectionLabel}>Recommendation</Text>
            <Text style={styles.resultText}>{result.recommendation ?? ''}</Text>

            <Text style={styles.resultSectionLabel}>Practice</Text>
            <Text style={styles.resultText}>{result.practice ?? ''}</Text>

            <Pressable style={styles.retryBtnWide} onPress={loadQuiz} disabled={submitting}>
              <Text style={styles.retryText}>Generate new quiz</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {/* <Pressable style={styles.signOut} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable> */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSoft },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: { fontSize: 17, fontWeight: '900', color: colors.text },
  body: { padding: 16, paddingBottom: 110, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },

  errBox: {
    backgroundColor: '#FFE5E5',
    borderRadius: 16,
    padding: 14,
  },
  errText: { color: '#B91C1C', fontWeight: '800', marginBottom: 10 },
  retryBtn: {
    backgroundColor: colors.coral,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  retryBtnWide: {
    backgroundColor: colors.coral,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  retryText: { color: '#fff', fontWeight: '900', fontSize: 13 },

  quizWrap: { gap: 14 },
  questionCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EEF2FF',
  },
  questionIndex: { fontSize: 12, fontWeight: '900', color: colors.coral, marginBottom: 6 },
  questionText: { fontSize: 16, fontWeight: '900', color: colors.text, marginBottom: 10, lineHeight: 22 },
  optionsCol: { flexDirection: 'column', gap: 10, alignSelf: 'stretch' },
  optionBtn: {
    backgroundColor: '#F8FAFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignSelf: 'stretch',
  },
  optionBtnOn: { borderColor: colors.coral, backgroundColor: '#FFF0EE' },
  optionText: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  optionTextOn: { color: colors.coral },

  footer: { gap: 10, marginTop: 4 },
  progress: { fontSize: 13, color: colors.textMuted, fontWeight: '800' },
  submitBtn: {
    backgroundColor: colors.coral,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '900' },

  resultCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEF2FF',
  },
  resultTitle: { fontSize: 18, fontWeight: '900', marginBottom: 8, color: colors.text },
  resultScore: { fontSize: 14, fontWeight: '900', color: colors.textMuted, marginBottom: 4 },
  resultSeverity: { fontSize: 14, fontWeight: '900', color: colors.coral, marginBottom: 14 },
  resultSectionLabel: { fontSize: 13, fontWeight: '900', color: colors.textMuted, marginTop: 10, marginBottom: 6 },
  resultText: { fontSize: 14, color: colors.text, lineHeight: 20 },

  signOut: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#EEF2FF',
  },
  signOutText: { color: colors.textMuted, fontWeight: '800', textDecorationLine: 'underline' },
});

