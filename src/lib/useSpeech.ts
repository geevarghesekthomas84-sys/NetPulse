import { useCallback, useEffect, useState } from 'react';

const BCP47: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  ar: 'ar-SA',
  hi: 'hi-IN',
  ml: 'ml-IN',
  ta: 'ta-IN',
};

export const speechSupported = (): boolean =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

/** True if the device has a voice for this app language (otherwise the browser would read it in the wrong accent). */
export function hasVoiceFor(lang: string): boolean {
  if (!speechSupported()) return false;
  const base = (BCP47[lang] ?? lang).split('-')[0].toLowerCase();
  return window.speechSynthesis.getVoices().some((v) => v.lang.toLowerCase().startsWith(base));
}

/** Browser text-to-speech. Speech stops on unmount, and callers cancel it when the text changes. */
export function useSpeech(lang: string) {
  const supported = speechSupported();
  const [speaking, setSpeaking] = useState(false);
  const [voiceOk, setVoiceOk] = useState(true);

  useEffect(() => {
    if (!supported) return;
    const update = () => setVoiceOk(hasVoiceFor(lang));
    update();
    // Voices load asynchronously in most browsers.
    window.speechSynthesis.addEventListener?.('voiceschanged', update);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', update);
  }, [lang, supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text.trim()) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = BCP47[lang] ?? lang;
      u.rate = 0.95;
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(u);
    },
    [lang, supported],
  );

  useEffect(() => () => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  return { supported, speaking, voiceOk, speak, stop };
}
