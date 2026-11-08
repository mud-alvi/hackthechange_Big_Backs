
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import type { IntroAuthController } from '../../hooks/useIntroAuth';
import {
  INTRO_COLORS as C,
  INTRO_FONTS as F,
} from '../../constants/introTheme';

type AuthCardProps = {
  auth: IntroAuthController;
};

function FormInput({
  label,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        style={styles.input}
        placeholderTextColor="#968CA8"
      />
    </View>
  );
}

export function AuthCard({ auth }: AuthCardProps) {
  const isSignup = auth.mode === 'signup';

  return (
    <View style={styles.card}>
      {/* Glass-style highlight */}
      <View pointerEvents="none" style={styles.highlight} />

      <Text style={styles.heading}>
        {isSignup ? 'Join the fun!' : 'Welcome back!'}
      </Text>

      <Text style={styles.subtitle}>
        {isSignup
          ? 'Create your village identity ♡'
          : 'Ready to find your people?'}
      </Text>

      {isSignup && (
        <FormInput
          label="Username"
          placeholder="Your username"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          value={auth.username}
          onChangeText={auth.setUsername}
        />
      )}

      <FormInput
        label="Email address"
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        value={auth.email}
        onChangeText={auth.setEmail}
      />

      <FormInput
        label="Password"
        placeholder="Your password"
        secureTextEntry
        autoComplete={isSignup ? 'new-password' : 'current-password'}
        value={auth.password}
        onChangeText={auth.setPassword}
      />

      {isSignup && (
        <FormInput
          label="Confirm password"
          placeholder="Confirm your password"
          secureTextEntry
          value={auth.confirmPassword}
          onChangeText={auth.setConfirmPassword}
        />
      )}

      <Pressable
        disabled={auth.loading}
        onPress={auth.handleAuth}
        style={({ pressed }) => [
          styles.primaryButton,
          auth.loading && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        {auth.loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryText}>
            {isSignup ? 'Create Account  →' : 'Log In  →'}
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={auth.switchMode}
        disabled={auth.loading}
        style={styles.switchButton}
      >
        <Text style={styles.switchText}>
          {isSignup
            ? 'Already have an account? '
            : 'New to the village? '}
          <Text style={styles.switchAccent}>
            {isSignup ? 'Log In' : 'Sign Up'}
          </Text>
        </Text>
      </Pressable>

      {!!auth.message && (
        <Text style={styles.message}>{auth.message}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 420,
    padding: 22,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.96)',
    overflow: 'hidden',

    shadowColor: C.violetDark,
    shadowOpacity: 0.14,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 7,
  },

  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 55,
    backgroundColor: 'rgba(255,255,255,0.32)',
    borderBottomRightRadius: 80,
  },

  heading: {
    fontFamily: F.bold,
    fontSize: 30,
    textAlign: 'center',
    color: C.ink,
  },

  subtitle: {
    fontFamily: F.regular,
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 17,
  },

  field: {
    marginBottom: 13,
  },

  label: {
    fontFamily: F.medium,
    fontSize: 13,
    color: C.ink,
    marginBottom: 6,
    marginLeft: 4,
  },

  input: {
    height: 51,
    borderRadius: 16,
    paddingHorizontal: 15,
    fontFamily: F.regular,
    fontSize: 15,
    color: C.ink,
    backgroundColor: 'rgba(246,242,255,0.82)',
    borderWidth: 1,
    borderColor: '#EAE3F4',
  },

  primaryButton: {
    backgroundColor: C.violet,
    height: 54,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },

  primaryText: {
    color: '#FFFFFF',
    fontFamily: F.semibold,
    fontSize: 17,
  },

  switchButton: {
    alignItems: 'center',
    marginTop: 17,
  },

  switchText: {
    fontFamily: F.regular,
    color: C.muted,
    fontSize: 14,
  },

  switchAccent: {
    fontFamily: F.semibold,
    color: C.pinkDark,
  },

  message: {
    fontFamily: F.medium,
    color: '#BC497C',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 15,
    lineHeight: 20,
  },

  disabled: {
    opacity: 0.55,
  },

  pressed: {
    opacity: 0.8,
  },
});
