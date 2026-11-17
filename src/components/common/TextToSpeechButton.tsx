import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface TextToSpeechButtonProps {
  text: string;
  className?: string;
  title?: string;
}

const LANG_MAP: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  ar: 'ar-SA',
  hi: 'hi-IN',
  ta: 'ta-IN',
  ml: 'ml-IN',
};

export const TextToSpeechButton: React.FC<TextToSpeechButtonProps> = ({
  text,
  className = '',
  title = 'Read caption aloud',
}) => {
  const { language } = useAppStore();
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setSupported(true);
    }
  }, []);

  useEffect(() => {
    // Stop speaking when caption text changes
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }, [text]);

  if (!supported || !text.trim()) return null;

  const handleToggle = () => {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }

    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const targetLang = LANG_MAP[language] || 'en-US';
    utterance.lang = targetLang;
    utterance.rate = 0.95; // Slightly measured pace for technical clarity

    // Try finding a matching native voice for the language
    const voices = synth.getVoices();
    const matchedVoice = voices.find((v) => v.lang.startsWith(targetLang) || v.lang.startsWith(language));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    setSpeaking(true);
    synth.speak(utterance);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={speaking ? 'Stop speech' : title}
      aria-label={speaking ? 'Stop speech' : title}
      className={`inline-flex items-center justify-center rounded-lg p-1 transition-all ${
        speaking
          ? 'bg-[var(--accent-primary)] text-white shadow-xs animate-pulse'
          : 'text-[var(--text-muted)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]'
      } ${className}`}
    >
      {speaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
    </button>
  );
};
