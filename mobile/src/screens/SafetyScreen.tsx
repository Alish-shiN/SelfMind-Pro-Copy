import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ApiError } from '../api/client';
import { checkSafetyText, CrisisResource, getCrisisResources, SafetyCheckResponse } from '../api/safety';
import type { HomeStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<HomeStackParamList, 'Safety'>;

function callNumber(value: string) {
  if (/^\d+$/.test(value)) {
    void Linking.openURL(`tel:${value}`);
  }
}

export function SafetyScreen({ navigation }: Props) {
  const [resources, setResources] = useState<CrisisResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkText, setCheckText] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<SafetyCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setResources(await getCrisisResources());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load safety resources.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runCheck = async () => {
    if (!checkText.trim()) return;
    setChecking(true);
    try {
      setCheckResult(await checkSafetyText(checkText.trim()));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not check this text.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Need immediate help?</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.crisisCard}>
          <Ionicons name="warning-outline" size={30} color="#B91C1C" />
          <Text style={styles.crisisTitle}>If you are in immediate danger</Text>
          <Text style={styles.crisisText}>
            SelfMind Pro is not emergency care. Call emergency services or a crisis hotline now if you may hurt yourself or someone else.
          </Text>
        </View>

        {loading ? <ActivityIndicator color={colors.coral} style={{ marginVertical: 20 }} /> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {resources.map((resource) => (
          <View style={styles.resourceCard} key={resource.title}>
            <Text style={styles.resourceTitle}>{resource.title}</Text>
            <Text style={styles.resourceDescription}>{resource.description}</Text>
            <Pressable style={styles.resourceButton} onPress={() => callNumber(resource.action_value)}>
              <Ionicons name="call-outline" size={18} color="#fff" />
              <Text style={styles.resourceButtonText}>{resource.action_label}</Text>
            </Pressable>
          </View>
        ))}

        <View style={styles.groundingCard}>
          <Text style={styles.groundingTitle}>Right now: 60-second safety step</Text>
          <Text style={styles.groundingText}>1. Move away from anything you could use to hurt yourself.</Text>
          <Text style={styles.groundingText}>2. Sit where another person can see you, or message someone: “Please stay with me.”</Text>
          <Text style={styles.groundingText}>3. Take five slow breaths while you call or text a crisis line.</Text>
        </View>

        <View style={styles.checkCard}>
          <Text style={styles.checkTitle}>Safety check</Text>
          <Text style={styles.checkHint}>Paste or write a message to see if it contains crisis keywords.</Text>
          <TextInput
            style={styles.checkInput}
            placeholder="Write a message…"
            placeholderTextColor={colors.textPlaceholder}
            value={checkText}
            onChangeText={setCheckText}
            multiline
          />
          <Pressable style={styles.checkButton} onPress={runCheck} disabled={checking || !checkText.trim()}>
            {checking ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.checkButtonText}>Check text</Text>}
          </Pressable>
          {checkResult ? (
            <View style={[styles.resultBox, checkResult.is_flagged ? styles.resultDanger : styles.resultOk]}>
              <Text style={styles.resultTitle}>{checkResult.is_flagged ? 'Safety signal found' : 'No crisis keywords found'}</Text>
              {checkResult.message ? <Text style={styles.resultText}>{checkResult.message}</Text> : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSoft },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
  content: { paddingHorizontal: 18, paddingBottom: 28, gap: 14 },
  crisisCard: { backgroundColor: '#FEE2E2', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#FCA5A5' },
  crisisTitle: { fontSize: 20, fontWeight: '900', color: '#991B1B', marginTop: 10 },
  crisisText: { color: '#7F1D1D', fontSize: 14, lineHeight: 20, marginTop: 8, fontWeight: '600' },
  errorText: { color: '#B91C1C', fontWeight: '700' },
  resourceCard: { backgroundColor: colors.white, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E8ECF4' },
  resourceTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  resourceDescription: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  resourceButton: { marginTop: 12, backgroundColor: colors.coral, borderRadius: 999, paddingVertical: 11, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  resourceButtonText: { color: '#fff', fontWeight: '900' },
  groundingCard: { backgroundColor: '#FEF3C7', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#FCD34D' },
  groundingTitle: { fontSize: 16, fontWeight: '900', color: '#92400E', marginBottom: 8 },
  groundingText: { color: '#78350F', fontSize: 13, lineHeight: 19, fontWeight: '700', marginTop: 4 },
  checkCard: { backgroundColor: colors.white, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E8ECF4' },
  checkTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  checkHint: { color: colors.textMuted, fontSize: 13, marginTop: 4, lineHeight: 18 },
  checkInput: { minHeight: 90, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 12, marginTop: 12, textAlignVertical: 'top', color: colors.text },
  checkButton: { backgroundColor: colors.coral, borderRadius: 999, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  checkButtonText: { color: '#fff', fontWeight: '900' },
  resultBox: { borderRadius: 14, padding: 12, marginTop: 12 },
  resultDanger: { backgroundColor: '#FEE2E2' },
  resultOk: { backgroundColor: '#DCFCE7' },
  resultTitle: { fontWeight: '900', color: colors.text },
  resultText: { color: colors.textMuted, marginTop: 4, lineHeight: 18 },
});
