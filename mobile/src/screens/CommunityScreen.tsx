import { useCallback, useEffect, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../api/client";
import { colors } from "../theme/colors";
import { useTranslation } from "../i18n/I18nContext";

type CommunityAuthor = { id: number | null; username: string };
type ReactionSummary = {
  support: number;
  me_too: number;
  sending_strength: number;
  helpful: number;
};
type SupportSpaceKey =
  | "general"
  | "study_stress"
  | "burnout"
  | "exam_anxiety"
  | "motivation";
type ReactionType = "support" | "me_too" | "sending_strength" | "helpful";

type SupportSpace = {
  key: SupportSpaceKey;
  title: string;
  description: string;
  emoji: string;
};
type Guidelines = {
  title: string;
  principles: string[];
  support_spaces: SupportSpace[];
  report_reasons: string[];
};

type CommunityPost = {
  id: number;
  content: string;
  is_anonymous: boolean;
  support_space: SupportSpaceKey | string;
  topic_tags: string[];
  author: CommunityAuthor;
  comments_count: number;
  reactions: ReactionSummary;
  reports_count: number;
  created_at: string;
  updated_at: string;
};

type CommunityComment = {
  id: number;
  post_id: number;
  content: string;
  is_anonymous: boolean;
  author: CommunityAuthor;
  reactions: ReactionSummary;
  reports_count: number;
  created_at: string;
  updated_at: string;
};

type PostDetail = CommunityPost & { comments: CommunityComment[] };

const FALLBACK_SPACES: SupportSpace[] = [
  { key: "general", title: "general", description: "openSupport", emoji: "💬" },
  {
    key: "study_stress",
    title: "studyStress",
    description: "workloadDeadlines",
    emoji: "📚",
  },
  {
    key: "burnout",
    title: "burnout",
    description: "lowEnergyRecovery",
    emoji: "🪫",
  },
  {
    key: "exam_anxiety",
    title: "examAnxiety",
    description: "preExamWorries",
    emoji: "📝",
  },
  {
    key: "motivation",
    title: "motivation",
    description: "smallWinsEncouragement",
    emoji: "🌱",
  },
];

const REACTIONS: Array<{ key: ReactionType; label: string; icon: string }> = [
  { key: "support", label: "support", icon: "heart-outline" },
  { key: "me_too", label: "meToo", icon: "people-outline" },
  { key: "sending_strength", label: "strength", icon: "flash-outline" },
  { key: "helpful", label: "helpful", icon: "sparkles-outline" },
];

const getGuidelines = () =>
  apiFetch<Guidelines>("/community/guidelines", { method: "GET" });
const getFeed = (supportSpace?: string, limit = 20, offset = 0) => {
  const space =
    supportSpace && supportSpace !== "all"
      ? `&support_space=${encodeURIComponent(supportSpace)}`
      : "";
  return apiFetch<CommunityPost[]>(
    `/community/posts?limit=${limit}&offset=${offset}${space}`,
    { method: "GET" },
  );
};
const getPostDetail = (id: number) =>
  apiFetch<PostDetail>(`/community/posts/${id}`, { method: "GET" });
const createPost = (
  content: string,
  is_anonymous: boolean,
  support_space: string,
  topic_tags: string[],
) =>
  apiFetch<CommunityPost>("/community/posts", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ content, is_anonymous, support_space, topic_tags }),
  });
const createComment = (
  postId: number,
  content: string,
  is_anonymous: boolean,
) =>
  apiFetch<CommunityComment>(`/community/posts/${postId}/comments`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ content, is_anonymous }),
  });
const deletePost = (id: number) =>
  apiFetch<void>(`/community/posts/${id}`, { method: "DELETE", auth: true });
const deleteComment = (id: number) =>
  apiFetch<void>(`/community/comments/${id}`, { method: "DELETE", auth: true });
const reportPost = (id: number, reason = "inappropriate") =>
  apiFetch(`/community/posts/${id}/report`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ reason }),
  });
const reportComment = (id: number, reason = "inappropriate") =>
  apiFetch(`/community/comments/${id}/report`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ reason }),
  });
const reactToPost = (id: number, reaction_type: ReactionType) =>
  apiFetch(`/community/posts/${id}/reactions`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ reaction_type }),
  });
const reactToComment = (id: number, reaction_type: ReactionType) =>
  apiFetch(`/community/comments/${id}/reactions`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ reaction_type }),
  });

