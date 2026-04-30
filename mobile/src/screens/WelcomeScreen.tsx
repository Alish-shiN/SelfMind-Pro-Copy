import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DecorBlobs } from '../components/DecorBlobs';
import { PillInput } from '../components/PillInput';
import { colors } from '../theme/colors';
import { login } from '../api/auth';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { WelcomeScreenProps } from '../navigation/types';

export function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      await signIn(res.access_token);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not sign in.';
      Alert.alert('Sign in failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <DecorBlobs variant="welcome" />
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.inner}>
              <Text style={styles.welcome}>Welcome!</Text>

              <View style={styles.hero}>
                <Text style={styles.heroEmoji} accessibilityLabel="Illustration">
                  🧠🌸
                </Text>
                <Text style={styles.heroCaption}>Mindful self-care</Text>
              </View>

              <PillInput
                label="Email"
                icon={<Ionicons name="person-outline" size={20} color={colors.text} />}
                placeholder="enter your email here"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />

              <PillInput
                label="Password"
                icon={<Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />}
                placeholder="••••••••"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              <Pressable style={styles.forgotWrap} onPress={() => Alert.alert('Forgot password', 'Contact support or reset via web when available.')}>
                <Text style={styles.forgot}>Forgot Password?</Text>
              </Pressable>

              <Text style={styles.orConnect}>Or Connect With</Text>
              <Pressable
                style={styles.googleRow}
                onPress={() => Alert.alert('Google sign-in', 'Wire this to your OAuth flow when ready.')}
              >
                <Text style={styles.googleG}>G</Text>
              </Pressable>

              <Pressable
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={onSignIn}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>Sign in</Text>
                )}
              </Pressable>

              <View style={styles.separatorRow}>
                <View style={styles.sepLine} />
                <Text style={styles.sepOr}>or</Text>
                <View style={styles.sepLine} />
              </View>

              <Pressable
                style={styles.primaryBtn}
                onPress={() => navigation.navigate('Register')}
              >
                <Text style={styles.primaryBtnText}>Create Account</Text>
              </Pressable>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  kav: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  inner: {
    paddingHorizontal: 28,
    paddingTop: 8,
  },
  welcome: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.text,
    marginBottom: 12,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 20,
  },
  heroEmoji: {
    fontSize: 56,
    marginBottom: 6,
  },
  heroCaption: {
    fontSize: 13,
    color: colors.textMuted,
  },
  forgotWrap: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: -6,
  },
  forgot: {
    fontSize: 13,
    color: colors.textMuted,
  },
  orConnect: {
    textAlign: 'center',
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 10,
  },
  googleRow: {
    alignSelf: 'center',
    marginBottom: 22,
  },
  googleG: {
    fontSize: 36,
    fontWeight: '700',
    color: '#4285F4',
  },
  primaryBtn: {
    backgroundColor: colors.coralButton,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  sepLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  sepOr: {
    marginHorizontal: 12,
    fontSize: 14,
    color: colors.textMuted,
  },
});
