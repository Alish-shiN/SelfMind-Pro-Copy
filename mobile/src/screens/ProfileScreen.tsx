import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import type { RootStackParamList } from '../navigation/types';
import { ApiError } from '../api/client';
import { getCurrentUser } from '../api/user';
import type { UserResponse } from '../api/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

function formatJoined(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric', day: 'numeric' });
  } catch {
    return '—';
  }
}

export function ProfileScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const u = await getCurrentUser();
      setUser(u);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        await signOut();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Could not load profile.');
    } finally {
      setLoading(false);
    }
  }, [signOut]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSignOut = useCallback(() => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: signOut,
      },
    ]);
  }, [signOut]);

  const initials = user?.username
    ? user.username
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Profile</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandRow}>
          <Image
            source={require('../../assets/selfmind-logo.png')}
            style={styles.brandMark}
            resizeMode="contain"
            accessibilityLabel="SelfMindPro"
          />
        </View>

        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color={colors.coral} />
            <Text style={styles.loadingHint}>Loading your profile…</Text>
          </View>
        ) : null}

        {error && !loading ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && user ? (
          <>
            <View style={styles.heroCard}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <Text style={styles.name}>{user.username}</Text>
              <Text style={styles.tagline}>Your mental wellness companion</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Account</Text>
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Ionicons name="mail-outline" size={20} color={colors.coral} />
                  <View style={styles.infoTextWrap}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={styles.infoValue}>{user.email}</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Ionicons name="person-outline" size={20} color={colors.coral} />
                  <View style={styles.infoTextWrap}>
                    <Text style={styles.infoLabel}>Username</Text>
                    <Text style={styles.infoValue}>{user.username}</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={20} color={colors.coral} />
                  <View style={styles.infoTextWrap}>
                    <Text style={styles.infoLabel}>Member since</Text>
                    <Text style={styles.infoValue}>{formatJoined(user.created_at)}</Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        ) : null}

        <Pressable style={styles.signOutBtn} onPress={onSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
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
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  scrollContent: { paddingBottom: 32, paddingHorizontal: 16 },
  brandRow: { alignItems: 'center', marginTop: 4, marginBottom: 8 },
  brandMark: { width: 160, height: 72, opacity: 0.95 },
  loadingBlock: { alignItems: 'center', paddingVertical: 28, gap: 12 },
  loadingHint: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  errBox: {
    backgroundColor: '#FFE5E5',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  errText: { color: '#B91C1C', fontWeight: '700', marginBottom: 10 },
  retryBtn: {
    backgroundColor: colors.coral,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  retryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  heroCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8ECF4',
    marginBottom: 20,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#F5F7FA',
    borderWidth: 2,
    borderColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: '900', color: colors.text },
  name: { marginTop: 14, fontSize: 22, fontWeight: '900', color: colors.text },
  tagline: { marginTop: 6, fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  section: { marginBottom: 8 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 10,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  divider: { height: 1, backgroundColor: '#F0F2F7', marginLeft: 50 },
  infoTextWrap: { flex: 1 },
  infoLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 2 },
  infoValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  signOutBtn: {
    marginTop: 12,
    backgroundColor: colors.coral,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  signOutText: { color: colors.white, fontWeight: '800', fontSize: 16 },
});
