import { createRouter, createWebHistory } from 'vue-router'
import { useConnection } from '../stores/connection'
import HomeView from '../views/HomeView.vue'
import ConnectView from '../views/ConnectView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/connect', name: 'connect', component: ConnectView },
  ],
})

router.beforeEach((to) => {
  const { isConnected } = useConnection()
  if (to.name === 'home' && !isConnected.value) return { name: 'connect' }
})

export default router
