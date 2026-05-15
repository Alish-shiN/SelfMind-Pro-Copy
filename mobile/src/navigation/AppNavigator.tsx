import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList, HomeStackParamList } from './types';
import { useAuth } from '../context/AuthContext';
import { getOnboardingComplete } from '../lib/storage';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { FeaturePlaceholderScreen } from '../screens/FeaturePlaceholderScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { AIDiaryScreen } from '../screens/AiDiaryScreen';
import { AiChatScreen } from '../screens/AiChatScreen';
import { AiQuizScreen } from '../screens/AiQuizScreen';
import { CommunityScreen } from '../screens/CommunityScreen';
import { GoalsScreen } from '../screens/GoalsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SafetyScreen } from '../screens/SafetyScreen';
import { AdminPanelScreen } from '../screens/AdminPanelScreen';
import { PersonalizationOnboardingScreen } from '../screens/PersonalizationOnboardingScreen';
import { ArchiveSearchScreen } from '../screens/ArchiveSearchScreen';
import { ProfilePersonalizationScreen } from '../screens/ProfilePersonalizationScreen';
import { ProfilePrivacyCenterScreen } from '../screens/ProfilePrivacyCenterScreen';
import { ProfileRemindersScreen } from '../screens/ProfileRemindersScreen';
import { getCurrentUser, getUserPreferences, UserPreferences } from '../api/user';
import { colors } from '../theme/colors';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.backgroundSoft,
  },
};

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator id="HomeStack" screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="AiDiary" component={AIDiaryScreen} />
      <HomeStack.Screen name="AiChat" component={AiChatScreen} />
      <HomeStack.Screen name="AiQuiz" component={AiQuizScreen} />
      <HomeStack.Screen name="Safety" component={SafetyScreen} />
      <HomeStack.Screen name="Feature" component={FeaturePlaceholderScreen} />
    </HomeStack.Navigator>
  );
}

function MainTabsNavigator() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await getCurrentUser();
        if (!cancelled) setRole(user.role);
      } catch {
        if (!cancelled) setRole(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const showAdminPanel = role === 'admin' || role === 'moderator';

  return (
    <Tab.Navigator
      id="MainTabs"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.coral,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: '#E5E7EB',
          height: 60,
          paddingBottom: 8,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Home"
        component={HomeStackNavigator}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate("Home", { screen: "HomeMain" });
          },
        })}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Community"
        component={CommunityScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Goals"
        component={GoalsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flag-outline" size={size} color={color} />
          ),
        }}
      />
      {showAdminPanel ? (
        <Tab.Screen
          name="Admin"
          component={AdminPanelScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="shield-checkmark-outline" size={size} color={color} />
            ),
          }}
        />
      ) : null}
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { token, ready } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [preferencesReady, setPreferencesReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const done = await getOnboardingComplete();
      if (!cancelled) setOnboardingDone(done);
    })();
    return () => { cancelled = true; };
  }, []);



  useEffect(() => {
    let cancelled = false;
    setPreferences(null);
    setPreferencesReady(false);

    if (!token) {
      setPreferencesReady(true);
      return () => { cancelled = true; };
    }

    (async () => {
      try {
        const prefs = await getUserPreferences();
        if (!cancelled) setPreferences(prefs);
      } catch {
        // Safe fallback: never trap users in personalization onboarding if preferences are unavailable.
        if (!cancelled) setPreferences({
          emotional_goals: [],
          preferred_reflection_format: 'diary',
          reminder_frequency: 'none',
          privacy_preferences: {
            journal_private_default: true,
            anonymous_community_default: false,
            share_ai_insights: false,
            community_profile_visibility: 'members',
            ai_processing_consent: false,
            privacy_notice_accepted: false,
            privacy_notice_version: null,
            privacy_notice_accepted_at: null,
          },
          ai_tone: 'calm',
          onboarding_completed: true,
          onboarding_skipped: true,
        });
      } finally {
        if (!cancelled) setPreferencesReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  if (!ready || onboardingDone === null || (token && !preferencesReady)) {
    return (
      <View style={styles.boot}>
        <Image
          source={require('../../assets/selfmind-logo.png')}
          style={styles.bootLogo}
          resizeMode="contain"
          accessibilityLabel="SelfMindPro"
        />
        <ActivityIndicator size="large" color={colors.coral} style={styles.bootSpinner} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator id="RootStack" screenOptions={{ headerShown: false }}>
        {token && preferences && !preferences.onboarding_completed ? (
          <RootStack.Screen name="PersonalizationOnboarding">
            {() => (
              <PersonalizationOnboardingScreen
                onDone={() =>
                  setPreferences((current) =>
                    current ? { ...current, onboarding_completed: true } : current
                  )
                }
              />
            )}
          </RootStack.Screen>
        ) : token ? (
          <>
            <RootStack.Screen name="MainTabs" component={MainTabsNavigator} />
            <RootStack.Screen name="Profile" component={ProfileScreen} />
            <RootStack.Screen name="ArchiveSearch" component={ArchiveSearchScreen} />
            <RootStack.Screen name="ProfilePersonalization" component={ProfilePersonalizationScreen} />
            <RootStack.Screen name="ProfilePrivacyCenter" component={ProfilePrivacyCenterScreen} />
            <RootStack.Screen name="ProfileReminders" component={ProfileRemindersScreen} />
          </>
        ) : !onboardingDone ? (
          <RootStack.Screen name="Onboarding">
            {() => <OnboardingScreen onDone={() => setOnboardingDone(true)} />}
          </RootStack.Screen>
        ) : (
          <>
            <RootStack.Screen name="Welcome" component={WelcomeScreen} />
            <RootStack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 32,
  },
  bootLogo: {
    width: '100%',
    maxWidth: 300,
    height: 200,
    marginBottom: 8,
  },
  bootSpinner: { marginTop: 16 },
});