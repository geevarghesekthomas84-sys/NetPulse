import React, { useMemo, useState } from 'react';
import { Award, CheckCircle2, RotateCcw, Shuffle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PROTOCOLS } from '../../protocols';
import type { ProtocolQuizQuestion } from '../../protocols/types';
import { useAppStore } from '../../store/useAppStore';
import { tc } from '../../i18n/content';

interface QuizItem extends ProtocolQuizQuestion {
  protocolId: string;
  protocolName: string;
}

export const QuizzesView: React.FC = () => {
  const { t } = useTranslation();
  const { quizScores, recordQuizScore, recordQuizResults } = useAppStore();
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
    // Remember what was missed so the Review tab can bring it back; answered-correctly clears it.
    recordQuizResults(
      questions
        .map((q, idx) => ({ q, idx }))
        .filter(({ idx }) => answers[idx] !== undefined)
        .map(({ q, idx }) => ({ protocolId: q.protocolId, question: q.question, correct: answers[idx] === q.correctIndex }))
    );
  };

  const handleReset = () => {
    setAnswers({});
    setSubmitted(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 hud-panel p-4">
        <div>
          <h2 className="font-display text-base font-bold text-[var(--text-primary)]">
            {t('learn.quizzes')}
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            {tc('Test your knowledge on any of the 39 protocols or take the mixed challenge.')}
          </p>
        </div>

        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
          <select
            aria-label={tc('Choose quiz topic')}
            value={selectedProtocolId}
            onChange={(e) => {
              setSelectedProtocolId(e.target.value);
              setAnswers({});
              setSubmitted(false);
            }}
            className="h-9 min-w-0 max-w-full flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 text-xs font-medium text-[var(--text-primary)] sm:flex-none"
          >
            <option value="challenge-10">{tc('Mixed 10-Question Challenge')}</option>
            {PROTOCOLS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {tc(p.fullName)} ({quizScores[p.id] !== undefined ? `${quizScores[p.id]}%` : tc('New')})
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
            className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>{tc('Challenge')}</span>
          </button>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-3">
        {questions.map((q, qIdx) => {
          const picked = answers[qIdx];
          return (
            <div
              key={`${selectedProtocolId}-${qIdx}`}
              className="hud-panel p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono font-bold text-[var(--accent-primary)]">
                  Q{qIdx + 1} · {q.protocolName}
                </span>
                {submitted && (
                  <span
                    className={`inline-flex items-center gap-1 font-mono font-semibold ${
                      picked === q.correctIndex ? 'text-[var(--tone-success)]' : 'text-[var(--tone-danger)]'
                    }`}
                  >
                    {picked === q.correctIndex ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> {t('learn.correct')}
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" /> {t('learn.incorrect')}
                      </>
                    )}
                  </span>
                )}
              </div>

              <p className="text-sm font-medium text-[var(--text-primary)]">{tc(q.question)}</p>

              <div className="grid gap-2 sm:grid-cols-2">
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
                      className={`rounded-lg border px-3 py-2 text-start text-xs transition-colors ${
                        isRight
                          ? 'border-[var(--tone-success)] bg-[var(--tone-success)]/12 text-[var(--tone-success)] font-semibold'
                          : isWrong
                          ? 'border-[var(--tone-danger)] bg-[var(--tone-danger)]/12 text-[var(--tone-danger)] font-medium'
                          : isPicked
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--text-primary)] font-semibold'
                          : 'border-[var(--border-hairline)] bg-[var(--bg-inset)]/60 text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50 hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {tc(opt)}
                    </button>
                  );
                })}
              </div>

              {submitted && (
                <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                  <strong className="text-[var(--accent-primary)]">{tc('Explanation:')}</strong> {tc(q.explanation)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit / Score Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4">
        {submitted ? (
          <div className="flex items-center gap-3">
            <Award className={`w-6 h-6 ${percent >= 80 ? 'text-[var(--tone-warning)]' : 'text-[var(--accent-primary)]'}`} />
            <div>
              <div className="font-display font-bold text-sm text-[var(--text-primary)]">
                {t('learn.score')}: {correctCount}/{questions.length} ({percent}%)
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                {percent >= 80 ? 'Badge unlocked: Protocol Mastery' : 'Review the explanations above and retry.'}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-[var(--text-muted)]">
            {Object.keys(answers).length} / {questions.length}
          </div>
        )}

        <div className="flex items-center gap-2">
          {submitted ? (
            <button
              type="button"
              onClick={handleReset}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--accent-cta)] px-4 text-xs font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-cta-hover)] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('learn.tryAgain')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={Object.keys(answers).length === 0}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--accent-cta)] px-4 text-xs font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-cta-hover)] disabled:opacity-40 transition-colors"
            >
              <span>{tc('Check Answers')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
