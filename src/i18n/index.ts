import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './ar.json';
import en from './en.json';
import es from './es.json';
import hi from './hi.json';
import ml from './ml.json';
import ta from './ta.json';

export const LANGUAGES = [
  { code: 'en', label: 'EN', name: 'English', dir: 'ltr' as const },
  { code: 'hi', label: 'HI', name: 'हिन्दी', dir: 'ltr' as const },
  { code: 'ml', label: 'ML', name: 'മലയാളം', dir: 'ltr' as const },
  { code: 'ta', label: 'TA', name: 'தமிழ்', dir: 'ltr' as const },
  { code: 'es', label: 'ES', name: 'Español', dir: 'ltr' as const },
  { code: 'ar', label: 'AR', name: 'العربية', dir: 'rtl' as const },
];

const savedLang = typeof window !== 'undefined' ? localStorage.getItem('gg-lang') || 'en' : 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    ml: { translation: ml },
    ta: { translation: ta },
    es: { translation: es },
    ar: { translation: ar },
  },
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
