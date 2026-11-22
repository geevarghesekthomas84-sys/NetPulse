import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Lightbulb, Play, RotateCcw, Star, Wrench, X, Zap } from 'lucide-react';
import { SimulationEngine } from '../../engine/simulator';
import { tc } from '../../i18n/content';
import { type Challenge, CHALLENGES, computeScore, starsForScore } from '../../simulator/challenges';
import { useAppStore } from '../../store/useAppStore';

interface LogEntry {
  deviceName: string;
  cmd: string;
  out: string;
}

const Stars: React.FC<{ n: number; size?: string }> = ({ n, size = 'w-4 h-4' }) => (
  <span className="inline-flex gap-0.5" aria-label={`${n}/3`}>
    {[1, 2, 3].map((i) => (
      <Star
        key={i}
        className={`${size} ${i <= n ? 'fill-[var(--tone-warning)] text-[var(--tone-warning)]' : 'text-[var(--border-strong)]'}`}
      />
    ))}
  </span>
);

const ChallengeRunner: React.FC<{ challenge: Challenge; onExit: () => void; onNext: (() => void) | null }> = ({
  challenge,
  onExit,
  onNext,
}) => {
  const { t } = useTranslation();
  const { challengeBest, recordChallenge } = useAppStore();
  const topo = useMemo(() => challenge.build(false), [challenge]);
  const engineRef = useRef<SimulationEngine>(
    new SimulationEngine({ seed: 42, devices: topo.devices, links: topo.links })
  );

  const [deviceId, setDeviceId] = useState(challenge.suggested[0]?.deviceId ?? topo.devices[0].id);
  const [cmd, setCmd] = useState('');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [tools, setTools] = useState(0);
  const [inspect, setInspect] = useState(false);
  const [wrong, setWrong] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [lastWrong, setLastWrong] = useState(false);
  const [diagnosed, setDiagnosed] = useState(false);
  const [result, setResult] = useState<{ score: number; output: string } | null>(null);

  const score = computeScore({ tools, wrongGuesses: wrong, hints: hintsUsed });
  const nameOf = (id: string) => topo.devices.find((d) => d.id === id)?.name ?? id;

  const run = (dev: string, command: string) => {
    const text = command.trim();
    if (!text || result) return;
    const out = engineRef.current.execCommand(dev, text);
    setLog((l) => [...l, { deviceName: nameOf(dev), cmd: text, out }]);
    setTools((n) => n + 1);
  };

  const submitDiagnosis = () => {
    if (picked === null) return;
    if (challenge.options[picked].correct) {
      setDiagnosed(true);
      setLastWrong(false);
    } else {
      setWrong((n) => n + 1);
      setLastWrong(true);
    }
  };

  const applyFix = () => {
    const fixed = challenge.build(true);
    const engine = new SimulationEngine({ seed: 42, devices: fixed.devices, links: fixed.links });
    const output = engine.execCommand(challenge.test.deviceId, challenge.test.cmd);
    const finalScore = computeScore({ tools, wrongGuesses: wrong, hints: hintsUsed });
    recordChallenge(challenge.id, finalScore);
    setResult({ score: finalScore, output });
  };

  const engine = engineRef.current;
  const best = challengeBest[challenge.id];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1.5 rounded-full border border-[var(--border-hairline)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          {t('challenge.back')}
        </button>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-[var(--text-secondary)]">{t('challenge.score')}</span>
          <span className="rounded-full bg-[var(--accent-primary-soft)] px-3 py-1 font-bold tabular-nums text-[var(--accent-primary)]" aria-live="polite">
            {result ? result.score : score}
          </span>
          {best !== undefined && (
            <span className="text-xs text-[var(--text-muted)]">{t('challenge.best', { score: best })}</span>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--tone-danger)]">
          <Zap className="w-3.5 h-3.5" aria-hidden="true" />
          {t('challenge.ticket')}
        </div>
        <h2 className="mt-1 font-display text-lg font-bold text-[var(--text-primary)]">{tc(challenge.title)}</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{tc(challenge.symptom)}</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 1. Investigate */}
        <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('challenge.investigate')}</h3>

          <div className="mt-2 flex flex-wrap gap-1.5" aria-label={t('challenge.quick')}>
            {challenge.suggested.map((s) => (
              <button
                key={`${s.deviceId}-${s.cmd}`}
                type="button"
                disabled={!!result}
                onClick={() => {
                  setDeviceId(s.deviceId);
                  run(s.deviceId, s.cmd);
                }}
                className="rounded-full border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 py-1 font-mono text-xs text-[var(--text-primary)] hover:border-[var(--accent-primary)] disabled:opacity-50"
                dir="ltr"
              >
                {nameOf(s.deviceId)}: {s.cmd}
              </button>
            ))}
            <button
              type="button"
              disabled={!!result}
              onClick={() => {
                setInspect(true);
                setTools((n) => n + 1);
              }}
              className="rounded-full border border-[var(--accent-primary)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-primary-soft)] disabled:opacity-50"
            >
              {t('challenge.inspect')}
            </button>
          </div>

          <form
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(deviceId, cmd);
              setCmd('');
            }}
          >
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              aria-label={t('challenge.device')}
              className="h-9 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 text-sm text-[var(--text-primary)]"
            >
              {topo.devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <input
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              placeholder={t('challenge.runPlaceholder')}
              aria-label={t('challenge.runPlaceholder')}
              dir="ltr"
              className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 font-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!!result}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--accent-cta)] px-3 text-sm font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-cta-hover)] disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              {t('challenge.run')}
            </button>
          </form>

          {inspect && (
            <div className="mt-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3 text-sm">
              <div className="grid gap-1.5 sm:grid-cols-2">
                {[...engine.devices.values()].map((d) => (
                  <div key={d.id} className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${d.poweredOn ? 'bg-[var(--tone-success)]' : 'bg-[var(--tone-danger)]'}`}
                      aria-hidden="true"
                    />
                    <span className="text-[var(--text-primary)]">{d.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {t('challenge.power')} {d.poweredOn ? t('challenge.on') : t('challenge.off')}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2 space-y-1.5 border-t border-[var(--border-hairline)] pt-2">
                {[...engine.links.values()].map((l) => (
                  <div key={l.id} className="flex flex-wrap items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${l.up ? 'bg-[var(--tone-success)]' : 'bg-[var(--tone-danger)]'}`}
                      aria-hidden="true"
                    />
                    <span className="text-[var(--text-primary)]">
                      {nameOf(l.sourceId)} ↔ {nameOf(l.targetId)}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {t('challenge.link')} {l.up ? t('challenge.up') : t('challenge.down')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-xl bg-[var(--terminal-bg)] p-3" aria-live="polite">
            {log.length === 0 && <p className="text-xs text-[var(--terminal-muted)]">{t('challenge.emptyLog')}</p>}
            {log.map((e, i) => (
              <div key={i} dir="ltr">
                <div className="font-mono text-xs font-semibold text-[var(--terminal-cmd)]">
                  {e.deviceName}$ {e.cmd}
                </div>
                <pre className="whitespace-pre-wrap break-words font-mono text-xs text-[var(--terminal-text)]">{e.out}</pre>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-[var(--text-muted)]">{t('challenge.stepsUsed', { count: tools })}</p>
        </section>

        {/* 2 + 3. Diagnose and fix */}
        <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('challenge.diagnose')}</h3>
          <fieldset className="mt-2 space-y-1.5" disabled={diagnosed}>
            {challenge.options.map((o, i) => {
              const isPicked = picked === i;
              const showRight = diagnosed && o.correct;
              return (
                <label
                  key={i}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors ${
                    showRight
                      ? 'border-[var(--tone-success)] bg-[var(--bg-inset)] text-[var(--text-primary)]'
                      : isPicked
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--text-primary)]'
                      : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]'
                  }`}
                >
                  <input
                    type="radio"
                    name={`diag-${challenge.id}`}
                    checked={isPicked}
                    onChange={() => {
                      setPicked(i);
                      setLastWrong(false);
                    }}
                    className="mt-1 accent-[var(--accent-cta)]"
                  />
                  <span>{tc(o.text)}</span>
                  {showRight && <Check className="ms-auto mt-0.5 h-4 w-4 shrink-0 text-[var(--tone-success)]" />}
                </label>
              );
            })}
          </fieldset>

          {!diagnosed && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={submitDiagnosis}
                disabled={picked === null}
                className="rounded-full bg-[var(--accent-cta)] px-4 py-1.5 text-sm font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-cta-hover)] disabled:opacity-50"
              >
                {t('challenge.submit')}
              </button>
              <button
                type="button"
                disabled={hintsUsed >= 2}
                onClick={() => setHintsUsed((n) => n + 1)}
                className="flex items-center gap-1.5 rounded-full border border-[var(--border-hairline)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--tone-warning)] disabled:opacity-50"
              >
                <Lightbulb className="w-3.5 h-3.5 text-[var(--tone-warning)]" />
                {t('challenge.hint', { left: 2 - hintsUsed })}
              </button>
              {lastWrong && (
                <span role="alert" className="flex items-center gap-1 text-sm font-medium text-[var(--tone-danger)]">
                  <X className="w-4 h-4" />
                  {t('challenge.wrong')}
                </span>
              )}
            </div>
          )}

          {hintsUsed > 0 && !diagnosed && (
            <ul className="mt-3 space-y-1.5">
              {challenge.hints.slice(0, hintsUsed).map((h, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-lg bg-[var(--bg-inset)] px-3 py-2 text-sm text-[var(--text-secondary)]"
                >
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--tone-warning)]" />
                  {tc(h)}
                </li>
              ))}
            </ul>
          )}

          {diagnosed && (
            <div className="mt-4">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('challenge.fix')}</h3>
              {!result && (
                <button
                  type="button"
                  onClick={applyFix}
                  className="mt-2 flex items-center gap-2 rounded-full bg-[var(--tone-success)] px-4 py-2 text-sm font-semibold text-[var(--bg-surface)] hover:opacity-90"
                >
                  <Wrench className="w-4 h-4" />
                  {t('challenge.apply', { what: tc(challenge.fixLabel) })}
                </button>
              )}
            </div>
          )}

          {result && (
            <div className="mt-4 space-y-3 rounded-xl border border-[var(--tone-success)] bg-[var(--bg-inset)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-display text-base font-bold text-[var(--text-primary)]">
                  <Check className="w-5 h-5 text-[var(--tone-success)]" />
                  {t('challenge.solved')}
                </h3>
                <div className="flex items-center gap-2">
                  <Stars n={starsForScore(result.score)} />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {t('challenge.finalScore', { score: result.score })}
                  </span>
                </div>
              </div>
              <pre dir="ltr" className="whitespace-pre-wrap break-words rounded-lg bg-[var(--terminal-bg)] p-2 font-mono text-xs text-[var(--terminal-text)]">
                {nameOf(challenge.test.deviceId)}$ {challenge.test.cmd}
                {'\n'}
                {result.output}
              </pre>
              <div>
                <div className="text-xs font-semibold text-[var(--accent-primary)]">{t('challenge.lesson')}</div>
                <p className="mt-0.5 text-sm leading-relaxed text-[var(--text-secondary)]">{tc(challenge.lesson)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {onNext && (
                  <button
                    type="button"
                    onClick={onNext}
                    className="rounded-full bg-[var(--accent-cta)] px-4 py-1.5 text-sm font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-cta-hover)]"
                  >
                    {t('challenge.next')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onExit}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--border-hairline)] px-4 py-1.5 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t('challenge.back')}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export const ChallengesView: React.FC = () => {
  const { t } = useTranslation();
  const { challengeBest } = useAppStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(0);

  const idx = CHALLENGES.findIndex((c) => c.id === activeId);
  if (idx >= 0) {
    const next = idx < CHALLENGES.length - 1 ? () => { setActiveId(CHALLENGES[idx + 1].id); setRunKey((k) => k + 1); } : null;
    return <ChallengeRunner key={`${activeId}-${runKey}`} challenge={CHALLENGES[idx]} onExit={() => setActiveId(null)} onNext={next} />;
  }

  const done = CHALLENGES.filter((c) => challengeBest[c.id] !== undefined).length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">{t('challenge.title')}</h2>
        <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{t('challenge.intro')}</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{t('challenge.progress', { done, total: CHALLENGES.length })}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CHALLENGES.map((c) => {
          const best = challengeBest[c.id];
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setActiveId(c.id);
                setRunKey((k) => k + 1);
              }}
              className="flex flex-col gap-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 text-start transition-colors hover:border-[var(--accent-primary)]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-[var(--accent-primary-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--accent-primary)]">
                  {t(`challenge.level${c.difficulty}`)}
                </span>
                {best !== undefined ? <Stars n={starsForScore(best)} /> : <Stars n={0} />}
              </div>
              <span className="font-display text-base font-bold text-[var(--text-primary)]">{tc(c.title)}</span>
              <span className="text-sm leading-snug text-[var(--text-secondary)]">{tc(c.symptom)}</span>
              <span className="mt-auto text-xs font-semibold text-[var(--accent-primary)]">
                {best !== undefined ? t('challenge.best', { score: best }) : t('challenge.start')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
