import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../api/client';
import { colors } from '../theme/colors';

// ─── Types ───────────────────────────────────────────────────────────────────
type CommunityAuthor = { id: number | null; username: string };

type CommunityPost = {
  id: number;
  content: string;
  is_anonymous: boolean;
  author: CommunityAuthor;
  comments_count: number;
  created_at: string;
  updated_at: string;
};

type CommunityComment = {
  id: number;
  post_id: number;
  content: string;
  is_anonymous: boolean;
  author: CommunityAuthor;
  created_at: string;
};

type PostDetail = CommunityPost & { comments: CommunityComment[] };

// ─── API ──────────────────────────────────────────────────────────────────────
const getFeed = (limit = 20, offset = 0) =>
  apiFetch<CommunityPost[]>(`/community/posts?limit=${limit}&offset=${offset}`, {
    method: 'GET', auth: false,
  });

const getPostDetail = (id: number) =>
  apiFetch<PostDetail>(`/community/posts/${id}`, { method: 'GET', auth: false });

const createPost = (content: string, is_anonymous: boolean) =>
  apiFetch<CommunityPost>('/community/posts', {
    method: 'POST', auth: true, body: JSON.stringify({ content, is_anonymous }),
  });

const createComment = (postId: number, content: string, is_anonymous: boolean) =>
  apiFetch<CommunityComment>(`/community/posts/${postId}/comments`, {
    method: 'POST', auth: true, body: JSON.stringify({ content, is_anonymous }),
  });

const deletePost = (id: number) =>
  apiFetch<void>(`/community/posts/${id}`, { method: 'DELETE', auth: true });

const deleteComment = (id: number) =>
  apiFetch<void>(`/community/comments/${id}`, { method: 'DELETE', auth: true });

// ─── Time helper ─────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── New Post Modal ───────────────────────────────────────────────────────────
function NewPostModal({ visible, onClose, onCreated }: {
  visible: boolean; onClose: () => void; onCreated: () => void;
}) {
  const [content, setContent] = useState('');
  const [isAnon, setIsAnon] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!content.trim()) { Alert.alert('Empty', 'Please write something.'); return; }
    setLoading(true);
    try {
      await createPost(content.trim(), isAnon);
      setContent('');
      onCreated();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not post.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={npStyles.safe} edges={['top', 'bottom']}>
          <View style={npStyles.topBar}>
            <Pressable onPress={() => { setContent(''); onClose(); }}>
              <Text style={npStyles.cancel}>Cancel</Text>
            </Pressable>
            <Text style={npStyles.title}>New Post</Text>
            <Pressable
              style={[npStyles.postBtn, (!content.trim() || loading) && { opacity: 0.5 }]}
              onPress={submit}
              disabled={!content.trim() || loading}
            >
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={npStyles.postText}>Post</Text>
              }
            </Pressable>
          </View>

          <View style={npStyles.body}>
            <View style={npStyles.authorRow}>
              <View style={npStyles.avatar}>
                <Text style={npStyles.avatarText}>{isAnon ? '?' : 'Y'}</Text>
              </View>
              <Text style={npStyles.authorLabel}>
                {isAnon ? 'Posting as Anonymous' : 'Posting as yourself'}
              </Text>
            </View>

            <TextInput
              style={npStyles.input}
              placeholder="Share what's on your mind…"
              placeholderTextColor={colors.textPlaceholder}
              selectionColor={colors.coral}
              cursorColor={colors.text}
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
              autoFocus
              maxLength={5000}
            />

            <Text style={npStyles.charCount}>{content.length}/5000</Text>

            <Pressable style={npStyles.anonRow} onPress={() => setIsAnon(a => !a)}>
              <View style={[npStyles.checkbox, isAnon && npStyles.checkboxOn]}>
                {isAnon && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={npStyles.anonText}>Post anonymously</Text>
              <Text style={npStyles.anonHint}> · Your name won't be shown</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const npStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  cancel: { fontSize: 16, color: colors.textMuted },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  postBtn: {
    backgroundColor: colors.coral, borderRadius: 999,
    paddingHorizontal: 18, paddingVertical: 8,
  },
  postText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  body: { flex: 1, padding: 20 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.periwinkle, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: colors.text },
  authorLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  input: {
    flex: 1, fontSize: 16, color: colors.text, lineHeight: 24,
    maxHeight: 280,
  },
  charCount: { fontSize: 12, color: colors.textPlaceholder, alignSelf: 'flex-end', marginTop: 8 },
  anonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F0F0F0',
    marginTop: 16,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.coral, borderColor: colors.coral },
  anonText: { fontSize: 14, fontWeight: '600', color: colors.text },
  anonHint: { fontSize: 13, color: colors.textMuted },
});

