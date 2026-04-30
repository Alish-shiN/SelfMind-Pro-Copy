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
import { login, register } from '../api/auth';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { RegisterScreenProps } from '../navigation/types';

export function RegisterScreen({ navigation }: RegisterScreenProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email.trim() || !username.trim() || password.length < 8) {
      Alert.alert(
        'Check input',
        'Email and username are required. Password must be at least 8 characters.'
      );
      return;
    }
    setLoading(true);
    try {
      await register({
        email: email.trim(),
        username: username.trim(),
        password,
      });
      const tokenRes = await login(email.trim(), password);
      await signIn(tokenRes.access_token);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Registration failed.';
      Alert.alert('Error', msg);
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
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.inner}>
              <Pressable style={styles.back} onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
                <Text style={styles.backText}>Back</Text>
              </Pressable>

              <Text style={styles.title}>Create account</Text>
              <Text style={styles.sub}>Join SelfMind Pro in a few steps.</Text>

              <PillInput
                label="Email"
                icon={<Ionicons name="mail-outline" size={20} color={colors.text} />}
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <PillInput
                label="Username"
                icon={<Ionicons name="at-outline" size={20} color={colors.text} />}
                placeholder="choose a username"
                autoCapitalize="none"
                value={username}
                onChangeText={setUsername}
              />
              <PillInput
                label="Password"
                icon={<Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />}
                placeholder="at least 8 characters"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              <Pressable
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={onSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>Create Account</Text>
                )}
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
    paddingTop: 4,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 16,
    color: colors.text,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  sub: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: 20,
  },
  primaryBtn: {
    backgroundColor: colors.coralButton,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
});
