import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { tc } from '../../i18n/content';
import { PROTOCOLS } from '../../protocols';
import type { ProtocolQuizQuestion } from '../../protocols/types';
import { useAppStore } from '../../store/useAppStore';

interface ReviewItem extends ProtocolQuizQuestion {
  protocolId: string;
  protocolName: string;
}

const ROUND_SIZE = 5;

/** A short round built from questions the learner got wrong before. */
export const ReviewView: React.FC = () => {
  const { t } = useTranslation();
  const { missed, recordQuizResults } = useAppStore();
  const [round, setRound] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [cleared, setCleared] = useState(0);

  const items: ReviewItem[] = useMemo(() => {
    const out: ReviewItem[] = [];
    const entries = Object.values(missed).sort((a, b) => b.misses - a.misses);
    for (const m of entries) {
      const proto = PROTOCOLS.find((p) => p.id === m.protocolId);
      const q = proto?.quiz.find((x) => x.question === m.question);
      if (proto && q) out.push({ ...q, protocolId: proto.id, protocolName: proto.name });
      if (out.length >= ROUND_SIZE) break;
    }
    return out;
    // `round` rebuilds the set after a finished round; `missed` is read once per round on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const total = Object.keys(missed).length;

  const submit = () => {
    const results = items
      .map((q, i) => ({ q, i }))
      .filter(({ i }) => answers[i] !== undefined)
      .map(({ q, i }) => ({ protocolId: q.protocolId, question: q.question, correct: answers[i] === q.correctIndex }));
    setCleared(results.filter((r) => r.correct).length);
    recordQuizResults(results);
    setSubmitted(true);
  };

  const again = () => {
    setAnswers({});
    setSubmitted(false);
    setRound((r) => r + 1);
  };

  if (items.length === 0 && !submitted) {
    return (
      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 text-center">
        <CheckCircle2 className="mx-auto h-9 w-9 text-[var(--tone-success)]" aria-hidden="true" />
        <h2 className="mt-3 font-display text-lg font-bold text-[var(--text-primary)]">{t('review.title')}</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-[var(--text-secondary)]">{t('review.empty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="hud-panel p-4">
        <h2 className="font-display text-base font-bold text-[var(--text-primary)]">{t('review.title')}</h2>
        <p className="text-sm text-[var(--text-secondary)]">{t('review.count', { count: total })}</p>
      </div>

      {items.map((q, qIdx) => {
        const picked = answers[qIdx];
        return (
          <div key={`${q.protocolId}-${qIdx}`} className="space-y-3 hud-panel p-4">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-mono font-bold text-[var(--accent-primary)]">
                {t('review.from', { name: q.protocolName })}
              </span>
              {submitted && picked !== undefined && (
                <span className={`inline-flex items-center gap-1 font-semibold ${picked === q.correctIndex ? 'text-[var(--tone-success)]' : 'text-[var(--tone-danger)]'}`}>
                  {picked === q.correctIndex ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  {picked === q.correctIndex ? t('learn.correct') : t('learn.incorrect')}
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
                    onClick={() => setAnswers((a) => ({ ...a, [qIdx]: oIdx }))}
                    className={`rounded-lg border px-3 py-2 text-start text-xs transition-colors ${
                      isRight
                        ? 'border-[var(--tone-success)] text-[var(--tone-success)] font-semibold'
                        : isWrong
                        ? 'border-[var(--tone-danger)] text-[var(--tone-danger)] font-medium'
                        : isPicked
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--text-primary)] font-semibold'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-inset)]/60 text-[var(--text-secondary)] hover:border-[var(--accent-primary)]'
                    }`}
                  >
                    {tc(opt)}
                  </button>
                );
              })}
            </div>
            {submitted && (
              <div className="rounded-lg bg-[var(--bg-inset)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                <strong className="text-[var(--accent-primary)]">{tc('Explanation:')}</strong> {tc(q.explanation)}
              </div>
            )}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4">
        {submitted ? (
          <p className="text-sm font-semibold text-[var(--text-primary)]" aria-live="polite">
            {t('review.cleared', { count: cleared })} · {t('review.remaining', { count: Object.keys(missed).length })}
          </p>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">
            {Object.keys(answers).length} / {items.length}
          </p>
        )}
        {submitted ? (
          <button
            type="button"
            onClick={again}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--accent-cta)] px-4 text-xs font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-cta-hover)]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t('review.again')}
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={Object.keys(answers).length === 0}
            className="h-9 rounded-lg bg-[var(--accent-cta)] px-4 text-xs font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-cta-hover)] disabled:opacity-40"
          >
            {tc('Check Answers')}
          </button>
        )}
      </div>
    </div>
  );
};