// ─── Post Detail / Comments ───────────────────────────────────────────────────
function PostDetailModal({ postId, onClose }: { postId: number; onClose: () => void }) {
  const [detail, setDetail] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [isAnon, setIsAnon] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await getPostDetail(postId);
      setDetail(d);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [postId]);

  useEffect(() => { load(); }, [load]);

  const sendComment = async () => {
    if (!commentText.trim()) return;
    setSending(true);
    try {
      await createComment(postId, commentText.trim(), isAnon);
      setCommentText('');
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not post comment.');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteComment = (commentId: number) => {
    Alert.alert('Delete Comment', 'Delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteComment(commentId);
            load();
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Could not delete.');
          }
        },
      },
    ]);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <SafeAreaView style={pdStyles.safe} edges={['top', 'bottom']}>
          <View style={pdStyles.topBar}>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
            <Text style={pdStyles.topBarTitle}>Post</Text>
            <View style={{ width: 22 }} />
          </View>

          {loading ? (
            <ActivityIndicator style={{ flex: 1 }} color={colors.coral} />
          ) : detail ? (
            <ScrollView contentContainerStyle={pdStyles.scroll} keyboardShouldPersistTaps="handled">
              {/* Original post */}
              <View style={pdStyles.postCard}>
                <View style={pdStyles.postHeader}>
                  <View style={[pdStyles.postAvatar, { backgroundColor: colors.periwinkle }]}>
                    <Text style={pdStyles.postAvatarText}>
                      {detail.author.username[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={pdStyles.postAuthor}>{detail.author.username}</Text>
                    <Text style={pdStyles.postTime}>{timeAgo(detail.created_at)}</Text>
                  </View>
                  {detail.is_anonymous && (
                    <View style={pdStyles.anonBadge}>
                      <Text style={pdStyles.anonBadgeText}>Anonymous</Text>
                    </View>
                  )}
                </View>
                <Text style={pdStyles.postContent}>{detail.content}</Text>
                <Text style={pdStyles.commentCountLine}>
                  {detail.comments.length} {detail.comments.length === 1 ? 'comment' : 'comments'}
                </Text>
              </View>

              {/* Comments */}
              {detail.comments.length === 0 ? (
                <View style={pdStyles.noComments}>
                  <Text style={pdStyles.noCommentsText}>Be the first to comment 💬</Text>
                </View>
              ) : (
                detail.comments.map((c) => (
                  <View key={c.id} style={pdStyles.commentCard}>
                    <View style={pdStyles.commentAvatar}>
                      <Text style={pdStyles.commentAvatarText}>
                        {c.author.username[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={pdStyles.commentMeta}>
                        <Text style={pdStyles.commentAuthor}>{c.author.username}</Text>
                        <Text style={pdStyles.commentTime}>{timeAgo(c.created_at)}</Text>
                        {c.author.id !== null && (
                          <Pressable
                            hitSlop={8}
                            onPress={() => handleDeleteComment(c.id)}
                          >
                            <Ionicons name="trash-outline" size={14} color="#D1D5DB" />
                          </Pressable>
                        )}
                      </View>
                      <Text style={pdStyles.commentContent}>{c.content}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          ) : null}

          {/* Comment input */}
          <View style={pdStyles.inputBar}>
            <Pressable onPress={() => setIsAnon(a => !a)} hitSlop={8}>
              <Ionicons
                name={isAnon ? 'person-remove-outline' : 'person-outline'}
                size={20}
                color={isAnon ? colors.coral : colors.textMuted}
              />
            </Pressable>
            <TextInput
              style={pdStyles.commentInput}
              placeholder="Write a comment…"
              placeholderTextColor={colors.textPlaceholder}
              selectionColor={colors.coral}
              cursorColor={colors.text}
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <Pressable
              style={[pdStyles.sendBtn, (!commentText.trim() || sending) && { opacity: 0.4 }]}
              onPress={sendComment}
              disabled={!commentText.trim() || sending}
            >
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="send" size={16} color="#fff" />
              }
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const pdStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSoft },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  topBarTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  scroll: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 20 },
  postCard: {
    backgroundColor: colors.white, borderRadius: 20, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  postAvatar: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
  },
  postAvatarText: { fontSize: 16, fontWeight: '700', color: colors.text },
  postAuthor: { fontSize: 14, fontWeight: '700', color: colors.text },
  postTime: { fontSize: 12, color: colors.textMuted },
  anonBadge: {
    backgroundColor: '#F0F0F0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  anonBadgeText: { fontSize: 11, color: colors.textMuted },
  postContent: { fontSize: 15, color: colors.text, lineHeight: 22, marginBottom: 12 },
  commentCountLine: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  noComments: { alignItems: 'center', paddingVertical: 32 },
  noCommentsText: { fontSize: 15, color: colors.textMuted },
  commentCard: {
    flexDirection: 'row', gap: 10, marginBottom: 12,
    backgroundColor: colors.white, borderRadius: 16, padding: 12,
  },
  commentAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.periwinkle, alignItems: 'center', justifyContent: 'center',
  },
  commentAvatarText: { fontSize: 13, fontWeight: '700', color: colors.text },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  commentAuthor: { fontSize: 13, fontWeight: '700', color: colors.text },
  commentTime: { fontSize: 11, color: colors.textMuted, flex: 1 },
  commentContent: { fontSize: 14, color: colors.text, lineHeight: 20 },
  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: '#F0F0F0',
  },
  commentInput: {
    flex: 1, fontSize: 14, color: colors.text,
    backgroundColor: colors.backgroundSoft,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    maxHeight: 80,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.coral,
    alignItems: 'center', justifyContent: 'center',
  },
});

// ─── Feed Post Card ───────────────────────────────────────────────────────────
function PostCard({ post, onPress, onDelete }: {
  post: CommunityPost; onPress: () => void; onDelete?: () => void;
}) {
  return (
    <Pressable style={pcStyles.card} onPress={onPress}>
      <View style={pcStyles.header}>
        <View style={pcStyles.avatar}>
          <Text style={pcStyles.avatarText}>
            {post.author.username[0].toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={pcStyles.author}>{post.author.username}</Text>
          <Text style={pcStyles.time}>{timeAgo(post.created_at)}</Text>
        </View>
        {post.is_anonymous && (
          <View style={pcStyles.anonChip}>
            <Text style={pcStyles.anonText}>Anon</Text>
          </View>
        )}
        {onDelete && post.author.id !== null && (
          <Pressable hitSlop={8} onPress={onDelete}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
      <Text style={pcStyles.content} numberOfLines={4}>{post.content}</Text>
      <View style={pcStyles.footer}>
        <View style={pcStyles.commentChip}>
          <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
          <Text style={pcStyles.commentCount}>{post.comments_count}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const pcStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.white, borderRadius: 20, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.periwinkle, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: colors.text },
  author: { fontSize: 14, fontWeight: '700', color: colors.text },
  time: { fontSize: 12, color: colors.textMuted },
  anonChip: {
    backgroundColor: '#F0F0F0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  anonText: { fontSize: 11, color: colors.textMuted },
  content: { fontSize: 14, color: colors.text, lineHeight: 21, marginBottom: 12 },
  footer: { flexDirection: 'row', alignItems: 'center' },
  commentChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.backgroundSoft,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  commentCount: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function CommunityScreen() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getFeed();
      setPosts(data);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleDeletePost = (id: number) => {
    Alert.alert('Delete Post', 'Delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deletePost(id);
            load();
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Could not delete.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>Connect &amp; share,</Text>
          <Text style={styles.headerTitle}>Community 💜</Text>
        </View>
        <View style={styles.headerMeta}>
          <Text style={styles.postCountText}>{posts.length} posts</Text>
        </View>
      </View>

      {/* Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerLeft}>
          <Text style={styles.bannerTitle}>Join the conversation</Text>
          <Text style={styles.bannerSub}>Support groups help encourage and be encouraged</Text>
        </View>
        <Text style={styles.bannerEmoji}>🤝</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.coral} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {posts.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>No posts yet</Text>
              <Text style={styles.emptySub}>Be the first to share something with the community.</Text>
            </View>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onPress={() => setSelectedPostId(post.id)}
                onDelete={() => handleDeletePost(post.id)}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* FAB */}
      <Pressable style={styles.fab} onPress={() => setShowNew(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      {/* Modals */}
      <NewPostModal
        visible={showNew}
        onClose={() => setShowNew(false)}
        onCreated={() => { setShowNew(false); load(); }}
      />
      {selectedPostId !== null && (
        <PostDetailModal
          postId={selectedPostId}
          onClose={() => setSelectedPostId(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSoft },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  headerSub: { fontSize: 13, color: colors.textMuted },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  headerMeta: {},
  postCountText: {
    fontSize: 13, fontWeight: '600', color: '#8B5CF6',
    backgroundColor: '#F3EEFF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  banner: {
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: colors.periwinkle,
    borderRadius: 20, padding: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  bannerLeft: { flex: 1 },
  bannerTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  bannerSub: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  bannerEmoji: { fontSize: 40, marginLeft: 8 },
  scroll: { paddingHorizontal: 20, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 },
  emptySub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: colors.coral,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.coral, shadowOpacity: 0.4, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});