import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { useTranslation } from "../i18n/I18nContext";
import type { HomeStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<HomeStackParamList, "Feature">;

export function FeaturePlaceholderScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { title } = route.params;
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.row}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹ {t("back")}</Text>
        </Pressable>
      </View>
      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{t("featurePlaceholderSub")}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.backgroundSoft,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  back: {
    fontSize: 17,
    color: colors.borderInput,
    fontWeight: "600",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  sub: {
    fontSize: 16,
    color: colors.textMuted,
    lineHeight: 22,
  },
});
