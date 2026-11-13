import { createRouter, createWebHistory } from 'vue-router'
import { useConnection } from '../stores/connection'
import HomeView from '../views/HomeView.vue'
import ConnectView from '../views/ConnectView.vue'
import DetailView from '../views/DetailView.vue'
import SearchView from '../views/SearchView.vue'
import SettingsView from '../views/SettingsView.vue'
import LibraryView from '../views/LibraryView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/connect', name: 'connect', component: ConnectView },
    { path: '/search', name: 'search', component: SearchView },
    { path: '/library', name: 'library', component: LibraryView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/details/:mediaType/:source/:mediaId', name: 'details', component: DetailView },
  ],
})

router.beforeEach((to) => {
  const { isConnected, connection } = useConnection()
  if (to.name !== 'connect' && !isConnected.value) return { name: 'connect' }
  if (connection.value?.localOnly && (to.name === 'home' || to.name === 'search')) return { name: 'library' }
})

export default router
