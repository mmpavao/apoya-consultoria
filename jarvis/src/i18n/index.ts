import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ptBR } from './pt-BR';
import { enUS } from './en-US';

// PT-BR default, EN-US prepared (PRD §4.1 i18n, §8). All strings externalised.
void i18next.use(initReactI18next).init({
  resources: {
    'pt-BR': { translation: ptBR },
    'en-US': { translation: enUS },
  },
  lng: 'pt-BR',
  fallbackLng: 'en-US',
  interpolation: { escapeValue: false },
});

export default i18next;
