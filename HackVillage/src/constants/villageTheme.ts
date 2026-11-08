import { StyleSheet } from 'react-native';

export const C = {
  ink: '#191923',
  muted: '#777681',
  violet: '#6952E8',
  light: '#F1EEFF',
  line: '#EDECF2',
  paper: '#FFFFFF',
  mint: '#EAF6F0',
  pink: '#FDEBF3',
};
export const F = {
  regular: 'Fredoka_400Regular',
  medium: 'Fredoka_500Medium',
  bold: 'Fredoka_600SemiBold',
};
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  page: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    padding: 24,
    paddingBottom: 36,
    gap: 20,
  },
  title: { fontFamily: F.bold, fontSize: 30, color: C.ink, letterSpacing: -0.8 },
  heading: { fontFamily: F.bold, fontSize: 20, color: C.ink },
  body: { fontFamily: F.regular, fontSize: 15, lineHeight: 22, color: C.muted },
  caption: { fontFamily: F.medium, fontSize: 12, color: C.muted },
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 24, padding: 20, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  button: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: C.violet,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonText: { fontFamily: F.medium, fontSize: 15, color: '#FFFFFF' },
  subtle: { backgroundColor: C.light },
  subtleText: { color: C.violet },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: F.regular,
    fontSize: 16,
    color: C.ink,
  },
  pressed: { opacity: 0.65 },
});
