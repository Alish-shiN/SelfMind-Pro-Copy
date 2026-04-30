import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import type { HomeStackParamList } from '../navigation/types';
import { ApiError } from '../api/client';
import { createChatSession, getChatSessionDetail, getMyChatSessions, sendChatMessage } from '../api/chat';

type Props = NativeStackScreenProps<HomeStackParamList, 'AiChat'>;

type ChatMessage = { id: number; role: 'user' | 'assistant'; text: string };

export function AiChatScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [awaitingAssistant, setAwaitingAssistant] = useState(false);
  const mountedRef = useRef(false);

  const canSend = useMemo(() => text.trim().length > 0 && !loading, [text, loading]);

  const bootstrap = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      const sessions = await getMyChatSessions();
      const active = sessions.length ? sessions[sessions.length - 1] : null;

      const sid = active?.id ?? (await createChatSession()).id;
      const detail = await getChatSessionDetail(sid);

      if (!mountedRef.current) return;
      setSessionId(sid);
      setMessages(
        detail.messages.map((m) => ({
          id: m.id,
          role: m.role === 'assistant' ? 'assistant' : 'user',
          text: m.content,
        }))
      );
    } catch (e) {
      if (
        e instanceof ApiError &&
        (e.status === 401 || e.status === 403)
      ) {
        await signOut();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Could not load chat.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [signOut]);

  useEffect(() => {
    mountedRef.current = true;
    bootstrap();
    return () => {
      mountedRef.current = false;
    };
  }, [bootstrap]);

  const send = useCallback(async () => {
    if (!canSend || sessionId == null) return;

    const content = text.trim();
    setText('');
    setLoading(true);
    setAwaitingAssistant(true);

    try {
      const res = await sendChatMessage(sessionId, content);
      // Backend returns both messages so we render the real assistant reply.
      setMessages((prev) => [
        ...prev,
        { id: res.user_message.id, role: 'user', text: res.user_message.content },
        { id: res.assistant_message.id, role: 'assistant', text: res.assistant_message.content },
      ]);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        await signOut();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Could not send message.');
    } finally {
      setLoading(false);
      setAwaitingAssistant(false);
    }
  }, [canSend, sessionId, signOut, text]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
      <View style={styles.topRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>AI-Chat</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      >
        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={bootstrap}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && messages.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Start your conversation</Text>
            <Text style={styles.emptySub}>
              Share what you’re feeling today. Your assistant will respond with supportive, reflective guidance.
            </Text>
          </View>
        ) : null}

        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <View
              key={m.id}
              style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant]}
            >
              <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
                <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant]}>
                  {m.text}
                </Text>
              </View>
            </View>
          );
        })}

        {awaitingAssistant ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.coral} />
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Write a message…"
          placeholderTextColor={colors.textPlaceholder}
          selectionColor={colors.coral}
          cursorColor={colors.text}
          value={text}
          onChangeText={setText}
          multiline
          editable={!loading}
        />
        <Pressable
          style={[styles.sendBtn, !canSend && { opacity: 0.55 }]}
          onPress={send}
          disabled={!canSend}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSoft },
  kav: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },

  bubbleRow: { flexDirection: 'row' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAssistant: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: colors.coral },
  bubbleAssistant: { backgroundColor: colors.white, borderWidth: 1, borderColor: '#EEF2FF' },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: colors.white },
  bubbleTextAssistant: { color: colors.text },
  loadingRow: { alignItems: 'center', paddingVertical: 8 },

  errBox: { margin: 16, borderRadius: 16, padding: 14, backgroundColor: '#FFE5E5' },
  errText: { color: '#B91C1C', fontWeight: '700', marginBottom: 10 },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.coral,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  retryText: { color: '#fff', fontWeight: '900', fontSize: 12 },

  emptyBox: {
    margin: 16,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF2FF',
  },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: colors.text, marginBottom: 6 },
  emptySub: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },

  composer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF2FF',
    backgroundColor: colors.backgroundSoft,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: colors.white,
    color: colors.text,
    borderWidth: 1,
    borderColor: '#EEF2FF',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
});

