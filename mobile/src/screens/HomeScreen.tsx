import { useCallback, useEffect, useState } from 'react';
import {
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DecorBlobs } from '../components/DecorBlobs';
import { colors } from '../theme/colors';
import { getDashboardHome } from '../api/dashboard';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatMoodLine, moodEmoji } from '../utils/mood';
import type { HomeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomeMain'>;

export function HomeScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof getDashboardHome>> | null>(
    null
  );

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
      const msg = e instanceof ApiError ? e.message : 'Could not load dashboard.';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [signOut]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const analysis = data?.latest_analysis;
  const moodLine = formatMoodLine(analysis?.emotion_label, analysis?.sentiment_label);
  const emoji = moodEmoji(analysis?.emotion_label, analysis?.sentiment_label);
  const advice =
    analysis?.recommendation ||
    analysis?.short_summary ||
    'Start journaling to receive personalized insights and advice.';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DecorBlobs variant="home" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading && !data ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={colors.coral} />
          </View>
        ) : null}

        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
            <Pressable style={styles.retry} onPress={load}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {data ? (
          <>
            <Text style={styles.greeting}>
              Hi, <Text style={styles.greetingBold}>{data.user.username}</Text>
            </Text>

            <Text style={styles.moodLine}>{moodLine}</Text>

            <View style={styles.emojiCircle} accessibilityRole="image">
              <Text style={styles.emoji}>{emoji}</Text>
            </View>

            <Text style={styles.adviseLabel}>Advise :</Text>
            <Text style={styles.adviseBody}>{advice}</Text>

            <Pressable
              style={styles.actionBtn}
              onPress={() => navigation.navigate('AiDiary')}
            >
              <Text style={styles.actionLabel}>AI-Diary</Text>
              <View style={styles.actionIcon}>
                <Ionicons name="arrow-forward" size={18} color={colors.white} />
              </View>
            </Pressable>

            <Pressable
              style={styles.actionBtn}
              onPress={() => navigation.navigate('AiChat')}
            >
              <Text style={styles.actionLabel}>AI-Chat</Text>
              <View style={styles.actionIcon}>
                <Ionicons name="arrow-forward" size={18} color={colors.white} />
              </View>
            </Pressable>

            <Pressable
              style={styles.actionBtn}
              onPress={() => navigation.navigate('AiQuiz')}
            >
              <Text style={styles.actionLabel}>AI-Quiz</Text>
              <View style={styles.actionIcon}>
                <Ionicons name="arrow-forward" size={18} color={colors.white} />
              </View>
            </Pressable>

            <Pressable style={styles.signOut} onPress={() => signOut()}>
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.backgroundSoft,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  loader: {
    paddingVertical: 40,
  },
  errBox: {
    paddingVertical: 16,
  },
  errText: {
    color: '#B91C1C',
    marginBottom: 8,
  },
  retry: {
    alignSelf: 'flex-start',
    backgroundColor: colors.coral,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  retryText: {
    color: colors.white,
    fontWeight: '600',
  },
  greeting: {
    fontSize: 22,
    color: colors.text,
    marginTop: 8,
    marginBottom: 16,
  },
  greetingBold: {
    fontWeight: '700',
  },
  moodLine: {
    textAlign: 'center',
    fontSize: 17,
    color: colors.textMuted,
    marginBottom: 16,
  },
  emojiCircle: {
    alignSelf: 'center',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFE566',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  emoji: {
    fontSize: 64,
  },
  adviseLabel: {
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  adviseBody: {
    textAlign: 'center',
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.periwinkle,
    borderRadius: 26,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  actionLabel: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOut: {
    marginTop: 16,
    alignSelf: 'center',
    paddingVertical: 8,
  },
  signOutText: {
    fontSize: 14,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});
