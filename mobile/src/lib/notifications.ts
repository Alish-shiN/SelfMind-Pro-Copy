import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { ReminderPreference } from '../api/reminders';

declare const require: (moduleName: string) => any;

type ReminderType = 'journal' | 'mood_checkin' | 'ai_quiz';

type NotificationModule = {
  setNotificationHandler?: (handler: unknown) => void;
  getPermissionsAsync?: () => Promise<{ status?: string; granted?: boolean }>;
  requestPermissionsAsync?: () => Promise<{ status?: string; granted?: boolean }>;
  setNotificationChannelAsync?: (channelId: string, channel: unknown) => Promise<void>;
  AndroidImportance?: { HIGH?: unknown; DEFAULT?: unknown };
  SchedulableTriggerInputTypes?: { DAILY?: unknown; DATE?: unknown; CALENDAR?: unknown };
  scheduleNotificationAsync: (request: unknown) => Promise<string>;
  cancelScheduledNotificationAsync: (identifier: string) => Promise<void>;
};

const REMINDER_IDS_KEY = 'selfmind:scheduled-reminder-ids';
const ENTRY_IDS_KEY = 'selfmind:scheduled-entry-reminder-ids';
const REMINDER_CHANNEL_ID = 'selfmind-reminders';

const REMINDER_COPY: Record<ReminderType, { title: string; body: string; timeField: keyof ReminderPreference; enabledField: keyof ReminderPreference }> = {
  journal: {
    title: 'Daily reflection',
    body: 'How are you feeling today? Take a minute to write it down.',
    timeField: 'journal_time',
    enabledField: 'journal_enabled',
  },
  mood_checkin: {
    title: 'Mood check-in',
    body: 'Pause and notice your mood before the day gets busy.',
    timeField: 'mood_checkin_time',
    enabledField: 'mood_checkin_enabled',
  },
  ai_quiz: {
    title: 'AI self-check',
    body: 'Would you like to reflect with a short AI self-check today?',
    timeField: 'ai_quiz_time',
    enabledField: 'ai_quiz_enabled',
  },
};

let notificationHandlerConfigured = false;

function getNotifications(): NotificationModule {
  return require('expo-notifications') as NotificationModule;
}

function parseTime(time: string) {
  const [hourRaw, minuteRaw] = time.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error('Choose a valid notification time.');
  }
  return { hour, minute };
}

async function readIds(key: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

async function writeIds(key: string, ids: string[]) {
  await AsyncStorage.setItem(key, JSON.stringify(ids));
}

async function cancelStoredIds(notifications: NotificationModule, key: string) {
  const ids = await readIds(key);
  await Promise.all(ids.map((id) => notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
  await writeIds(key, []);
}

async function ensurePermissions(notifications: NotificationModule): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  if (!notificationHandlerConfigured && notifications.setNotificationHandler) {
    notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    notificationHandlerConfigured = true;
  }

  if (Platform.OS === 'android' && notifications.setNotificationChannelAsync) {
    await notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: 'SelfMind reminders',
      importance: notifications.AndroidImportance?.HIGH ?? notifications.AndroidImportance?.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#EE715F',
    });
  }

  const existing = await notifications.getPermissionsAsync?.();
  if (existing?.granted || existing?.status === 'granted') return true;

  const requested = await notifications.requestPermissionsAsync?.();
  return Boolean(requested?.granted || requested?.status === 'granted');
}

function nextDateFor(dateIso: string | undefined, time: string): Date {
  const { hour, minute } = parseTime(time);
  const target = dateIso ? new Date(`${dateIso}T00:00:00`) : new Date();
  target.setHours(hour, minute, 0, 0);
  return target;
}

function dailyTrigger(notifications: NotificationModule, hour: number, minute: number) {
  const dailyType = notifications.SchedulableTriggerInputTypes?.DAILY;
  if (dailyType) return { type: dailyType, hour, minute, channelId: REMINDER_CHANNEL_ID };
  return { hour, minute, repeats: true, channelId: REMINDER_CHANNEL_ID };
}

function dateTrigger(notifications: NotificationModule, date: Date) {
  const dateType = notifications.SchedulableTriggerInputTypes?.DATE;
  if (dateType) return { type: dateType, date, channelId: REMINDER_CHANNEL_ID };
  return { date, channelId: REMINDER_CHANNEL_ID };
}

export async function scheduleReminderPreferences(preferences: ReminderPreference): Promise<{ scheduled: number; unavailableReason?: string }> {
  const notifications = getNotifications();
  await cancelStoredIds(notifications, REMINDER_IDS_KEY);
  const hasPermission = await ensurePermissions(notifications);
  if (!hasPermission) return { scheduled: 0, unavailableReason: 'Notification permission was not granted.' };
  if (!preferences.reminders_enabled) return { scheduled: 0 };

  const ids: string[] = [];
  for (const reminderType of Object.keys(REMINDER_COPY) as ReminderType[]) {
    const copy = REMINDER_COPY[reminderType];
    if (!preferences[copy.enabledField]) continue;
    const { hour, minute } = parseTime(String(preferences[copy.timeField]));
    const id = await notifications.scheduleNotificationAsync({
      content: {
        title: copy.title,
        body: copy.body,
        data: { reminderType },
      },
      trigger: dailyTrigger(notifications, hour, minute),
    });
    ids.push(id);
  }

  await writeIds(REMINDER_IDS_KEY, ids);
  return { scheduled: ids.length };
}

export async function scheduleJournalEntryReminder({
  entryId,
  entryDate,
  time,
  title,
}: {
  entryId: number;
  entryDate?: string;
  time: string;
  title: string;
}): Promise<{ scheduled: boolean; unavailableReason?: string }> {
  const notifications = getNotifications();
  const hasPermission = await ensurePermissions(notifications);
  if (!hasPermission) return { scheduled: false, unavailableReason: 'Notification permission was not granted.' };

  const targetDate = nextDateFor(entryDate, time);
  if (targetDate.getTime() <= Date.now() + 30_000) {
    return { scheduled: false, unavailableReason: 'This notification time is already in the past.' };
  }

  const id = await notifications.scheduleNotificationAsync({
    content: {
      title: title || 'Journal reminder',
      body: 'You asked SelfMind Pro to remind you about this journal entry.',
      data: { reminderType: 'journal_entry', entryId },
    },
    trigger: dateTrigger(notifications, targetDate),
  });
  const ids = await readIds(ENTRY_IDS_KEY);
  await writeIds(ENTRY_IDS_KEY, [...ids, id]);
  return { scheduled: true };
}
