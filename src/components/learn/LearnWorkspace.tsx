import React, { useState } from 'react';
import { Award, BookOpen, Calculator, Flame, Gamepad2, HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';
import { GamesView } from './GamesView';
import { QuizzesView } from './QuizzesView';
import { ToolsAndRefView } from './ToolsAndRefView';

export const LearnWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const { viewedProtocols, completedLabs, quizScores, dailyStreak } = useAppStore();
  const [subTab, setSubTab] = useState<'quizzes' | 'games' | 'tools'>('quizzes');

  const passedQuizzes = Object.values(quizScores).filter((s) => s >= 70).length;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[var(--bg-canvas)]">
      {/* Full-Width Architectural Header Band */}
      <section
        aria-label="Learning Progress Summary"
        className="border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-4 sm:px-6"
      >
        <div className="mx-auto max-w-[1440px] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
                {t('learn.title')}
              </h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {t('learn.subtitle')}
              </p>
            </div>

            {/* Clean Hairline-Divided Tabular Metrics */}
            <div className="flex flex-wrap items-center divide-x divide-[var(--border-hairline)] font-mono text-xs tabular-nums">
              <div className="pe-5">
                <div className="font-sans text-xs font-semibold text-[var(--text-secondary)]">{t('learn.protocolsViewed')}</div>
                <div className="mt-0.5 text-lg font-bold text-[var(--accent-primary)]">{viewedProtocols.length} / 39</div>
              </div>
              <div className="px-5">
                <div className="font-sans text-xs font-semibold text-[var(--text-secondary)]">{t('learn.labsCompleted')}</div>
                <div className="mt-0.5 text-lg font-bold text-[var(--tone-success)]">{completedLabs.length} / 20</div>
              </div>
              <div className="px-5">
                <div className="font-sans text-xs font-semibold text-[var(--text-secondary)]">{t('learn.quizzesPassed')}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-lg font-bold text-[var(--tone-warning)]">
                  <Award className="w-4 h-4" />
                  <span>{passedQuizzes}</span>
                </div>
              </div>
              <div className="ps-5">
                <div className="font-sans text-xs font-semibold text-[var(--text-secondary)]">Daily Streak</div>
                <div className="mt-0.5 flex items-center gap-1 text-lg font-bold text-amber-500">
                  <Flame className="w-4 h-4 fill-amber-500" />
                  <span>{dailyStreak.current}d</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-hairline)] pt-3.5">
            <div className="inline-flex flex-wrap gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-1">
              {[
                { id: 'quizzes', label: t('learn.quizzes'), icon: HelpCircle },
                { id: 'games', label: t('learn.games'), icon: Gamepad2 },
                { id: 'tools', label: t('learn.tools'), icon: Calculator },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSubTab(item.id as typeof subTab)}
                    className={`flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      subTab === item.id
                        ? 'bg-[var(--accent-cta)] text-white shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
              <BookOpen className="w-3.5 h-3.5" />
              <span>{t('learn.savedLocally')}</span>
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6">
        {subTab === 'quizzes' && <QuizzesView />}
        {subTab === 'games' && <GamesView />}
        {subTab === 'tools' && <ToolsAndRefView />}
      </div>
    </div>
  );
};
