/**
 * Language management utilities
 */

const LANGUAGE_STORAGE_KEY = 'hoosat_language';

export type SupportedLanguage = 'auto' | 'en' | 'ru' | 'zh_CN' | 'es' | 'fi' | 'ja' | 'ko' | 'tr' | 'de' | 'bg';

export interface LanguageOption {
  code: SupportedLanguage;
  nameKey: string; // i18n key for language name
  nativeName: string; // Native name displayed in dropdown
}

export const AVAILABLE_LANGUAGES: LanguageOption[] = [
  { code: 'auto', nameKey: 'languageAuto', nativeName: 'Auto (Browser Default)' },
  { code: 'en', nameKey: 'languageEnglish', nativeName: 'English' },
  { code: 'ru', nameKey: 'languageRussian', nativeName: 'Русский' },
  { code: 'zh_CN', nameKey: 'languageChinese', nativeName: '简体中文' },
  { code: 'es', nameKey: 'languageSpanish', nativeName: 'Español' },
  { code: 'fi', nameKey: 'languageFinnish', nativeName: 'Suomi' },
  { code: 'ja', nameKey: 'languageJapanese', nativeName: '日本語' },
  { code: 'ko', nameKey: 'languageKorean', nativeName: '한국어' },
  { code: 'tr', nameKey: 'languageTurkish', nativeName: 'Türkçe' },
  { code: 'de', nameKey: 'languageGerman', nativeName: 'Deutsch' },
  { code: 'bg', nameKey: 'languageBulgarian', nativeName: 'Български' },
];

/**
 * Get currently selected language from storage
 * @returns Selected language code or 'auto'
 */
export async function getSelectedLanguage(): Promise<SupportedLanguage> {
  try {
    const result = await chrome.storage.local.get(LANGUAGE_STORAGE_KEY);
    return (result[LANGUAGE_STORAGE_KEY] as SupportedLanguage) || 'auto';
  } catch (error) {
    console.error('Failed to load language preference:', error);
    return 'auto';
  }
}

/**
 * Save language preference to storage
 * @param language - Language code to save
 */
export async function saveLanguage(language: SupportedLanguage): Promise<void> {
  try {
    await chrome.storage.local.set({ [LANGUAGE_STORAGE_KEY]: language });
  } catch (error) {
    console.error('Failed to save language preference:', error);
    throw error;
  }
}

/**
 * Get effective language (resolves 'auto' to browser language)
 * @param selectedLanguage - Selected language from settings
 * @returns Actual language code to use
 */
export function getEffectiveLanguage(selectedLanguage: SupportedLanguage): string {
  if (selectedLanguage === 'auto') {
    // Use browser's UI language
    const browserLang = chrome.i18n.getUILanguage();

    // Map browser language to our supported languages
    if (browserLang.startsWith('ru')) return 'ru';
    if (browserLang.startsWith('zh')) return 'zh_CN';
    if (browserLang.startsWith('es')) return 'es';
    if (browserLang.startsWith('fi')) return 'fi';
    if (browserLang.startsWith('ja')) return 'ja';
    if (browserLang.startsWith('ko')) return 'ko';
    if (browserLang.startsWith('tr')) return 'tr';
    if (browserLang.startsWith('de')) return 'de';
    if (browserLang.startsWith('bg')) return 'bg';
    return 'en'; // Default fallback
  }

  return selectedLanguage;
}
