import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "@selfmind/token";
const ONBOARDING_KEY = "@selfmind/onboarding_done";
const TRUSTED_PERSON_PHONE_KEY = "selfmind:trusted_person_phone";
const ACHIEVEMENT_PRIVACY_READY_KEY = "selfmind:achievement_privacy_ready";
const ACHIEVEMENT_WEEKLY_MOOD_REVIEW_KEY =
  "selfmind:achievement_weekly_mood_review";
const ACHIEVEMENT_WEEKLY_SUMMARY_COMPLETED_KEY =
  "selfmind:achievement_weekly_summary_completed";

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getOnboardingComplete(): Promise<boolean> {
  const v = await AsyncStorage.getItem(ONBOARDING_KEY);
  return v === "1";
}

export async function setOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, "1");
}

export async function getTrustedPersonPhone(): Promise<string | null> {
  return AsyncStorage.getItem(TRUSTED_PERSON_PHONE_KEY);
}

export async function setTrustedPersonPhone(phone: string): Promise<void> {
  const normalized = phone.trim();
  if (!normalized) {
    await AsyncStorage.removeItem(TRUSTED_PERSON_PHONE_KEY);
    return;
  }
  await AsyncStorage.setItem(TRUSTED_PERSON_PHONE_KEY, normalized);
}

async function getBooleanFlag(key: string): Promise<boolean> {
  return (await AsyncStorage.getItem(key)) === "1";
}

async function setBooleanFlag(key: string): Promise<void> {
  await AsyncStorage.setItem(key, "1");
}

export async function getAchievementPrivacyReady(): Promise<boolean> {
  return getBooleanFlag(ACHIEVEMENT_PRIVACY_READY_KEY);
}

export async function setAchievementPrivacyReady(): Promise<void> {
  await setBooleanFlag(ACHIEVEMENT_PRIVACY_READY_KEY);
}

export async function getAchievementWeeklyMoodReview(): Promise<boolean> {
  return getBooleanFlag(ACHIEVEMENT_WEEKLY_MOOD_REVIEW_KEY);
}

export async function setAchievementWeeklyMoodReview(): Promise<void> {
  await setBooleanFlag(ACHIEVEMENT_WEEKLY_MOOD_REVIEW_KEY);
}

export async function getAchievementWeeklySummaryCompleted(): Promise<boolean> {
  return getBooleanFlag(ACHIEVEMENT_WEEKLY_SUMMARY_COMPLETED_KEY);
}

export async function setAchievementWeeklySummaryCompleted(): Promise<void> {
  await setBooleanFlag(ACHIEVEMENT_WEEKLY_SUMMARY_COMPLETED_KEY);
}
