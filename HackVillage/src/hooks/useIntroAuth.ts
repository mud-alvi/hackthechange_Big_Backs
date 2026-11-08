
import { useRouter } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { supabase } from '../../lib/supabase';

type AuthMode = 'login' | 'signup';

export function useIntroAuth() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    supabase.auth.getSession()
      .then(({ data }) => {
        if (active) {
          setSession(data.session);
          setCheckingSession(false);
        }
      })
      .catch(() => {
        if (active) setCheckingSession(false);
      });

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_event, newSession) => {
        if (active) setSession(newSession);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) {
      router.replace('/home');
    }
  }, [session, router]);

  function switchMode() {
    setMode(current =>
      current === 'login' ? 'signup' : 'login'
    );
    setMessage('');
    setPassword('');
    setConfirmPassword('');
  }

  async function handleAuth() {
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    if (!cleanEmail || !password) {
      setMessage('Please complete all required fields.');
      return;
    }

    if (mode === 'signup') {
      if (!/^[A-Za-z0-9_]{3,20}$/.test(cleanUsername)) {
        setMessage(
          'Username must be 3–20 characters: letters, numbers or underscores.'
        );
        return;
      }

      if (password.length < 6) {
        setMessage('Password must contain at least 6 characters.');
        return;
      }

      if (password !== confirmPassword) {
        setMessage('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    setMessage('');

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { username: cleanUsername },
          },
        });

        if (error) throw error;

        if (!data.session) {
          setMessage(
            'Check your email to verify your account. Then return and log in.'
          );
        } else {
          setSession(data.session);
        }
      } else {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

        if (error) throw error;
        setSession(data.session);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong.'
      );
    } finally {
      setLoading(false);
    }
  }

  return {
    mode,
    username,
    setUsername,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    session,
    checkingSession,
    loading,
    message,
    switchMode,
    handleAuth,
  };
}

export type IntroAuthController = ReturnType<typeof useIntroAuth>;
