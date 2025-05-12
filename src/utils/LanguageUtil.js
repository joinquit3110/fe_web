/**
 * Utility class for language handling
 */
class LanguageUtil {
  /**
   * Gets the best matching language from provided codes
   * @param {Array|string} codes - Language codes to match against (ensures this is always treated as an array)
   * @param {Array} availableLanguages - Available languages to match against
   * @returns {string} Best matching language or default language
   */
  static getBestMatchFromCodes(codes, availableLanguages = ['en']) {
    // Type checking to prevent the "codes.forEach is not a function" error
    if (!codes) {
      console.warn('LanguageUtil: No language codes provided, using default language');
      return availableLanguages[0] || 'en';
    }

    // Handle case where codes is a string (single code)
    if (typeof codes === 'string') {
      codes = [codes];
    }
    
    // Ensure codes is an array
    if (!Array.isArray(codes)) {
      console.warn('LanguageUtil: Expected array of language codes, got:', typeof codes);
      return availableLanguages[0] || 'en';
    }
    
    // Look for exact matches
    for (const code of codes) {
      if (availableLanguages.includes(code)) {
        return code;
      }
      
      // Try matching language part only (e.g., 'en-US' -> 'en')
      const langPart = code.split('-')[0];
      if (availableLanguages.includes(langPart)) {
        return langPart;
      }
    }
    
    // Return default if no match found
    return availableLanguages[0] || 'en';
  }
}

export default LanguageUtil; 