import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  variant?: 'welcome' | 'home';
};

export function DecorBlobs({ variant = 'welcome' }: Props) {
  if (variant === 'home') {
    return (
      <>
        <View style={[styles.blob, styles.blobBlueHome]} />
        <View style={[styles.blob, styles.blobPinkHome]} />
      </>
    );
  }
  return (
    <>
      <View style={[styles.blob, styles.blobBlue]} />
      <View style={[styles.blob, styles.blobPink]} />
    </>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobBlue: {
    width: 140,
    height: 140,
    backgroundColor: colors.blobBlue,
    opacity: 0.55,
    top: -40,
    left: -50,
  },
  blobPink: {
    width: 120,
    height: 120,
    backgroundColor: colors.blobPink,
    opacity: 0.6,
    top: -30,
    right: -40,
  },
  blobBlueHome: {
    width: 160,
    height: 160,
    backgroundColor: colors.blobBlue,
    opacity: 0.45,
    top: -50,
    left: -60,
  },
  blobPinkHome: {
    width: 180,
    height: 180,
    backgroundColor: colors.blobPink,
    opacity: 0.4,
    top: -60,
    right: -70,
  },
});
