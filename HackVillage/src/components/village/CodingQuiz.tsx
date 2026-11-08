import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

const QUESTIONS = [
  {
    text: 'What does HTML mainly define?',
    choices: ['Page structure', 'Database tables', 'Network security'],
    answer: 0,
  },
  {
    text: 'Which language mainly styles webpages?',
    choices: ['SQL', 'CSS', 'Python'],
    answer: 1,
  },
  {
    text: 'What does === check in JavaScript?',
    choices: ['Only type', 'Only value', 'Value and type'],
    answer: 2,
  },
  {
    text: 'What is the first index of a JavaScript array?',
    choices: ['0', '1', '-1'],
    answer: 0,
  },
  {
    text: 'What does JSON.parse() do?',
    choices: [
      'Encrypts a password',
      'Converts JSON text into a JavaScript value',
      'Uploads a file',
    ],
    answer: 1,
  },
  {
    text: 'Which HTTP method normally retrieves data?',
    choices: ['DELETE', 'POST', 'GET'],
    answer: 2,
  },
  {
    text: 'What does a Git commit record?',
    choices: [
      'A snapshot of staged changes',
      'Only deleted files',
      'Your current internet speed',
    ],
    answer: 0,
  },
  {
    text: 'Which React hook manages component state?',
    choices: ['useEffect', 'useState', 'useRef'],
    answer: 1,
  },
  {
    text: 'What does an SQL SELECT statement do?',
    choices: ['Deletes a table', 'Creates a password', 'Retrieves data'],
    answer: 2,
  },
  {
    text: 'Where should a Supabase service-role key be kept?',
    choices: ['On a trusted server', 'Inside the phone app', 'In a public repository'],
    answer: 0,
  },
];

type Progress = {
  index: number;
  xp: number;
};

export function CodingQuiz({ storageKey }: { storageKey: string }) {
  const [progress, setProgress] = useState<Progress>({ index: 0, xp: 0 });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const pending = useRef(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const saved = await AsyncStorage.getItem(storageKey);
        if (saved) {
          const value = JSON.parse(saved) as Progress;

          if (
            Number.isInteger(value.index) &&
            value.index >= 0 &&
            value.index <= QUESTIONS.length &&
            Number.isInteger(value.xp) &&
            value.xp >= 0 &&
            value.xp <= value.index * 10
          ) {
            if (active) setProgress(value);
          }
        }
      } catch {
        if (active) setFeedback('Previous progress could not be loaded.');
      } finally {
        if (active) setReady(true);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [storageKey]);

  async function answer(choice: number) {
    if (!ready || pending.current) return;

    const question = QUESTIONS[progress.index];
    if (!question) return;

    pending.current = true;
    setBusy(true);

    const correct = choice === question.answer;
    const next = {
      index: progress.index + 1,
      xp: progress.xp + (correct ? 10 : 0),
    };

    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
      setProgress(next);
      setFeedback(
        correct
          ? 'Correct! +10 XP'
          : `Answer: ${question.choices[question.answer]}`,
      );
    } catch {
      setFeedback('Could not save progress. Please try again.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const question = QUESTIONS[progress.index];

  return (
    <View
      style={{
        width: '100%',
        padding: 16,
        gap: 10,
        backgroundColor: '#F4F1FD',
        borderRadius: 16,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: '700', color: '#583C86' }}>
        Coding quiz · {progress.xp} XP
      </Text>

      {!!feedback && <Text>{feedback}</Text>}

      {!ready ? (
        <Text>Loading quiz…</Text>
      ) : !question ? (
        <Text>
          Quiz complete! You earned {progress.xp} / 100 XP.
          Ask your new connection how they did!
        </Text>
      ) : (
        <>
          <Text>
            Question {progress.index + 1} / {QUESTIONS.length}
          </Text>

          <Text style={{ fontSize: 16, fontWeight: '600' }}>
            {question.text}
          </Text>

          {question.choices.map((choice, index) => (
            <Pressable
              key={choice}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => void answer(index)}
              style={{
                padding: 12,
                backgroundColor: '#FFFFFF',
                borderRadius: 10,
                opacity: busy ? 0.5 : 1,
              }}
            >
              <Text style={{ color: '#583C86' }}>{choice}</Text>
            </Pressable>
          ))}
        </>
      )}
    </View>
  );
}