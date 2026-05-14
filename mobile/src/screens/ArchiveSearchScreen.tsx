import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Modal,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ApiError } from "../api/client";
import {
  ArchiveSearchResult,
  ArchiveSort,
  ArchiveTab,
  searchArchive,
} from "../api/archive";
import type { RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../i18n/I18nContext";
import {
  getArchiveFavoriteIds,
  toggleArchiveFavoriteId,
} from "../lib/archiveFavorites";

type Props = NativeStackScreenProps<RootStackParamList, "ArchiveSearch">;

const TABS: Array<{
  key: ArchiveTab;
  labelKey: "journals" | "insights" | "favorites";
}> = [
  { key: "journals", labelKey: "journals" },
  { key: "insights", labelKey: "insights" },
  { key: "favorites", labelKey: "favorites" },
];


function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDateValue(value: string, days: number) {
  const base = value ? new Date(`${value}T00:00:00`) : new Date();
  base.setDate(base.getDate() + days);
  return formatDateValue(base);
}

function DateRangeModal({
  visible,
  startDate,
  endDate,
  onCancel,
  onApply,
}: {
  visible: boolean;
  startDate: string;
  endDate: string;
  onCancel: () => void;
  onApply: (startDate: string, endDate: string) => void;
}) {
  const { t } = useTranslation();
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);

  useEffect(() => {
    if (visible) {
      setDraftStart(startDate);
      setDraftEnd(endDate);
    }
  }, [endDate, startDate, visible]);

  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    setDraftStart(formatDateValue(start));
    setDraftEnd(formatDateValue(end));
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.dateModalBackdrop}>
        <View style={styles.dateModalCard}>
          <Text style={styles.dateModalTitle}>{t("dateRange")}</Text>
          <View style={styles.presetRow}>
            <Pressable style={styles.presetChip} onPress={() => applyPreset(7)}><Text style={styles.presetText}>{t("last7Days")}</Text></Pressable>
            <Pressable style={styles.presetChip} onPress={() => applyPreset(30)}><Text style={styles.presetText}>{t("last30Days")}</Text></Pressable>
            <Pressable style={styles.presetChip} onPress={() => { setDraftStart(""); setDraftEnd(""); }}><Text style={styles.presetText}>{t("clear")}</Text></Pressable>
          </View>
          <DateStepper label={t("fromDate")} value={draftStart} onChange={setDraftStart} />
          <DateStepper label={t("toDate")} value={draftEnd} onChange={setDraftEnd} />
          <View style={styles.dateModalActions}>
            <Pressable style={styles.dateCancelBtn} onPress={onCancel}><Text style={styles.dateCancelText}>{t("cancel")}</Text></Pressable>
            <Pressable style={styles.dateApplyBtn} onPress={() => onApply(draftStart, draftEnd)}><Text style={styles.dateApplyText}>{t("apply")}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DateStepper({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const displayValue = value || "—";
  return (
    <View style={styles.dateStepper}>
      <Text style={styles.dateStepperLabel}>{label}</Text>
      <View style={styles.dateStepperRow}>
        <Pressable style={styles.dateStepBtn} onPress={() => onChange(shiftDateValue(value, -1))}>
          <Ionicons name="chevron-back" size={18} color={colors.coral} />
        </Pressable>
        <Pressable style={styles.dateValueBtn} onPress={() => onChange(formatDateValue(new Date()))}>
          <Text style={styles.dateValueText}>{displayValue}</Text>
        </Pressable>
        <Pressable style={styles.dateStepBtn} onPress={() => onChange(shiftDateValue(value, 1))}>
          <Ionicons name="chevron-forward" size={18} color={colors.coral} />
        </Pressable>
      </View>
    </View>
  );
}

function splitTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function hasIntent({
  query,
  startDate,
  endDate,
  moodOrEmotion,
  tagsRaw,
  favoritesOnly,
  tab,
}: {
  query: string;
  startDate: string;
  endDate: string;
  moodOrEmotion: string;
  tagsRaw: string;
  favoritesOnly: boolean;
  tab: ArchiveTab;
}) {
  return Boolean(
    query.trim() ||
    startDate.trim() ||
    endDate.trim() ||
    moodOrEmotion.trim() ||
    tagsRaw.trim() ||
    favoritesOnly ||
    tab === "favorites",
  );
}

export function ArchiveSearchScreen({ navigation, route }: Props) {
  const { signOut } = useAuth();
  const { t } = useTranslation();
  const [tab, setTab] = useState<ArchiveTab>(
    route.params?.initialTab ?? "journals",
  );
  const [query, setQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateRangeVisible, setDateRangeVisible] = useState(false);
  const [moodOrEmotion, setMoodOrEmotion] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState<ArchiveSort>("newest");
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [results, setResults] = useState<ArchiveSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const shouldSearch = useMemo(
    () =>
      hasIntent({
        query,
        startDate,
        endDate,
        moodOrEmotion,
        tagsRaw,
        favoritesOnly,
        tab,
      }),
    [endDate, favoritesOnly, moodOrEmotion, query, startDate, tab, tagsRaw],
  );

  const runSearch = useCallback(async () => {
    const savedFavoriteIds = await getArchiveFavoriteIds();
    setFavoriteIds(savedFavoriteIds);

    if (!shouldSearch) {
      setResults([]);
      setSearched(false);
      setRefreshing(false);
      return;
    }

    if (
      (tab === "favorites" || favoritesOnly) &&
      savedFavoriteIds.length === 0
    ) {
      setResults([]);
      setSearched(true);
      setRefreshing(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await searchArchive({
        q: query.trim() || undefined,
        tab,
        start_date: startDate.trim() || undefined,
        end_date: endDate.trim() || undefined,
        mood_or_emotion: moodOrEmotion.trim() || undefined,
        tags: splitTags(tagsRaw),
        favorites_only: favoritesOnly || tab === "favorites",
        favorite_ids: savedFavoriteIds,
        sort,
      });
      setResults(
        data.map((item) => ({
          ...item,
          is_favorite: savedFavoriteIds.includes(item.id),
        })),
      );
      setSearched(true);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        await signOut("sessionExpired");
        return;
      }
      setError(
        e instanceof ApiError ? e.message : "Could not search your archive.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    endDate,
    favoritesOnly,
    moodOrEmotion,
    query,
    shouldSearch,
    signOut,
    sort,
    startDate,
    tab,
    tagsRaw,
  ]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void runSearch();
    }, 350);
    return () => clearTimeout(timeout);
  }, [runSearch]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void runSearch();
  }, [runSearch]);

  const clearFilters = useCallback(() => {
    setQuery("");
    setStartDate("");
    setEndDate("");
    setMoodOrEmotion("");
    setTagsRaw("");
    setFavoritesOnly(false);
    setSort("newest");
  }, []);

  const toggleFavorite = useCallback(
    async (id: number) => {
      const next = await toggleArchiveFavoriteId(id);
      setFavoriteIds(next);
      setResults((current) =>
        current
          .map((item) =>
            item.id === id ? { ...item, is_favorite: next.includes(id) } : item,
          )
          .filter((item) =>
            tab === "favorites" || favoritesOnly
              ? next.includes(item.id)
              : true,
          ),
      );
    },
    [favoritesOnly, tab],
  );

  const showFavoriteEmpty =
    (tab === "favorites" || favoritesOnly) && favoriteIds.length === 0;
  const showNoResults =
    searched && !loading && results.length === 0 && !showFavoriteEmpty;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("archiveTitle")}</Text>
          <Text style={styles.subtitle}>{t("archiveSubtitle")}</Text>
        </View>
        <Pressable onPress={clearFilters} hitSlop={10}>
          <Text style={styles.clearText}>{t("clear")}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t("searchPlaceholder")}
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
        </View>

        <View style={styles.tabsRow}>
          {TABS.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.tab, tab === item.key && styles.tabOn]}
              onPress={() => setTab(item.key)}
            >
              <Text
                style={[styles.tabText, tab === item.key && styles.tabTextOn]}
              >
                {t(item.labelKey)}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.filtersCard}>
          <Text style={styles.filterTitle}>{t("filters")}</Text>
          <Pressable style={styles.dateRangeButton} onPress={() => setDateRangeVisible(true)}>
            <Ionicons name="calendar-outline" size={16} color={colors.coral} />
            <Text style={styles.dateRangeText}>
              {startDate || endDate
                ? `${startDate || t("fromDate")} → ${endDate || t("toDate")}`
                : t("selectDateRange")}
            </Text>
          </Pressable>
          <TextInput
            style={styles.filterInput}
            value={moodOrEmotion}
            onChangeText={setMoodOrEmotion}
            placeholder={t("moodOrEmotion")}
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={styles.filterInput}
            value={tagsRaw}
            onChangeText={setTagsRaw}
            placeholder={t("tagsComma")}
            placeholderTextColor={colors.textMuted}
          />
          <View style={styles.filterActions}>
            <Pressable
              style={[styles.chip, favoritesOnly && styles.chipOn]}
              onPress={() => setFavoritesOnly((value) => !value)}
            >
              <Ionicons
                name={favoritesOnly ? "star" : "star-outline"}
                size={14}
                color={favoritesOnly ? "#fff" : colors.coral}
              />
              <Text
                style={[styles.chipText, favoritesOnly && styles.chipTextOn]}
              >
                {t("favoritesOnly")}
              </Text>
            </Pressable>
            {(["newest", "oldest"] as ArchiveSort[]).map((item) => (
              <Pressable
                key={item}
                style={[styles.chip, sort === item && styles.chipOn]}
                onPress={() => setSort(item)}
              >
                <Text
                  style={[styles.chipText, sort === item && styles.chipTextOn]}
                >
                  {item === "newest" ? t("newest") : t("oldest")}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={runSearch}>
              <Text style={styles.retryText}>{t("retry")}</Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.coral} />
          </View>
        ) : null}

        {!loading && !searched && !showFavoriteEmpty ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🔎</Text>
            <Text style={styles.emptyTitle}>{t("startSearchingArchive")}</Text>
            <Text style={styles.emptyText}>
              {t("startSearchingArchiveSub")}
            </Text>
          </View>
        ) : null}

        {!loading && showFavoriteEmpty ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>⭐</Text>
            <Text style={styles.emptyTitle}>{t("noFavorites")}</Text>
            <Text style={styles.emptyText}>{t("noFavoritesSub")}</Text>
          </View>
        ) : null}

        {showNoResults ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🗂️</Text>
            <Text style={styles.emptyTitle}>{t("noEntriesFound")}</Text>
            <Text style={styles.emptyText}>{t("tryChangingFilters")}</Text>
          </View>
        ) : null}

        {!loading && results.length ? (
          <View style={styles.resultsWrap}>
            <Text style={styles.resultsCount}>
              {results.length}{" "}
              {results.length === 1 ? t("result") : t("results")}
            </Text>
            {results.map((item) => (
              <View
                key={`${item.result_type}-${item.id}`}
                style={styles.resultCard}
              >
                <View style={styles.resultTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultType}>
                      {item.result_type === "insight"
                        ? t("insight")
                        : t("journal")}{" "}
                      • {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                    <Text style={styles.resultTitle}>{item.title}</Text>
                  </View>
                  <Pressable
                    onPress={() => toggleFavorite(item.id)}
                    hitSlop={10}
                  >
                    <Ionicons
                      name={item.is_favorite ? "star" : "star-outline"}
                      size={22}
                      color={item.is_favorite ? "#F59E0B" : colors.textMuted}
                    />
                  </Pressable>
                </View>
                <Text style={styles.preview}>{item.content_preview}</Text>
                {item.insight_summary ? (
                  <Text style={styles.insightText}>
                    {t("insight")}: {item.insight_summary}
                  </Text>
                ) : null}
                {item.recommendation ? (
                  <Text style={styles.recommendation}>
                    {t("recommendation")}: {item.recommendation}
                  </Text>
                ) : null}
                <View style={styles.metaRow}>
                  <View style={styles.moodPill}>
                    <Text style={styles.moodText}>
                      {t("mood")} {item.mood_score}/10
                    </Text>
                  </View>
                  {item.emotion_label ? (
                    <Text style={styles.metaText}>{item.emotion_label}</Text>
                  ) : null}
                  {item.sentiment_label ? (
                    <Text style={styles.metaText}>{item.sentiment_label}</Text>
                  ) : null}
                  {item.tags?.slice(0, 3).map((tag) => (
                    <Text key={tag} style={styles.tagText}>
                      #{tag}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <DateRangeModal
        visible={dateRangeVisible}
        startDate={startDate}
        endDate={endDate}
        onCancel={() => setDateRangeVisible(false)}
        onApply={(nextStart, nextEnd) => {
          setStartDate(nextStart);
          setEndDate(nextEnd);
          setDateRangeVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundSoft },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  title: { fontSize: 18, color: colors.text, fontWeight: "900" },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "700",
    marginTop: 2,
  },
  clearText: { color: colors.coral, fontWeight: "900", fontSize: 13 },
  body: { padding: 16, paddingBottom: 40, gap: 14 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700" },
  tabsRow: { flexDirection: "row", gap: 8 },
  tab: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.white,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  tabOn: { backgroundColor: colors.coral, borderColor: colors.coral },
  tabText: { color: colors.textMuted, fontSize: 12, fontWeight: "900" },
  tabTextOn: { color: "#fff" },
  filtersCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    padding: 14,
    gap: 10,
  },
  filterTitle: { color: colors.text, fontWeight: "900", fontSize: 14 },
  dateRangeButton: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F8FAFF", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 12, paddingVertical: 12 },
  dateRangeText: { flex: 1, color: colors.text, fontSize: 12, fontWeight: "800" },
  filterInput: {
    flex: 1,
    backgroundColor: "#F8FAFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  filterActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dateModalBackdrop: { flex: 1, backgroundColor: "rgba(17, 24, 39, 0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  dateModalCard: { width: "100%", maxWidth: 380, backgroundColor: colors.white, borderRadius: 24, padding: 18, gap: 12 },
  dateModalTitle: { fontSize: 18, fontWeight: "900", color: colors.text, textAlign: "center" },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  presetChip: { backgroundColor: "#FFF3F1", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  presetText: { color: colors.coral, fontWeight: "900", fontSize: 12 },
  dateStepper: { gap: 6 },
  dateStepperLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "900" },
  dateStepperRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateStepBtn: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF3F1" },
  dateValueBtn: { flex: 1, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#F8FAFF", borderWidth: 1, borderColor: "#E5E7EB" },
  dateValueText: { color: colors.text, fontWeight: "900" },
  dateModalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  dateCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 16, alignItems: "center", backgroundColor: "#EEF2F7" },
  dateCancelText: { color: colors.textMuted, fontWeight: "900" },
  dateApplyBtn: { flex: 1, paddingVertical: 13, borderRadius: 16, alignItems: "center", backgroundColor: colors.coral },
  dateApplyText: { color: "#fff", fontWeight: "900" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFF3F1",
    borderWidth: 1,
    borderColor: colors.coral,
  },
  chipOn: { backgroundColor: colors.coral },
  chipText: {
    color: colors.coral,
    fontWeight: "900",
    fontSize: 12,
    textTransform: "capitalize",
  },
  chipTextOn: { color: "#fff" },
  errorBox: { backgroundColor: "#FFE5E5", borderRadius: 16, padding: 14 },
  errorText: { color: "#B91C1C", fontWeight: "800", marginBottom: 10 },
  retryBtn: {
    backgroundColor: colors.coral,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  retryText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  center: { paddingVertical: 34, alignItems: "center" },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEF2FF",
  },
  emptyEmoji: { fontSize: 38, marginBottom: 8 },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 7,
    fontWeight: "700",
  },
  resultsWrap: { gap: 10 },
  resultsCount: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    marginLeft: 4,
  },
  resultCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
    gap: 9,
    borderWidth: 1,
    borderColor: "#EEF2FF",
  },
  resultTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  resultType: {
    color: colors.textMuted,
    fontWeight: "800",
    fontSize: 11,
    textTransform: "capitalize",
  },
  resultTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 16,
    marginTop: 2,
  },
  preview: { color: colors.text, fontSize: 13, lineHeight: 19 },
  insightText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
  },
  recommendation: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },
  moodPill: {
    backgroundColor: "#FFF3F1",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  moodText: { color: colors.coral, fontWeight: "900", fontSize: 11 },
  metaText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  tagText: { color: colors.coral, fontSize: 11, fontWeight: "900" },
});
