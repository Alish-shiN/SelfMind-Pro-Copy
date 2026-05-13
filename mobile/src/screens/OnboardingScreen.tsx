import { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { setOnboardingComplete } from "../lib/storage";
import { useTranslation } from "../i18n/I18nContext";

const { width } = Dimensions.get("window");

const SLIDE_KEYS = [
  { titleKey: "onboardingTitle1", subtitleKey: "onboardingSubtitle1" },
  { titleKey: "onboardingTitle2", subtitleKey: "onboardingSubtitle2" },
  { titleKey: "onboardingTitle3", subtitleKey: "onboardingSubtitle3" },
];

type Props = {
  onDone: () => void;
};

export function OnboardingScreen({ onDone }: Props) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / width);
    setIndex(i);
  };

  const goNext = async () => {
    if (index < SLIDE_KEYS.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
      return;
    }
    await setOnboardingComplete();
    onDone();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.bg} />
      <View style={styles.logoCircle}>
        <MaterialCommunityIcons name="head-cog" size={72} color={colors.text} />
        <View style={styles.brainDot} />
        <Text style={styles.brand}>SelfMindPro</Text>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDE_KEYS}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        getItemLayout={(_, i) => ({
          length: width,
          offset: width * i,
          index: i,
        })}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <Text style={styles.title}>{t(item.titleKey)}</Text>
            <Text style={styles.subtitle}>{t(item.subtitleKey)}</Text>
          </View>
        )}
      />

      <View style={styles.dots}>
        {SLIDE_KEYS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === index ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.nextBtn} onPress={goNext}>
          <Text style={styles.nextText}>{t("next")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.backgroundOnboarding,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backgroundOnboarding,
  },
  logoCircle: {
    alignSelf: "center",
    marginTop: 24,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  brainDot: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#E53935",
    top: 56,
    right: 52,
  },
  brand: {
    position: "absolute",
    bottom: 20,
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  slide: {
    paddingHorizontal: 28,
    paddingTop: 28,
    alignItems: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    lineHeight: 32,
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotActive: {
    backgroundColor: colors.coral,
  },
  dotInactive: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.dotOutline,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    alignItems: "flex-end",
  },
  nextBtn: {
    backgroundColor: colors.coralButton,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
  },
  nextText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 16,
  },
});
