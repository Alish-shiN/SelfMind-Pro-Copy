import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Onboarding: undefined;
  Welcome: undefined;
  Register: undefined;
  MainTabs: undefined;
  Profile: undefined;
};

export type HomeStackParamList = {
  HomeMain: undefined;
  AiDiary: { entryDate?: string; diaryType?: string } | undefined;
  AiChat: undefined;
  AiQuiz: undefined;
  Feature: { title: string };
};

export type WelcomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Welcome'>;
export type RegisterScreenProps = NativeStackScreenProps<RootStackParamList, 'Register'>;
