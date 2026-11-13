import { createApp } from 'vue'
import { Locale } from 'vant'
import enUS from 'vant/es/locale/lang/en-US'
import frFR from 'vant/es/locale/lang/fr-FR'
import App from './App.vue'
import router from './router'
import './style.css'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    })
  })
}

// Vant: dark theme (the whole app is dark) and the browser's language (en/fr available).
document.documentElement.classList.add('van-theme-dark')
Locale.use(navigator.language.startsWith('fr') ? 'fr-FR' : 'en-US', navigator.language.startsWith('fr') ? frFR : enUS)

createApp(App).use(router).mount('#app')
