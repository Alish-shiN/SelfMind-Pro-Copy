import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Onboarding: undefined;
  Welcome: undefined;
  Register: undefined;
  MainTabs: undefined;
  PersonalizationOnboarding: undefined;
  Profile: undefined;
};

export type HomeStackParamList = {
  HomeMain: undefined;
  AiDiary: { entryDate?: string; notificationEnabled?: boolean } | undefined;
  AiChat: undefined;
  AiQuiz: undefined;
  Safety: undefined;
  Feature: { title: string };
};

export type WelcomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Welcome'>;
export type RegisterScreenProps = NativeStackScreenProps<RootStackParamList, 'Register'>;
