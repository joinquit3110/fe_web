import LanguageUtil from './LanguageUtil';

// Default language settings
const DEFAULT_LANGUAGE = 'en';
const AVAILABLE_LANGUAGES = ['en']; // Add more languages as they become available

/**
 * Initialize the internationalization settings
 * @returns {Object} i18n configuration object
 */
const setupI18n = () => {
  try {
    // Get browser languages
    const browserLanguages = navigator.languages || 
                            [navigator.language || 
                             navigator.userLanguage || 
                             DEFAULT_LANGUAGE];
    
    // Get best match from browser languages
    const detectedLanguage = LanguageUtil.getBestMatchFromCodes(
      browserLanguages,
      AVAILABLE_LANGUAGES
    );
    
    return {
      language: detectedLanguage,
      availableLanguages: AVAILABLE_LANGUAGES,
      defaultLanguage: DEFAULT_LANGUAGE,
      
      // Function to change language
      changeLanguage: (lang) => {
        if (!lang) return false;
        
        // Ensure language code is valid
        const validLang = LanguageUtil.getBestMatchFromCodes(
          lang,
          AVAILABLE_LANGUAGES
        );
        
        // Store in localStorage for persistence
        localStorage.setItem('preferredLanguage', validLang);
        
        return validLang;
      },
      
      // Get user's preferred language or browser language
      getPreferredLanguage: () => {
        const storedLang = localStorage.getItem('preferredLanguage');
        if (storedLang && AVAILABLE_LANGUAGES.includes(storedLang)) {
          return storedLang;
        }
        
        return detectedLanguage;
      }
    };
  } catch (error) {
    console.error('Error setting up i18n:', error);
    
    // Return default configuration on error
    return {
      language: DEFAULT_LANGUAGE,
      availableLanguages: AVAILABLE_LANGUAGES,
      defaultLanguage: DEFAULT_LANGUAGE,
      changeLanguage: () => DEFAULT_LANGUAGE,
      getPreferredLanguage: () => DEFAULT_LANGUAGE
    };
  }
};

// Create and export the i18n instance
const i18n = setupI18n();
export default i18n; 