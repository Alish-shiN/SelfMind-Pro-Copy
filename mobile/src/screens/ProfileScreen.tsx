import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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
import { getReminderPreferences, ReminderPreference, updateReminderPreferences } from '../api/reminders';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;
type ReminderTimeField = 'journal_time' | 'mood_checkin_time' | 'ai_quiz_time';

function formatJoined(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric', day: 'numeric' });
  } catch {
    return '—';
  }
}


function TimePickerModal({
  visible,
  value,
  title,
  onCancel,
  onSelect,
}: {
  visible: boolean;
  value: string;
  title: string;
  onCancel: () => void;
  onSelect: (time: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [value, visible]);

  const [selectedHour, selectedMinute] = draft.split(':');
  const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
  const minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  const setHour = (hour: string) => setDraft(`${hour}:${selectedMinute || '00'}`);
  const setMinute = (minute: string) => setDraft(`${selectedHour || '09'}:${minute}`);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.timeModalBackdrop}>
        <View style={styles.timeModalCard}>
          <Text style={styles.timeModalTitle}>{title}</Text>
          <Text style={styles.timeModalValue}>{draft}</Text>
          <View style={styles.timePickerRow}>
            <ScrollView style={styles.timeColumn} showsVerticalScrollIndicator={false}>
              {hours.map((hour) => (
                <Pressable
                  key={hour}
                  style={[styles.timeOption, selectedHour === hour && styles.timeOptionActive]}
                  onPress={() => setHour(hour)}
                >
                  <Text style={[styles.timeOptionText, selectedHour === hour && styles.timeOptionTextActive]}>
                    {hour}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.timeSeparator}>:</Text>
            <ScrollView style={styles.timeColumn} showsVerticalScrollIndicator={false}>
              {minutes.map((minute) => (
                <Pressable
                  key={minute}
                  style={[styles.timeOption, selectedMinute === minute && styles.timeOptionActive]}
                  onPress={() => setMinute(minute)}
                >
                  <Text style={[styles.timeOptionText, selectedMinute === minute && styles.timeOptionTextActive]}>
                    {minute}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <View style={styles.timeModalActions}>
            <Pressable style={styles.timeCancelBtn} onPress={onCancel}>
              <Text style={styles.timeCancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.timeSaveBtn} onPress={() => onSelect(draft)}>
              <Text style={styles.timeSaveText}>Save time</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ReminderRow({ icon, label, value, enabled, disabled, onPress, onTimePress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  enabled: boolean;
  disabled: boolean;
  onPress: () => void;
  onTimePress?: () => void;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color={colors.coral} />
      <View style={styles.infoTextWrap}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{enabled ? value : 'Off'}</Text>
      </View>
      {onTimePress && enabled ? (
        <Pressable style={styles.timePill} onPress={onTimePress} disabled={disabled}>
          <Text style={styles.timePillText}>{value}</Text>
        </Pressable>
      ) : null}
      <Pressable
        style={[styles.togglePill, enabled ? styles.toggleOn : styles.toggleOff, disabled && { opacity: 0.5 }]}
        onPress={onPress}
        disabled={disabled}
      >
        <Text style={[styles.toggleText, enabled && styles.toggleTextOn]}>{enabled ? 'On' : 'Off'}</Text>
      </Pressable>
    </View>
  );
}

export function ProfileScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reminders, setReminders] = useState<ReminderPreference | null>(null);
  const [savingReminder, setSavingReminder] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<{ field: ReminderTimeField; label: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [u, reminderPrefs] = await Promise.all([
        getCurrentUser(),
        getReminderPreferences(),
      ]);
      setUser(u);
      setReminders(reminderPrefs);
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

  const updateReminder = useCallback(async (payload: Partial<ReminderPreference>) => {
    setSavingReminder(true);
    try {
      const updated = await updateReminderPreferences(payload);
      setReminders(updated);
    } catch (e) {
      Alert.alert('Reminder error', e instanceof ApiError ? e.message : 'Could not update reminders.');
    } finally {
      setSavingReminder(false);
    }
  }, []);

  const toggleReminder = useCallback((field: keyof ReminderPreference, value: boolean) => {
    void updateReminder({ [field]: value } as Partial<ReminderPreference>);
  }, [updateReminder]);

  const openTimePicker = useCallback((field: ReminderTimeField, label: string) => {
    setTimePickerTarget({ field, label });
  }, []);

  const saveReminderTime = useCallback((time: string) => {
    if (!timePickerTarget) return;
    void updateReminder({ [timePickerTarget.field]: time } as Partial<ReminderPreference>);
    setTimePickerTarget(null);
  }, [timePickerTarget, updateReminder]);

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

            {reminders ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Reminders</Text>
                <View style={styles.infoCard}>
                  <ReminderRow
                    icon="notifications-outline"
                    label="All reminders"
                    value={reminders.reminders_enabled ? 'Enabled' : 'Paused'}
                    enabled={reminders.reminders_enabled}
                    disabled={savingReminder}
                    onPress={() => toggleReminder('reminders_enabled', !reminders.reminders_enabled)}
                  />
                  <View style={styles.divider} />
                  <ReminderRow
                    icon="journal-outline"
                    label="Daily journal"
                    value={reminders.journal_time}
                    enabled={reminders.journal_enabled}
                    disabled={savingReminder}
                    onPress={() => toggleReminder('journal_enabled', !reminders.journal_enabled)}
                    onTimePress={() => openTimePicker('journal_time', 'Daily journal time')}
                  />
                  <View style={styles.divider} />
                  <ReminderRow
                    icon="happy-outline"
                    label="Mood check-in"
                    value={reminders.mood_checkin_time}
                    enabled={reminders.mood_checkin_enabled}
                    disabled={savingReminder}
                    onPress={() => toggleReminder('mood_checkin_enabled', !reminders.mood_checkin_enabled)}
                    onTimePress={() => openTimePicker('mood_checkin_time', 'Mood check-in time')}
                  />
                  <View style={styles.divider} />
                  <ReminderRow
                    icon="help-circle-outline"
                    label="AI self-check"
                    value={reminders.ai_quiz_time}
                    enabled={reminders.ai_quiz_enabled}
                    disabled={savingReminder}
                    onPress={() => toggleReminder('ai_quiz_enabled', !reminders.ai_quiz_enabled)}
                    onTimePress={() => openTimePicker('ai_quiz_time', 'AI self-check time')}
                  />
                </View>
                <Text style={styles.reminderHint}>
                  These preferences sync with the backend and are ready for local or push notification scheduling.
                </Text>
              </View>
            ) : null}
          </>
        ) : null}

        <Pressable style={styles.signOutBtn} onPress={onSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
      <TimePickerModal
        visible={Boolean(timePickerTarget && reminders)}
        value={timePickerTarget && reminders ? reminders[timePickerTarget.field] : '09:00'}
        title={timePickerTarget?.label ?? 'Reminder time'}
        onCancel={() => setTimePickerTarget(null)}
        onSelect={saveReminderTime}
      />
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
  reminderHint: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginTop: 8, marginLeft: 4, lineHeight: 17 },
  timePill: { backgroundColor: '#FFF3F1', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  timePillText: { color: colors.coral, fontWeight: '900', fontSize: 12 },
  togglePill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, minWidth: 48, alignItems: 'center' },
  toggleOn: { backgroundColor: colors.coral },
  toggleOff: { backgroundColor: '#EEF2F7' },
  toggleText: { color: colors.textMuted, fontSize: 12, fontWeight: '900' },
  toggleTextOn: { color: '#fff' },
  timeModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  timeModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 18,
  },
  timeModalTitle: { fontSize: 18, fontWeight: '900', color: colors.text, textAlign: 'center' },
  timeModalValue: { fontSize: 32, fontWeight: '900', color: colors.coral, textAlign: 'center', marginVertical: 12 },
  timePickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 220, gap: 10 },
  timeColumn: { flex: 1, maxHeight: 220 },
  timeSeparator: { fontSize: 28, fontWeight: '900', color: colors.textMuted },
  timeOption: { paddingVertical: 10, borderRadius: 14, alignItems: 'center', marginVertical: 2 },
  timeOptionActive: { backgroundColor: '#FFF3F1' },
  timeOptionText: { fontSize: 16, fontWeight: '800', color: colors.textMuted },
  timeOptionTextActive: { color: colors.coral },
  timeModalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  timeCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 16, alignItems: 'center', backgroundColor: '#EEF2F7' },
  timeCancelText: { color: colors.textMuted, fontWeight: '900' },
  timeSaveBtn: { flex: 1, paddingVertical: 13, borderRadius: 16, alignItems: 'center', backgroundColor: colors.coral },
  timeSaveText: { color: '#fff', fontWeight: '900' },
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
