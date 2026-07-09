type Translations = {
  [key: string]: {
    [lang: string]: string;
  };
};

export const i18n: Translations = {
  // Common UI
  appName: {
    en: 'AEGIS',
    es: 'AEGIS',
    fr: 'AEGIS',
  },
  tagline: {
    en: 'Stadium Intelligence',
    es: 'Inteligencia de Estadio',
    fr: 'Intelligence de Stade',
  },
  language: {
    en: 'Language',
    es: 'Idioma',
    fr: 'Langue',
  },
  highVisibility: {
    en: 'High-visibility mode',
    es: 'Modo alto contraste',
    fr: 'Mode haute visibilité',
  },

  // Roles
  role_fan: { en: '🎫 Fan', es: '🎫 Aficionado', fr: '🎫 Supporter' },
  role_volunteer: { en: '🙋 Volunteer', es: '🙋 Voluntario', fr: '🙋 Bénévole' },
  role_security: { en: '🛡️ Security', es: '🛡️ Seguridad', fr: '🛡️ Sécurité' },
  role_medical: { en: '🏥 Medical', es: '🏥 Médico', fr: '🏥 Médical' },
  role_organizer: { en: '📋 Organizer', es: '📋 Organizador', fr: '📋 Organisateur' },
  role_venue_operations: { en: '🏟️ Venue Ops', es: '🏟️ Ops Estadio', fr: '🏟️ Ops Stade' },
  role_accessibility_coordinator: { en: '♿ Accessibility', es: '♿ Accesibilidad', fr: '♿ Accessibilité' },
  role_transportation_coordinator: { en: '🚌 Transport', es: '🚌 Transporte', fr: '🚌 Transport' },

  // Chat UI
  assistantGreeting: {
    en: 'Hello. I am the AEGIS Operational Intelligence Assistant. How can I help you today?',
    es: 'Hola. Soy el asistente AEGIS. ¿Cómo puedo ayudarle hoy?',
    fr: 'Bonjour. Je suis l\'assistant AEGIS. Comment puis-je vous aider aujourd\'hui?',
  },
  askPlaceholder: {
    en: 'Ask AEGIS...',
    es: 'Preguntar a AEGIS...',
    fr: 'Demander à AEGIS...',
  },
  processing: {
    en: 'Analyzing...',
    es: 'Analizando...',
    fr: 'Analyse en cours...',
  },
  error: {
    en: 'Error: Could not process request.',
    es: 'Error: No se pudo procesar la solicitud.',
    fr: 'Erreur: Impossible de traiter la demande.',
  },

  // Fan UI
  fanWelcome: {
    en: 'Welcome to MetLife Stadium',
    es: 'Bienvenido al MetLife Stadium',
    fr: 'Bienvenue au MetLife Stadium',
  },
  fanSubtitle: {
    en: 'FIFA World Cup 2026',
    es: 'Copa Mundial de la FIFA 2026',
    fr: 'Coupe du Monde de la FIFA 2026',
  },
  accessibilityNeeds: {
    en: 'Accessibility needs',
    es: 'Necesidades de accesibilidad',
    fr: 'Besoins d\'accessibilité',
  },
  needWheelchair: {
    en: 'Wheelchair / step-free',
    es: 'Silla de ruedas / sin escalones',
    fr: 'Fauteuil roulant / sans marches',
  },
  needVisual: {
    en: 'Low vision / screen reader',
    es: 'Baja visión / lector de pantalla',
    fr: 'Basse vision / lecteur d\'écran',
  },
  whereGo: {
    en: 'Where do you want to go?',
    es: '¿A dónde quiere ir?',
    fr: 'Où souhaitez-vous aller ?',
  }
};

export function t(key: string, lang: string = 'en'): string {
  if (!i18n[key]) return key;
  return i18n[key][lang] || i18n[key]['en'] || key;
}
