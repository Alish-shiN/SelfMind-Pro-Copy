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
import * as Sharing from 'expo-sharing';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { ApiError } from '../api/client';
import {
  acceptPrivacyNotice,
  AITone,
  CommunityProfileVisibility,
  deleteAccount as deleteUserAccount,
  downloadWeeklyPdfReport,
  exportPersonalData,
  getCurrentUser,
  getPrivacyCenter,
  getUserPreferences,
  PreferredReflectionFormat,
  ReminderFrequency,
  PersonalExportType,
  PrivacyCenterResponse,
  updateUserPreferences,
  UserPreferences,
} from '../api/user';
import type { UserResponse } from '../api/auth';
import { getReminderPreferences, ReminderPreference, updateReminderPreferences } from '../api/reminders';
import { scheduleReminderPreferences } from '../lib/notifications';

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


const GOAL_OPTIONS = ['reduce_stress', 'understand_mood', 'build_routine', 'prepare_exams', 'feel_motivated', 'sleep_better'];
const FORMAT_OPTIONS: PreferredReflectionFormat[] = ['diary', 'chat', 'quiz'];
const FREQUENCY_OPTIONS: ReminderFrequency[] = ['daily', 'few_times_week', 'weekly', 'none'];
const TONE_OPTIONS: AITone[] = ['calm', 'practical', 'motivating', 'reflective'];
const COMMUNITY_VISIBILITY_OPTIONS: CommunityProfileVisibility[] = ['anonymous', 'members', 'public'];

