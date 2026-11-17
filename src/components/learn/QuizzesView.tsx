import React, { useMemo, useState } from 'react';
import { Award, CheckCircle2, Flame, RotateCcw, Shuffle, Sparkles, Target, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PROTOCOLS } from '../../protocols';
import type { ProtocolQuizQuestion } from '../../protocols/types';
import { useAppStore } from '../../store/useAppStore';

interface QuizItem extends ProtocolQuizQuestion {
  protocolId: string;
  protocolName: string;
}

export const QuizzesView: React.FC = () => {
  const { t } = useTranslation();
  const {
    quizScores,
    recordQuizScore,
    dailyStreak,
    updateDailyStreak,
    wrongQuizQuestions,
    recordWrongQuizQuestion,
    clearWrongQuizQuestion,
  } = useAppStore();
  const [selectedProtocolId, setSelectedProtocolId] = useState<string>('challenge-10');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const questions: QuizItem[] = useMemo(() => {
    if (selectedProtocolId === 'review-missed') {
      return wrongQuizQuestions.slice(0, 10).map((wq) => ({
        protocolId: wq.protocolId,
        protocolName: PROTOCOLS.find((p) => p.id === wq.protocolId)?.name ?? wq.protocolId.toUpperCase(),
        question: wq.question,
        options: wq.options,
        correctIndex: wq.correctIndex,
        explanation: wq.explanation,
      }));
    }
    if (selectedProtocolId === 'challenge-10') {
      const pool: QuizItem[] = [];
      for (const p of PROTOCOLS) {
        if (p.quiz[0]) {
          pool.push({ ...p.quiz[0], protocolId: p.id, protocolName: p.name });
        }
      }
      return pool.filter((_, idx) => idx % 3 === 0).slice(0, 10);
    }
    const proto = PROTOCOLS.find((p) => p.id === selectedProtocolId) ?? PROTOCOLS[0];
    return proto.quiz.map((q) => ({ ...q, protocolId: proto.id, protocolName: proto.name }));
  }, [selectedProtocolId, wrongQuizQuestions]);

  const correctCount = questions.reduce(
    (acc, q, idx) => (answers[idx] === q.correctIndex ? acc + 1 : acc),
    0
  );
  const percent = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;

  const handleSubmit = () => {
    setSubmitted(true);
    recordQuizScore(selectedProtocolId, percent);
    updateDailyStreak();
    questions.forEach((q, idx) => {
      const picked = answers[idx];
      if (picked !== q.correctIndex) {
        recordWrongQuizQuestion({
          protocolId: q.protocolId,
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        });
      } else {
        clearWrongQuizQuestion(q.question);
      }
    });
  };

  const handleReset = () => {
    setAnswers({});
    setSubmitted(false);
  };

  return (
    <div className="space-y-4">
      {/* Daily Streak Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
            <Flame className="w-5 h-5 fill-amber-500 text-amber-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm text-[var(--text-primary)]">
                {dailyStreak.current} Day Streak!
              </span>
              <span className="rounded-full bg-[var(--bg-inset)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--text-secondary)] border border-[var(--border-hairline)]">
                Best: {dailyStreak.longest} days
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Solve a quiz daily to keep your learning momentum going.
            </p>
          </div>
        </div>

        {wrongQuizQuestions.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setSelectedProtocolId('review-missed');
              setAnswers({});
              setSubmitted(false);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/20 transition-colors"
          >
            <Target className="w-3.5 h-3.5" />
            <span>Practice {wrongQuizQuestions.length} Missed Question{wrongQuizQuestions.length === 1 ? '' : 's'}</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4.5">
        <div>
          <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
            {t('learn.quizzes')}
          </h2>
          <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
            Test your knowledge on any of the 39 protocols or review questions you got wrong.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Choose quiz topic"
            value={selectedProtocolId}
            onChange={(e) => {
              setSelectedProtocolId(e.target.value);
              setAnswers({});
              setSubmitted(false);
            }}
            className="h-9.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 text-[13px] font-medium text-[var(--text-primary)]"
          >
            {wrongQuizQuestions.length > 0 && (
              <option value="review-missed">
                🎯 Review Missed Questions ({wrongQuizQuestions.length})
              </option>
            )}
            <option value="challenge-10">Mixed 10-Question Challenge</option>
            {PROTOCOLS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.fullName} ({quizScores[p.id] !== undefined ? `${quizScores[p.id]}%` : 'New'})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setSelectedProtocolId('challenge-10');
              setAnswers({});
              setSubmitted(false);
            }}
            className="flex h-9.5 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] px-3.5 text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>Challenge</span>
          </button>
        </div>
      </div>

      {selectedProtocolId === 'review-missed' && questions.length === 0 && (
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-[var(--tone-success)] mx-auto" />
          <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
            Zero Missed Questions!
          </h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
            You've cleared all missed questions or haven't gotten any wrong yet. Select a protocol quiz or mixed challenge to test your knowledge!
          </p>
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-3.5">
        {questions.map((q, qIdx) => {
          const picked = answers[qIdx];
          return (
            <div
              key={`${selectedProtocolId}-${qIdx}`}
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-3.5"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono text-[13px] font-bold text-[var(--accent-primary)]">
                  Q{qIdx + 1} · {q.protocolName}
                </span>
                {submitted && (
                  <span
                    className={`inline-flex items-center gap-1 font-mono text-xs font-bold ${
                      picked === q.correctIndex ? 'text-[var(--tone-success)]' : 'text-[var(--tone-danger)]'
                    }`}
                  >
                    {picked === q.correctIndex ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> {t('learn.correct')}
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" /> {t('learn.incorrect')}
                      </>
                    )}
                  </span>
                )}
              </div>

              <p className="font-display text-[15px] font-semibold text-[var(--text-primary)] leading-snug">{q.question}</p>

              <div className="grid gap-2.5 sm:grid-cols-2">
                {q.options.map((opt, oIdx) => {
                  const isPicked = picked === oIdx;
                  const isRight = submitted && oIdx === q.correctIndex;
                  const isWrong = submitted && isPicked && oIdx !== q.correctIndex;
                  return (
                    <button
                      key={oIdx}
                      type="button"
                      disabled={submitted}
                      onClick={() => setAnswers((prev) => ({ ...prev, [qIdx]: oIdx }))}
                      className={`rounded-lg border px-3.5 py-2.5 text-start text-[13px] transition-colors ${
                        isRight
                          ? 'border-[var(--tone-success)] bg-[var(--tone-success)]/12 text-[var(--tone-success)] font-semibold'
                          : isWrong
                          ? 'border-[var(--tone-danger)] bg-[var(--tone-danger)]/12 text-[var(--tone-danger)] font-medium'
                          : isPicked
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--text-primary)] font-semibold'
                          : 'border-[var(--border-hairline)] bg-[var(--bg-inset)]/60 text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50 hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {submitted && (
                <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3.5 py-2.5 text-[13px] text-[var(--text-secondary)]">
                  <strong className="text-[var(--accent-primary)]">Explanation:</strong> {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit / Score Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4.5">
        {submitted ? (
          <div className="flex items-center gap-3">
            <Award className={`w-6 h-6 ${percent >= 80 ? 'text-[var(--tone-warning)]' : 'text-[var(--accent-primary)]'}`} />
            <div>
              <div className="font-display font-bold text-base text-[var(--text-primary)]">
                {t('learn.score')}: {correctCount}/{questions.length} ({percent}%)
              </div>
              <div className="text-[13px] text-[var(--text-secondary)]">
                {percent >= 80 ? 'Badge unlocked: Protocol Mastery' : 'Review the explanations above and retry.'}
              </div>
            </div>
          </div>
        ) : (
          <div className="font-mono text-[13px] font-semibold text-[var(--text-secondary)]">
            {Object.keys(answers).length} / {questions.length} answered
          </div>
        )}

        <div className="flex items-center gap-2">
          {submitted ? (
            <button
              type="button"
              onClick={handleReset}
              className="flex h-9.5 items-center gap-1.5 rounded-lg bg-[var(--accent-cta)] px-4 text-[13px] font-semibold text-white hover:bg-[var(--accent-cta-hover)] transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t('learn.tryAgain')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={Object.keys(answers).length === 0}
              className="flex h-9.5 items-center gap-1.5 rounded-lg bg-[var(--accent-cta)] px-4 text-[13px] font-semibold text-white hover:bg-[var(--accent-cta-hover)] disabled:opacity-40 transition-colors"
            >
              <span>Check Answers</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
