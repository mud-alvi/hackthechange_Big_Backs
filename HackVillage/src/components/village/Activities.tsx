import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C, F, ui } from '../../constants/villageTheme';

const initialCards = ['✦', '♡', '☀', '☾', '♡', '☾', '✦', '☀'];
export function Games() {
  const [cards, setCards] = useState(initialCards);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function flip(index: number) {
    if (flipped.length === 2 || flipped.includes(index) || matched.includes(index)) return;
    const next = [...flipped, index];
    setFlipped(next);
    if (next.length === 2) {
      setMoves((n) => n + 1);
      if (cards[next[0]] === cards[next[1]]) {
        setMatched((current) => [...current, ...next]);
        setFlipped([]);
      } else
        timer.current = setTimeout(() => {
          setFlipped([]);
          timer.current = null;
        }, 850);
    }
  }
  function reset() {
    if (timer.current) clearTimeout(timer.current);
    const next = [...initialCards];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    setCards(next);
    setFlipped([]);
    setMatched([]);
    setMoves(0);
  }
  return (
    <ScrollView contentContainerStyle={ui.page}>
      <View>
        <Text style={ui.title}>A little play break.</Text>
        <Text style={ui.body}>Clear your head. Find your match.</Text>
      </View>
      <View style={[ui.card, { backgroundColor: '#FAF9FF' }]}>
        <Text style={ui.heading}>Village pairs</Text>
        <Text style={ui.body}>Flip two cards. Match all four pairs.</Text>
        <View style={[ui.row, { justifyContent: 'space-between' }]}>
          <Text style={ui.caption}>{moves} moves</Text>
          <Text style={ui.caption}>{matched.length / 2} / 4 pairs</Text>
        </View>
        <View style={s.grid}>
          {cards.map((card, i) => {
            const visible = flipped.includes(i) || matched.includes(i);
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`Card ${i + 1}${visible ? ': ' + card : ', face down'}`}
                disabled={visible}
                onPress={() => flip(i)}
                style={[
                  s.gameCard,
                  visible && s.gameCardOpen,
                  matched.includes(i) && { backgroundColor: C.mint, borderColor: '#B9DCC9' },
                ]}
              >
                <Text style={[s.symbol, visible && { color: C.violet }]}>
                  {visible ? card : '?'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text accessibilityLiveRegion="polite" style={[ui.body, { textAlign: 'center' }]}>
          {matched.length === 8
            ? `All matched in ${moves} moves. Nice work!`
            : 'A tiny challenge, just for fun.'}
        </Text>
        <Pressable accessibilityRole="button" onPress={reset} style={ui.button}>
          <Text style={ui.buttonText}>{matched.length === 8 ? 'Play again' : 'New game'}</Text>
        </Pressable>
      </View>
      <Text style={ui.caption}>
        Single-player front-end game. This does not change your account XP.
      </Text>
    </ScrollView>
  );
}

const questions = [
  {
    title: 'A little JavaScript',
    code: '[1, 2, 3].map(n => n * 2)',
    question: 'What does this return?',
    choices: ['[1, 2, 3]', '[2, 4, 6]', '6'],
    answer: 1,
    explanation: 'map creates a new array by transforming each item. Here, each number is doubled.',
  },
  {
    title: 'Know your arrays',
    code: "['hello', 'village'].length",
    question: 'What is the result?',
    choices: ['2', '12', 'undefined'],
    answer: 0,
    explanation: 'An array’s length counts items. This array contains two strings.',
  },
  {
    title: 'Strictly speaking',
    code: '3 === "3"',
    question: 'What does this evaluate to?',
    choices: ['true', 'false', 'null'],
    answer: 1,
    explanation:
      'Strict equality checks type as well as value. A number and a string have different types.',
  },
];
export function Coding() {
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const q = questions[index];
  return (
    <ScrollView contentContainerStyle={ui.page}>
      <View>
        <Text style={ui.title}>Small steps. Big ideas.</Text>
        <Text style={ui.body}>Give your brain a little stretch.</Text>
      </View>
      <View style={ui.card}>
        <Text style={ui.caption}>
          CHALLENGE {index + 1} OF {questions.length}
        </Text>
        <Text style={ui.heading}>{q.title}</Text>
        <View style={s.codeBox}>
          <Text selectable style={s.code}>
            {q.code}
          </Text>
        </View>
        <Text style={ui.body}>{q.question}</Text>
        {q.choices.map((answer, i) => (
          <Pressable
            key={answer}
            accessibilityRole="button"
            accessibilityState={{ selected: choice === i }}
            disabled={choice !== null}
            onPress={() => setChoice(i)}
            style={[
              s.answer,
              choice !== null && i === q.answer && s.correct,
              choice === i && i !== q.answer && s.incorrect,
            ]}
          >
            <Text style={{ color: C.ink, fontFamily: F.medium }}>{answer}</Text>
            <Text style={{ color: C.violet }}>
              {choice !== null && i === q.answer ? '✓' : choice === i ? '×' : ''}
            </Text>
          </Pressable>
        ))}
        {choice !== null && (
          <View style={{ gap: 12 }}>
            <Text accessibilityLiveRegion="polite" style={ui.body}>
              {choice === q.answer ? 'You got it! ' : 'Almost! '}
              {q.explanation}
            </Text>
            <Pressable
              accessibilityRole="button"
              style={ui.button}
              onPress={() => {
                setChoice(null);
                setIndex((index + 1) % questions.length);
              }}
            >
              <Text style={ui.buttonText}>
                {index === questions.length - 1 ? 'Try again' : 'Next challenge'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
      <Text style={ui.caption}>Practice mode · account XP stays with your backend.</Text>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  gameCard: {
    width: '22%',
    aspectRatio: 0.83,
    borderRadius: 16,
    backgroundColor: C.violet,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.violet,
  },
  gameCardOpen: { backgroundColor: C.light, borderColor: '#D9D0FA' },
  symbol: { fontSize: 30, color: '#BEB1F6', fontFamily: F.medium },
  codeBox: { padding: 20, borderRadius: 16, backgroundColor: '#242132' },
  code: { color: '#DED4FF', fontFamily: 'monospace', fontSize: 15, lineHeight: 24 },
  answer: {
    minHeight: 50,
    padding: 16,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  correct: { borderColor: '#82BC9A', backgroundColor: C.mint },
  incorrect: { borderColor: '#DB9AB5', backgroundColor: C.pink },
});