function PersonalizationPreferencesModal({
  visible,
  preferences,
  onClose,
  onSaved,
}: {
  visible: boolean;
  preferences: UserPreferences | null;
  onClose: () => void;
  onSaved: (preferences: UserPreferences) => void;
}) {
  const [draft, setDraft] = useState<UserPreferences | null>(preferences);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setDraft(preferences);
  }, [preferences, visible]);

  if (!draft) return null;

  const toggleGoal = (goal: string) => {
    setDraft((current) => current ? {
      ...current,
      emotional_goals: current.emotional_goals.includes(goal)
        ? current.emotional_goals.filter((item) => item !== goal)
        : [...current.emotional_goals, goal],
    } : current);
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateUserPreferences({ ...draft, onboarding_completed: true });
      onSaved(updated);
      onClose();
    } catch (e) {
      Alert.alert('Preferences error', e instanceof ApiError ? e.message : 'Could not save preferences.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.prefModalSafe} edges={['top', 'bottom']}>
        <View style={styles.prefModalTop}>
          <Pressable onPress={onClose}><Text style={styles.timeCancelText}>Cancel</Text></Pressable>
          <Text style={styles.title}>AI & Reflection</Text>
          <Pressable onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.coral} /> : <Text style={styles.prefSaveText}>Save</Text>}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.prefModalBody}>
          <Text style={styles.sectionLabel}>Emotional goals</Text>
          <View style={styles.prefChipWrap}>
            {GOAL_OPTIONS.map((goal) => (
              <Pressable key={goal} style={[styles.prefChip, draft.emotional_goals.includes(goal) && styles.prefChipOn]} onPress={() => toggleGoal(goal)}>
                <Text style={[styles.prefChipText, draft.emotional_goals.includes(goal) && styles.prefChipTextOn]}>{goal.replace(/_/g, ' ')}</Text>
              </Pressable>
            ))}
          </View>

          <PreferencePicker title="Reflection format" options={FORMAT_OPTIONS} value={draft.preferred_reflection_format} onSelect={(value) => setDraft({ ...draft, preferred_reflection_format: value as PreferredReflectionFormat })} />
          <PreferencePicker title="Reminder frequency" options={FREQUENCY_OPTIONS} value={draft.reminder_frequency} onSelect={(value) => setDraft({ ...draft, reminder_frequency: value as ReminderFrequency })} />
          <PreferencePicker title="AI tone" options={TONE_OPTIONS} value={draft.ai_tone} onSelect={(value) => setDraft({ ...draft, ai_tone: value as AITone })} />

          <Text style={styles.sectionLabel}>Privacy</Text>
          <PreferenceToggle label="Private diary entries by default" value={draft.privacy_preferences.journal_private_default} onPress={() => setDraft({ ...draft, privacy_preferences: { ...draft.privacy_preferences, journal_private_default: !draft.privacy_preferences.journal_private_default } })} />
          <PreferenceToggle label="Anonymous community by default" value={draft.privacy_preferences.anonymous_community_default} onPress={() => setDraft({ ...draft, privacy_preferences: { ...draft.privacy_preferences, anonymous_community_default: !draft.privacy_preferences.anonymous_community_default } })} />
          <PreferenceToggle label="Share AI insights for personalization" value={draft.privacy_preferences.share_ai_insights} onPress={() => setDraft({ ...draft, privacy_preferences: { ...draft.privacy_preferences, share_ai_insights: !draft.privacy_preferences.share_ai_insights, ai_processing_consent: !draft.privacy_preferences.share_ai_insights } })} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function PreferencePicker({ title, options, value, onSelect }: { title: string; options: string[]; value: string; onSelect: (value: string) => void }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.prefChipWrap}>
        {options.map((item) => (
          <Pressable key={item} style={[styles.prefChip, value === item && styles.prefChipOn]} onPress={() => onSelect(item)}>
            <Text style={[styles.prefChipText, value === item && styles.prefChipTextOn]}>{item.replace(/_/g, ' ')}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function PreferenceToggle({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.prefToggleRow} onPress={onPress}>
      <Text style={styles.infoValue}>{label}</Text>
      <Text style={[styles.toggleText, value && { color: colors.coral }]}>{value ? 'On' : 'Off'}</Text>
    </Pressable>
  );
}


function PrivacyCenterModal({ visible, preferences, onClose, onSaved, onDeleted }: {
  visible: boolean;
  preferences: UserPreferences | null;
  onClose: () => void;
  onSaved: (preferences: UserPreferences) => void;
  onDeleted: () => Promise<void> | void;
}) {
  const [center, setCenter] = useState<PrivacyCenterResponse | null>(null);
  const [draft, setDraft] = useState<UserPreferences | null>(preferences);
  const [saving, setSaving] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setDraft(preferences);
    setExportStatus(null);
    getPrivacyCenter()
      .then((data) => {
        setCenter(data);
        setDraft(data.preferences);
      })
      .catch(() => setCenter(null));
  }, [preferences, visible]);

  if (!draft) return null;

  const setPrivacy = (patch: Partial<UserPreferences['privacy_preferences']>) => {
    setDraft((current) => current ? {
      ...current,
      privacy_preferences: { ...current.privacy_preferences, ...patch },
    } : current);
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateUserPreferences({ privacy_preferences: draft.privacy_preferences });
      onSaved(updated);
      Alert.alert('Privacy saved', 'Your privacy center settings have been updated.');
    } catch (e) {
      Alert.alert('Privacy error', e instanceof ApiError ? e.message : 'Could not save privacy settings.');
    } finally {
      setSaving(false);
    }
  };

  const acceptNotice = async () => {
    setSaving(true);
    try {
      const updated = await acceptPrivacyNotice();
      setDraft(updated);
      onSaved(updated);
      Alert.alert('Notice accepted', 'Your consent was recorded.');
    } catch (e) {
      Alert.alert('Consent error', e instanceof ApiError ? e.message : 'Could not record consent.');
    } finally {
      setSaving(false);
    }
  };

  const exportData = async (exportType: PersonalExportType, label: string) => {
    setSaving(true);
    setExportStatus(`Preparing ${label}…`);
    try {
      const data = await exportPersonalData(exportType);
      setExportStatus(`${label} ready: ${Object.keys(data).join(', ')}`);
      Alert.alert(`${label} ready`, 'Export generated successfully. Treat this as sensitive-like emotional data.');
    } catch (e) {
      const message = e instanceof ApiError ? e.message : `Could not export ${label}.`;
      setExportStatus(message);
      Alert.alert('Export error', message);
    } finally {
      setSaving(false);
    }
  };

  const downloadPdfReport = async () => {
    setSaving(true);
    setExportStatus('Generating PDF report...');
    try {
      const pdf = await downloadWeeklyPdfReport();
      const sizeKb = Math.max(1, Math.round(pdf.size / 1024));
      setExportStatus(`PDF saved to ${pdf.localUri} (${sizeKb} KB). Opening share options...`);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(pdf.localUri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: 'Open or share SelfMind weekly report',
        });
        setExportStatus(`PDF report was generated and saved to ${pdf.localUri}.`);
        Alert.alert('PDF report was generated.', 'You can reopen it from your device share destination if you saved it.');
      } else {
        setExportStatus(`Sharing is unavailable. PDF saved to ${pdf.localUri}.`);
        Alert.alert('PDF report saved', `Sharing is unavailable on this device. The file was saved temporarily at:
${pdf.localUri}`);
      }
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Could not generate weekly PDF report.';
      setExportStatus(message);
      Alert.alert('PDF report error', message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete account and data?', 'This permanently deletes your account and associated journals, AI data, reminders, and community content. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete all data',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await deleteUserAccount();
            await onDeleted();
          } catch (e) {
            Alert.alert('Delete error', e instanceof ApiError ? e.message : 'Could not delete your account.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.prefModalSafe} edges={['top', 'bottom']}>
        <View style={styles.prefModalTop}>
          <Pressable onPress={onClose}><Text style={styles.timeCancelText}>Close</Text></Pressable>
          <Text style={styles.title}>Privacy Center</Text>
          <Pressable onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.coral} /> : <Text style={styles.prefSaveText}>Save</Text>}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.prefModalBody}>
          <View style={styles.privacyNoticeCard}>
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.coral} />
            <Text style={styles.privacyTitle}>{center?.notice.title ?? 'SelfMind Pro Privacy Center'}</Text>
            <Text style={styles.privacyText}>{center?.notice.summary ?? 'We treat emotional data as sensitive-like data.'}</Text>
            <Text style={styles.privacyText}>{center?.notice.emotional_data_notice ?? 'Journal entries, mood scores, AI reflections, and community activity can reveal emotional patterns and should be protected.'}</Text>
          </View>

          <Text style={styles.sectionLabel}>Entry privacy</Text>
          <PreferenceToggle label="New entries private by default" value={draft.privacy_preferences.journal_private_default} onPress={() => setPrivacy({ journal_private_default: !draft.privacy_preferences.journal_private_default })} />
          <PreferenceToggle label="Community posts anonymous by default" value={draft.privacy_preferences.anonymous_community_default} onPress={() => setPrivacy({ anonymous_community_default: !draft.privacy_preferences.anonymous_community_default })} />
          <PreferencePicker title="Community profile visibility" options={COMMUNITY_VISIBILITY_OPTIONS} value={draft.privacy_preferences.community_profile_visibility} onSelect={(value) => setPrivacy({ community_profile_visibility: value as CommunityProfileVisibility })} />

          <Text style={styles.sectionLabel}>AI processing and storage</Text>
          <PreferenceToggle label="Allow AI insights to personalize future support" value={draft.privacy_preferences.share_ai_insights} onPress={() => setPrivacy({ share_ai_insights: !draft.privacy_preferences.share_ai_insights, ai_processing_consent: !draft.privacy_preferences.share_ai_insights })} />
          {(center?.notice.ai_processing ?? []).map((item) => <Text key={item} style={styles.bulletText}>• {item}</Text>)}
          {(center?.notice.stored_data ?? []).map((item) => <Text key={item} style={styles.bulletText}>• {item}</Text>)}

          <Text style={styles.sectionLabel}>Export & Reports</Text>
          <View style={styles.privacyActionsCard}>
            <Pressable style={[styles.privacyActionBtn, styles.secondaryActionBtn]} onPress={() => exportData('journal', 'Journal history export')} disabled={saving}>
              <Ionicons name="book-outline" size={18} color={colors.coral} />
              <Text style={styles.secondaryActionText}>Export journal history</Text>
            </Pressable>
            <Pressable style={[styles.privacyActionBtn, styles.secondaryActionBtn]} onPress={() => exportData('mood', 'Mood history export')} disabled={saving}>
              <Ionicons name="analytics-outline" size={18} color={colors.coral} />
              <Text style={styles.secondaryActionText}>Export mood history</Text>
            </Pressable>
            <Pressable style={[styles.privacyActionBtn, styles.secondaryActionBtn]} onPress={() => exportData('insights', 'Insights archive export')} disabled={saving}>
              <Ionicons name="sparkles-outline" size={18} color={colors.coral} />
              <Text style={styles.secondaryActionText}>Export insights archive</Text>
            </Pressable>
            <Pressable style={[styles.privacyActionBtn, styles.secondaryActionBtn]} onPress={() => exportData('full', 'Full personal data export')} disabled={saving}>
              <Ionicons name="archive-outline" size={18} color={colors.coral} />
              <Text style={styles.secondaryActionText}>Export full personal data</Text>
            </Pressable>
            <Pressable style={styles.privacyActionBtn} onPress={downloadPdfReport} disabled={saving}>
              <Ionicons name="document-text-outline" size={18} color="#fff" />
              <Text style={styles.privacyActionText}>Download weekly PDF report</Text>
            </Pressable>
            {exportStatus ? <Text style={styles.privacyText}>{exportStatus}</Text> : null}
          </View>

          <View style={styles.privacyActionsCard}>
            <Pressable style={styles.privacyActionBtn} onPress={acceptNotice} disabled={saving}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
              <Text style={styles.privacyActionText}>{draft.privacy_preferences.privacy_notice_accepted ? 'Re-accept privacy notice' : 'Accept privacy notice'}</Text>
            </Pressable>
            <Pressable style={[styles.privacyActionBtn, styles.dangerActionBtn]} onPress={confirmDelete} disabled={saving}>
              <Ionicons name="trash-outline" size={18} color="#fff" />
              <Text style={styles.privacyActionText}>Delete account + all data</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export function ProfileScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reminders, setReminders] = useState<ReminderPreference | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [preferencesModalVisible, setPreferencesModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [savingReminder, setSavingReminder] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<{ field: ReminderTimeField; label: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [u, reminderPrefs, userPrefs] = await Promise.all([
        getCurrentUser(),
        getReminderPreferences(),
        getUserPreferences(),
      ]);
      setUser(u);
      setReminders(reminderPrefs);
      setPreferences(userPrefs);
      void scheduleReminderPreferences(reminderPrefs);
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
      const scheduleResult = await scheduleReminderPreferences(updated);
      if (scheduleResult.unavailableReason) {
        Alert.alert('Local notifications not scheduled', scheduleResult.unavailableReason);
      }
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

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Reflection tools</Text>
              <View style={styles.infoCard}>
                <Pressable style={styles.infoRow} onPress={() => navigation.navigate('ArchiveSearch')}>
                  <Ionicons name="search-outline" size={20} color={colors.coral} />
                  <View style={styles.infoTextWrap}>
                    <Text style={styles.infoLabel}>Archive & Search</Text>
                    <Text style={styles.infoValue}>Find past journals, insights, moods, and saved reflections</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>




            {preferences ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Personalization / AI & Reflection Preferences</Text>
                <View style={styles.infoCard}>
                  <View style={styles.infoRow}>
                    <Ionicons name="sparkles-outline" size={20} color={colors.coral} />
                    <View style={styles.infoTextWrap}>
                      <Text style={styles.infoLabel}>AI tone</Text>
                      <Text style={styles.infoValue}>{preferences.ai_tone}</Text>
                    </View>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.infoRow}>
                    <Ionicons name="journal-outline" size={20} color={colors.coral} />
                    <View style={styles.infoTextWrap}>
                      <Text style={styles.infoLabel}>Reflection format</Text>
                      <Text style={styles.infoValue}>{preferences.preferred_reflection_format}</Text>
                    </View>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.infoRow}>
                    <Ionicons name="heart-outline" size={20} color={colors.coral} />
                    <View style={styles.infoTextWrap}>
                      <Text style={styles.infoLabel}>Goals</Text>
                      <Text style={styles.infoValue}>
                        {preferences.emotional_goals.length ? preferences.emotional_goals.map((goal) => goal.replace(/_/g, ' ')).join(', ') : 'Not selected yet'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.divider} />
                  <Pressable style={styles.editPrefsRow} onPress={() => setPreferencesModalVisible(true)}>
                    <Text style={styles.editPrefsText}>Edit personalization preferences</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.coral} />
                  </Pressable>
                </View>
              </View>
            ) : null}


            {preferences ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Privacy Center</Text>
                <View style={styles.infoCard}>
                  <View style={styles.infoRow}>
                    <Ionicons name="lock-closed-outline" size={20} color={colors.coral} />
                    <View style={styles.infoTextWrap}>
                      <Text style={styles.infoLabel}>Entry default</Text>
                      <Text style={styles.infoValue}>{preferences.privacy_preferences.journal_private_default ? 'Private journal entries' : 'Public journal entries'}</Text>
                    </View>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.infoRow}>
                    <Ionicons name="people-outline" size={20} color={colors.coral} />
                    <View style={styles.infoTextWrap}>
                      <Text style={styles.infoLabel}>Community visibility</Text>
                      <Text style={styles.infoValue}>{preferences.privacy_preferences.community_profile_visibility}</Text>
                    </View>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.infoRow}>
                    <Ionicons name="hardware-chip-outline" size={20} color={colors.coral} />
                    <View style={styles.infoTextWrap}>
                      <Text style={styles.infoLabel}>AI personalization consent</Text>
                      <Text style={styles.infoValue}>{preferences.privacy_preferences.ai_processing_consent ? 'Enabled' : 'Not enabled'}</Text>
                    </View>
                  </View>
                  <View style={styles.divider} />
                  <Pressable style={styles.editPrefsRow} onPress={() => setPrivacyModalVisible(true)}>
                    <Text style={styles.editPrefsText}>Open privacy center</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.coral} />
                  </Pressable>
                </View>
                <Text style={styles.reminderHint}>Emotional data is treated as sensitive-like data. Review what AI processes, export your data, or delete your account here.</Text>
              </View>
            ) : null}

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
                  Times are saved to the cloud and scheduled locally on this phone. Keep the app installed and allow notifications to receive them.
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
      <PersonalizationPreferencesModal
        visible={preferencesModalVisible}
        preferences={preferences}
        onClose={() => setPreferencesModalVisible(false)}
        onSaved={setPreferences}
      />
      <PrivacyCenterModal
        visible={privacyModalVisible}
        preferences={preferences}
        onClose={() => setPrivacyModalVisible(false)}
        onSaved={setPreferences}
        onDeleted={signOut}
      />
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

  editPrefsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  editPrefsText: { color: colors.coral, fontWeight: '900', fontSize: 14 },
  prefModalSafe: { flex: 1, backgroundColor: colors.backgroundSoft },
  prefModalTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  prefModalBody: { padding: 16, paddingBottom: 40 },
  prefSaveText: { color: colors.coral, fontWeight: '900', fontSize: 15 },
  prefChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  prefChip: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  prefChipOn: { backgroundColor: '#FFF3F1', borderColor: colors.coral },
  prefChipText: { color: colors.textMuted, fontWeight: '800', textTransform: 'capitalize' },
  prefChipTextOn: { color: colors.coral },
  privacyNoticeCard: { backgroundColor: colors.white, borderRadius: 18, padding: 16, marginBottom: 18, borderWidth: 1, borderColor: '#E8ECF4', gap: 8 },
  privacyTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
  privacyText: { fontSize: 13, color: colors.textMuted, lineHeight: 19, fontWeight: '600' },
  bulletText: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: 6, fontWeight: '600' },
  privacyActionsCard: { gap: 10, marginTop: 18 },
  privacyActionBtn: { backgroundColor: colors.coral, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  privacyActionText: { color: '#fff', fontWeight: '900' },
  secondaryActionBtn: { backgroundColor: '#FFF3F1', borderWidth: 1, borderColor: colors.coral },
  secondaryActionText: { color: colors.coral, fontWeight: '900' },
  dangerActionBtn: { backgroundColor: '#B91C1C' },
  prefToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },

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
