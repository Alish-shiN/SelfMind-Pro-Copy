// import { useEffect, useState } from 'react';
// import { ActivityIndicator, StyleSheet, View } from 'react-native';
// import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
// import { createNativeStackNavigator } from '@react-navigation/native-stack';
// import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
// import { Ionicons } from '@expo/vector-icons';
// import { RootStackParamList, HomeStackParamList } from './types';
// import { useAuth } from '../context/AuthContext';
// import { getOnboardingComplete } from '../lib/storage';
// import { OnboardingScreen } from '../screens/OnboardingScreen';
// import { WelcomeScreen } from '../screens/WelcomeScreen';
// import { RegisterScreen } from '../screens/RegisterScreen';
// import { HomeScreen } from '../screens/HomeScreen';
// import { PlaceholderScreen } from '../screens/PlaceholderScreen';
// import { FeaturePlaceholderScreen } from '../screens/FeaturePlaceholderScreen';
// import { colors } from '../theme/colors';

// const RootStack = createNativeStackNavigator<RootStackParamList>();
// const HomeStack = createNativeStackNavigator<HomeStackParamList>();
// const Tab = createBottomTabNavigator();

// const navTheme = {
//   ...DefaultTheme,
//   colors: {
//     ...DefaultTheme.colors,
//     background: colors.backgroundSoft,
//   },
// };

// function HomeStackNavigator() {
//   return (
//     <HomeStack.Navigator id="HomeStack" screenOptions={{ headerShown: false }}>
//       <HomeStack.Screen name="HomeMain" component={HomeScreen} />
//       <HomeStack.Screen name="Feature" component={FeaturePlaceholderScreen} />
//     </HomeStack.Navigator>
//   );
// }

// function MainTabsNavigator() {
//   return (
//     <Tab.Navigator
//       id="MainTabs"
//       screenOptions={{
//         headerShown: false,
//         tabBarActiveTintColor: colors.text,
//         tabBarInactiveTintColor: '#9CA3AF',
//         tabBarStyle: {
//           backgroundColor: colors.white,
//           borderTopColor: '#E5E7EB',
//         },
//       }}
//     >
//       <Tab.Screen
//         name="Notifications"
//         options={{
//           tabBarIcon: ({ color, size }) => (
//             <Ionicons name="notifications-outline" size={size} color={color} />
//           ),
//         }}
//       >
//         {() => (
//           <PlaceholderScreen
//             title="Notifications"
//             subtitle="Alerts and reminders will appear here."
//           />
//         )}
//       </Tab.Screen>
//       <Tab.Screen
//         name="Home"
//         component={HomeStackNavigator}
//         options={{
//           tabBarIcon: ({ color, size }) => (
//             <Ionicons name="home-outline" size={size} color={color} />
//           ),
//         }}
//       />
//       <Tab.Screen
//         name="Community"
//         options={{
//           tabBarIcon: ({ color, size }) => (
//             <Ionicons name="people-outline" size={size} color={color} />
//           ),
//         }}
//       >
//         {() => (
//           <PlaceholderScreen
//             title="Community"
//             subtitle="Posts and comments will use your /community API."
//           />
//         )}
//       </Tab.Screen>
//     </Tab.Navigator>
//   );
// }

// export function AppNavigator() {
//   const { token, ready } = useAuth();
//   const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

//   useEffect(() => {
//     let cancelled = false;
//     (async () => {
//       const done = await getOnboardingComplete();
//       if (!cancelled) setOnboardingDone(done);
//     })();
//     return () => {
//       cancelled = true;
//     };
//   }, []);

//   if (!ready || onboardingDone === null) {
//     return (
//       <View style={styles.boot}>
//         <ActivityIndicator size="large" color={colors.coral} />
//       </View>
//     );
//   }

//   return (
//     <NavigationContainer theme={navTheme}>
//       <RootStack.Navigator id="RootStack" screenOptions={{ headerShown: false }}>
//         {token ? (
//           <RootStack.Screen name="MainTabs" component={MainTabsNavigator} />
//         ) : !onboardingDone ? (
//           <RootStack.Screen name="Onboarding">
//             {() => <OnboardingScreen onDone={() => setOnboardingDone(true)} />}
//           </RootStack.Screen>
//         ) : (
//           <>
//             <RootStack.Screen name="Welcome" component={WelcomeScreen} />
//             <RootStack.Screen name="Register" component={RegisterScreen} />
//           </>
//         )}
//       </RootStack.Navigator>
//     </NavigationContainer>
//   );
// }

// const styles = StyleSheet.create({
//   boot: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//     backgroundColor: colors.backgroundSoft,
//   },
// });
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
import { ProfileScreen } from '../screens/ProfileScreen';
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
      <HomeStack.Screen name="Feature" component={FeaturePlaceholderScreen} />
    </HomeStack.Navigator>
  );
}

function MainTabsNavigator() {
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
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { token, ready } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const done = await getOnboardingComplete();
      if (!cancelled) setOnboardingDone(done);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!ready || onboardingDone === null) {
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
        {token ? (
          <>
            <RootStack.Screen name="MainTabs" component={MainTabsNavigator} />
            <RootStack.Screen name="Profile" component={ProfileScreen} />
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