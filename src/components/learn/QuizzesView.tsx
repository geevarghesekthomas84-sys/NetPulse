import React, { useMemo, useState } from 'react';
import { Award, CheckCircle2, RotateCcw, Shuffle, XCircle } from 'lucide-react';
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
  const { quizScores, recordQuizScore } = useAppStore();
  const [selectedProtocolId, setSelectedProtocolId] = useState<string>('challenge-10');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const questions: QuizItem[] = useMemo(() => {
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
  }, [selectedProtocolId]);

  const correctCount = questions.reduce(
    (acc, q, idx) => (answers[idx] === q.correctIndex ? acc + 1 : acc),
    0
  );
  const percent = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;

  const handleSubmit = () => {
    setSubmitted(true);
    recordQuizScore(selectedProtocolId, percent);
  };

  const handleReset = () => {
    setAnswers({});
    setSubmitted(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4.5">
        <div>
          <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
            {t('learn.quizzes')}
          </h2>
          <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
            Test your knowledge on any of the 39 protocols or take the mixed challenge.
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