function timeAgo(iso: string, t: (key: string) => string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return t("justNow");
  if (diff < 3600) return `${Math.floor(diff / 60)}${t("minutesAgoSuffix")}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}${t("hoursAgoSuffix")}`;
  return `${Math.floor(diff / 86400)}${t("daysAgoSuffix")}`;
}

function parseTags(raw: string) {
  return raw
    .split(",")
    .map((tag) => tag.trim().replace("#", "").toLowerCase())
    .filter(Boolean)
    .slice(0, 5);
}

function ReactionRow({
  reactions,
  onReact,
}: {
  reactions: ReactionSummary;
  onReact: (type: ReactionType) => void;
}) {
  return (
    <View style={shared.reactionRow}>
      {REACTIONS.map((reaction) => (
        <Pressable
          key={reaction.key}
          style={shared.reactionChip}
          onPress={() => onReact(reaction.key)}
        >
          <Ionicons
            name={reaction.icon as any}
            size={13}
            color={colors.textMuted}
          />
          <Text style={shared.reactionText}>
            {reactions?.[reaction.key] ?? 0}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function GuidelinesModal({
  visible,
  guidelines,
  onClose,
}: {
  visible: boolean;
  guidelines: Guidelines | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={modalStyles.safe} edges={["top", "bottom"]}>
        <View style={modalStyles.topBar}>
          <Text style={modalStyles.title}>{t("communityGuidelines")}</Text>
          <Pressable onPress={onClose}>
            <Text style={modalStyles.done}>{t("done")}</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={modalStyles.body}>
          {(guidelines?.principles ?? []).map((item) => (
            <View key={item} style={modalStyles.guidelineItem}>
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={colors.coral}
              />
              <Text style={modalStyles.guidelineText}>{item}</Text>
            </View>
          ))}
          <Text style={modalStyles.subtitle}>{t("supportSpaces")}</Text>
          {(guidelines?.support_spaces ?? FALLBACK_SPACES).map((space) => (
            <View key={space.key} style={modalStyles.spaceRow}>
              <Text style={modalStyles.spaceEmoji}>{space.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={modalStyles.spaceTitle}>
                  {space.title in ({} as Record<string, never>)
                    ? space.title
                    : t(space.title)}
                </Text>
                <Text style={modalStyles.spaceDesc}>
                  {space.description in ({} as Record<string, never>)
                    ? space.description
                    : t(space.description)}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function NewPostModal({
  visible,
  spaces,
  onClose,
  onCreated,
}: {
  visible: boolean;
  spaces: SupportSpace[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [space, setSpace] = useState<SupportSpaceKey | string>("general");
  const [isAnon, setIsAnon] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!content.trim()) {
      Alert.alert(t("empty"), t("pleaseWriteSupportive"));
      return;
    }
    setLoading(true);
    try {
      await createPost(content.trim(), isAnon, space, parseTags(tags));
      setContent("");
      setTags("");
      setSpace("general");
      setIsAnon(false);
      onCreated();
    } catch (e: any) {
      Alert.alert(t("error"), e?.message ?? t("couldNotPost"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView style={modalStyles.safe} edges={["top", "bottom"]}>
          <View style={modalStyles.topBar}>
            <Pressable
              onPress={() => {
                setContent("");
                onClose();
              }}
            >
              <Text style={modalStyles.cancel}>{t("cancel")}</Text>
            </Pressable>
            <Text style={modalStyles.title}>{t("newSupportPost")}</Text>
            <Pressable
              style={[
                modalStyles.postBtn,
                (!content.trim() || loading) && { opacity: 0.5 },
              ]}
              onPress={submit}
              disabled={!content.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={modalStyles.postText}>{t("post")}</Text>
              )}
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={modalStyles.body}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={modalStyles.fieldLabel}>{t("supportSpace")}</Text>
            <View style={modalStyles.spacePicker}>
              {spaces.map((item) => (
                <Pressable
                  key={item.key}
                  style={[
                    modalStyles.spaceChip,
                    space === item.key && modalStyles.spaceChipOn,
                  ]}
                  onPress={() => setSpace(item.key)}
                >
                  <Text style={modalStyles.spaceChipText}>
                    {item.emoji} {item.title}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={modalStyles.input}
              placeholder={t("postPlaceholder")}
              placeholderTextColor={colors.textPlaceholder}
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
              maxLength={5000}
            />
            <TextInput
              style={modalStyles.tagsInput}
              placeholder={t("topicTagsPlaceholder")}
              placeholderTextColor={colors.textPlaceholder}
              value={tags}
              onChangeText={setTags}
              maxLength={120}
            />
            <Pressable
              style={modalStyles.anonRow}
              onPress={() => setIsAnon((value) => !value)}
            >
              <View
                style={[modalStyles.checkbox, isAnon && modalStyles.checkboxOn]}
              >
                {isAnon ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : null}
              </View>
              <Text style={modalStyles.anonText}>{t("postAnonymously")}</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PostCard({
  post,
  space,
  onPress,
  onDelete,
  onReport,
  onReact,
}: {
  post: CommunityPost;
  space?: SupportSpace;
  onPress: () => void;
  onDelete: () => void;
  onReport: () => void;
  onReact: (reaction: ReactionType) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  return (
    <Pressable style={cardStyles.card} onPress={onPress}>
      <View style={cardStyles.header}>
        <View style={cardStyles.avatar}>
          <Text style={cardStyles.avatarText}>
            {post.author.username[0].toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.author}>{post.author.username}</Text>
          <Text style={cardStyles.time}>
            {space?.emoji ?? "💬"}{" "}
            {space?.title ? t(space.title) : post.support_space} ·{" "}
            {timeAgo(post.created_at, t)}
          </Text>
        </View>
        {post.is_anonymous ? (
          <View style={cardStyles.anonChip}>
            <Text style={cardStyles.anonText}>{t("anonymous")}</Text>
          </View>
        ) : null}
      </View>
      <Text style={cardStyles.content}>{post.content}</Text>
      {post.topic_tags.length > 0 ? (
        <View style={cardStyles.tagsRow}>
          {post.topic_tags.map((tag) => (
            <Text key={tag} style={cardStyles.tag}>
              #{tag}
            </Text>
          ))}
        </View>
      ) : null}
      <ReactionRow reactions={post.reactions} onReact={onReact} />
      <View style={cardStyles.footer}>
        <View style={cardStyles.commentChip}>
          <Ionicons
            name="chatbubble-outline"
            size={14}
            color={colors.textMuted}
          />
          <Text style={cardStyles.commentCount}>{post.comments_count}</Text>
        </View>
        <Pressable onPress={onReport} hitSlop={8}>
          <Ionicons name="flag-outline" size={16} color={colors.textMuted} />
        </Pressable>
        {post.author.id !== null ? (
          <Pressable onPress={onDelete} hitSlop={8}>
            <Ionicons name="trash-outline" size={16} color="#D1D5DB" />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function PostDetailModal({
  postId,
  onClose,
}: {
  postId: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [isAnon, setIsAnon] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail(await getPostDetail(postId));
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const sendComment = async () => {
    if (!commentText.trim()) return;
    setSending(true);
    try {
      await createComment(postId, commentText.trim(), isAnon);
      setCommentText("");
      load();
    } catch (e: any) {
      Alert.alert(t("error"), e?.message ?? t("couldNotPostComment"));
    } finally {
      setSending(false);
    }
  };

  const confirmReportComment = (id: number) => {
    Alert.alert(t("reportComment"), t("reportQueueConfirmComment"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("report"),
        onPress: async () => {
          await reportComment(id);
          Alert.alert(t("thanks"), t("moderatorsReview"));
          load();
        },
      },
    ]);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView style={modalStyles.safe} edges={["top", "bottom"]}>
          <View style={modalStyles.topBar}>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
            <Text style={modalStyles.title}>{t("supportThread")}</Text>
            <View style={{ width: 22 }} />
          </View>
          {loading ? (
            <ActivityIndicator style={{ flex: 1 }} color={colors.coral} />
          ) : detail ? (
            <ScrollView
              contentContainerStyle={modalStyles.body}
              keyboardShouldPersistTaps="handled"
            >
              <View style={cardStyles.card}>
                <Text style={cardStyles.author}>{detail.author.username}</Text>
                <Text style={cardStyles.time}>
                  {timeAgo(detail.created_at, t)}
                </Text>
                <Text style={cardStyles.content}>{detail.content}</Text>
                <ReactionRow
                  reactions={detail.reactions}
                  onReact={async (reaction) => {
                    await reactToPost(detail.id, reaction);
                    load();
                  }}
                />
              </View>
              {detail.comments.length === 0 ? (
                <Text style={modalStyles.emptyText}>
                  {t("firstSupportiveComment")}
                </Text>
              ) : null}
              {detail.comments.map((comment) => (
                <View key={comment.id} style={modalStyles.commentCard}>
                  <Text style={modalStyles.commentAuthor}>
                    {comment.author.username} · {timeAgo(comment.created_at, t)}
                  </Text>
                  <Text style={modalStyles.commentContent}>
                    {comment.content}
                  </Text>
                  <ReactionRow
                    reactions={comment.reactions}
                    onReact={async (reaction) => {
                      await reactToComment(comment.id, reaction);
                      load();
                    }}
                  />
                  <View style={modalStyles.commentActions}>
                    <Pressable onPress={() => confirmReportComment(comment.id)}>
                      <Text style={modalStyles.actionText}>{t("report")}</Text>
                    </Pressable>
                    {comment.author.id !== null ? (
                      <Pressable
                        onPress={async () => {
                          await deleteComment(comment.id);
                          load();
                        }}
                      >
                        <Text style={modalStyles.actionText}>
                          {t("delete")}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : null}
          <View style={modalStyles.inputBar}>
            <Pressable onPress={() => setIsAnon((value) => !value)} hitSlop={8}>
              <Ionicons
                name={isAnon ? "person-remove-outline" : "person-outline"}
                size={20}
                color={isAnon ? colors.coral : colors.textMuted}
              />
            </Pressable>
            <TextInput
              style={modalStyles.commentInput}
              placeholder={t("supportiveCommentPlaceholder")}
              placeholderTextColor={colors.textPlaceholder}
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <Pressable
              style={[
                modalStyles.sendBtn,
                (!commentText.trim() || sending) && { opacity: 0.4 },
              ]}
              onPress={sendComment}
              disabled={!commentText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={16} color="#fff" />
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function CommunityScreen() {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [guidelines, setGuidelines] = useState<Guidelines | null>(null);
  const [selectedSpace, setSelectedSpace] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);

  const spaces = guidelines?.support_spaces ?? FALLBACK_SPACES;
  const spaceByKey = Object.fromEntries(
    spaces.map((space) => [space.key, space]),
  );

  const load = useCallback(async () => {
    try {
      const [guideData, feedData] = await Promise.all([
        getGuidelines(),
        getFeed(selectedSpace),
      ]);
      setGuidelines(guideData);
      setPosts(feedData);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSpace]);

  useEffect(() => {
    load();
  }, [load]);
  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const confirmReportPost = (id: number) => {
    Alert.alert(t("reportPost"), t("reportQueueConfirmPost"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("report"),
        onPress: async () => {
          await reportPost(id);
          Alert.alert(t("thanks"), t("moderatorsReview"));
          load();
        },
      },
    ]);
  };

  const handleDeletePost = (id: number) => {
    Alert.alert(t("deletePost"), t("deletePostConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          await deletePost(id);
          load();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>{t("connectSafely")}</Text>
          <Text style={styles.headerTitle}>{t("community")}</Text>
        </View>
        <Pressable
          style={styles.guidelinesBtn}
          onPress={() => setShowGuidelines(true)}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={16}
            color={colors.coral}
          />
          <Text style={styles.guidelinesText}>{t("rules")}</Text>
        </Pressable>
      </View>

      <View style={styles.banner}>
        <View style={styles.bannerLeft}>
          <Text style={styles.bannerTitle}>{t("supportSpacesBanner")}</Text>
          <Text style={styles.bannerSub}>{t("supportSpacesBannerSub")}</Text>
        </View>
        <Text style={styles.bannerEmoji}>🤝</Text>
      </View>

      <View style={styles.spacesRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.spacesScroll}
        >
          <Pressable
            style={[
              styles.spaceFilter,
              selectedSpace === "all" && styles.spaceFilterOn,
            ]}
            onPress={() => setSelectedSpace("all")}
          >
            <Text style={styles.spaceFilterText}>✨ {t("all")}</Text>
          </Pressable>
          {spaces.map((space) => (
            <Pressable
              key={space.key}
              style={[
                styles.spaceFilter,
                selectedSpace === space.key && styles.spaceFilterOn,
              ]}
              onPress={() => setSelectedSpace(space.key)}
            >
              <Text style={styles.spaceFilterText}>
                {space.emoji}{" "}
                {space.title in ({} as Record<string, never>)
                  ? space.title
                  : t(space.title)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.coral} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {posts.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>{t("noPostsYet")}</Text>
              <Text style={styles.emptySub}>{t("noPostsYetSub")}</Text>
            </View>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                space={spaceByKey[post.support_space]}
                onPress={() => setSelectedPostId(post.id)}
                onDelete={() => handleDeletePost(post.id)}
                onReport={() => confirmReportPost(post.id)}
                onReact={async (reaction) => {
                  await reactToPost(post.id, reaction);
                  load();
                }}
              />
            ))
          )}
        </ScrollView>
      )}

      <Pressable style={styles.fab} onPress={() => setShowNew(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
      <NewPostModal
        visible={showNew}
        spaces={spaces}
        onClose={() => setShowNew(false)}
        onCreated={() => {
          setShowNew(false);
          load();
        }}
      />
      <GuidelinesModal
        visible={showGuidelines}
        guidelines={guidelines}
        onClose={() => setShowGuidelines(false)}
      />
      {selectedPostId !== null ? (
        <PostDetailModal
          postId={selectedPostId}
          onClose={() => {
            setSelectedPostId(null);
            load();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const shared = StyleSheet.create({
  reactionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 10,
    marginBottom: 4,
  },
  reactionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.backgroundSoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  reactionText: { fontSize: 12, color: colors.textMuted, fontWeight: "700" },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.periwinkle,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 15, fontWeight: "700", color: colors.text },
  author: { fontSize: 14, fontWeight: "700", color: colors.text },
  time: { fontSize: 12, color: colors.textMuted },
  anonChip: {
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  anonText: { fontSize: 11, color: colors.textMuted },
  content: { fontSize: 14, color: colors.text, lineHeight: 21 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  tag: {
    backgroundColor: "#F3EEFF",
    color: "#7C3AED",
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  footer: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8 },
  commentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.backgroundSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  commentCount: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
});

const modalStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSoft },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  title: { fontSize: 17, fontWeight: "800", color: colors.text },
  cancel: { fontSize: 15, color: colors.textMuted },
  done: { fontSize: 15, color: colors.coral, fontWeight: "800" },
  postBtn: {
    backgroundColor: colors.coral,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    minWidth: 64,
    alignItems: "center",
  },
  postText: { color: "#fff", fontWeight: "800" },
  body: { padding: 20, paddingBottom: 40 },
  fieldLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "800",
    marginBottom: 8,
  },
  spacePicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  spaceChip: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  spaceChipOn: { backgroundColor: "#FFF0EE", borderColor: colors.coral },
  spaceChipText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  input: {
    minHeight: 180,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    lineHeight: 23,
    marginBottom: 12,
  },
  tagsInput: {
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
    marginBottom: 12,
  },
  anonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.coral, borderColor: colors.coral },
  anonText: { fontSize: 14, color: colors.text, fontWeight: "700" },
  guidelineItem: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: colors.white,
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  guidelineText: { flex: 1, color: colors.text, lineHeight: 20, fontSize: 14 },
  subtitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 16,
    marginTop: 10,
    marginBottom: 10,
  },
  spaceRow: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.white,
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  spaceEmoji: { fontSize: 26 },
  spaceTitle: { color: colors.text, fontWeight: "800", marginBottom: 3 },
  spaceDesc: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  emptyText: {
    color: colors.textMuted,
    textAlign: "center",
    marginVertical: 24,
  },
  commentCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  commentAuthor: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  commentContent: { color: colors.text, fontSize: 14, lineHeight: 20 },
  commentActions: { flexDirection: "row", gap: 14, marginTop: 8 },
  actionText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  commentInput: {
    flex: 1,
    maxHeight: 92,
    backgroundColor: colors.backgroundSoft,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.coral,
    alignItems: "center",
    justifyContent: "center",
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSoft },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerSub: { fontSize: 13, color: colors.textMuted },
  headerTitle: { fontSize: 22, fontWeight: "700", color: colors.text },
  guidelinesBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFF0EE",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  guidelinesText: { color: colors.coral, fontSize: 12, fontWeight: "800" },
  banner: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: colors.periwinkle,
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  bannerLeft: { flex: 1 },
  bannerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 4,
  },
  bannerSub: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  bannerEmoji: { fontSize: 40, marginLeft: 8 },
  spacesRow: { marginBottom: 12 },
  spacesScroll: { paddingHorizontal: 20, gap: 8 },
  spaceFilter: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  spaceFilterOn: { backgroundColor: "#FFF0EE", borderColor: colors.coral },
  spaceFilterText: { color: colors.text, fontWeight: "800", fontSize: 12 },
  scroll: { paddingHorizontal: 20, paddingBottom: 100 },
  empty: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.coral,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.coral,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
