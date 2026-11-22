import React, { useState } from 'react';
import { Award, BookOpen, Calculator, Flame, Gamepad2, HelpCircle, RefreshCw, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';
import { ChallengesView } from './ChallengesView';
import { ReviewView } from './ReviewView';
import { activeStreak, dayKey } from '../../lib/streak';
import { GamesView } from './GamesView';
import { QuizzesView } from './QuizzesView';
import { ToolsAndRefView } from './ToolsAndRefView';
import { tc } from '../../i18n/content';
import { PROTOCOLS } from '../../protocols';
import { PRESET_LABS } from '../../simulator/labs';

export const LearnWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const { viewedProtocols, completedLabs, quizScores, streak, missed } = useAppStore();
  const [subTab, setSubTab] = useState<'quizzes' | 'review' | 'games' | 'challenges' | 'tools'>('quizzes');

  const passedQuizzes = Object.values(quizScores).filter((s) => s >= 70).length;
  const stats = [
    { label: t('learn.protocolsViewed'), value: viewedProtocols.length, of: PROTOCOLS.length, icon: BookOpen, color: 'var(--accent-primary)' },
    { label: t('learn.labsCompleted'), value: completedLabs.length, of: PRESET_LABS.length, icon: Wrench, color: 'var(--tone-success)' },
    { label: t('streak.metric'), value: activeStreak(streak, dayKey()), of: undefined as number | undefined, note: t('streak.best', { count: streak.best }), icon: Flame, color: 'var(--accent-primary)' },
    { label: t('learn.quizzesPassed'), value: passedQuizzes, of: PROTOCOLS.length, icon: Award, color: 'var(--tone-warning)' },
  ];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[var(--bg-canvas)]">
      {/* Header: title, progress cards, and the section tabs */}
      <section aria-label={tc('Learning Progress Summary')} className="border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]">
        <div className="mx-auto max-w-[1440px] px-4 pt-6 sm:px-6">
          <h1 className="hud-title text-xl leading-snug tracking-[0.1em] text-[var(--text-primary)] sm:text-2xl sm:tracking-[0.14em]">{t('learn.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">{t('learn.subtitle')}</p>

          <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((st) => (
              <div key={st.label} className="hud-panel p-4">
                <dt className="hud-title flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                  <st.icon className="h-3.5 w-3.5" style={{ color: st.color }} aria-hidden="true" />
                  {st.label}
                </dt>
                <dd className="mt-2">
                  <span className="font-mono text-3xl font-extrabold tabular-nums leading-none" style={{ color: st.color }}>
                    {st.value}
                  </span>
                  {st.of !== undefined && <span className="ms-1.5 font-mono text-sm text-[var(--text-muted)]">/ {st.of}</span>}
                  {st.note && <span className="ms-2 text-xs text-[var(--text-muted)]">{st.note}</span>}
                  {st.of !== undefined && (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--bg-inset)]" role="progressbar" aria-valuenow={st.value} aria-valuemin={0} aria-valuemax={st.of}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (st.value / st.of) * 100)}%`, backgroundColor: st.color }} />
                    </div>
                  )}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 flex items-end justify-between gap-3">
            <div role="tablist" aria-label={t('learn.title')} className="flex min-w-0 gap-1 overflow-x-auto">
              {[
                { id: 'quizzes', label: t('learn.quizzes'), icon: HelpCircle },
                { id: 'review', label: `${t('review.tab')}${Object.keys(missed).length ? ` (${Object.keys(missed).length})` : ''}`, icon: RefreshCw },
                { id: 'games', label: t('learn.games'), icon: Gamepad2 },
                { id: 'challenges', label: t('challenge.tab'), icon: Wrench },
                { id: 'tools', label: t('learn.tools'), icon: Calculator },
              ].map((item) => {
                const Icon = item.icon;
                const active = subTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSubTab(item.id as typeof subTab)}
                    className={`-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                      active
                        ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
            <span className="mb-3 hidden shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-[var(--text-muted)] 2xl:inline-flex">
              <BookOpen className="h-3.5 w-3.5" />
              {t('learn.savedLocally')}
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6">
        {subTab === 'quizzes' && <QuizzesView />}
        {subTab === 'review' && <ReviewView />}
        {subTab === 'games' && <GamesView />}
        {subTab === 'challenges' && <ChallengesView />}
        {subTab === 'tools' && <ToolsAndRefView />}
      </div>
    </div>
  );
};
