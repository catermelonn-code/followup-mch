import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../stores/auth'

const routes = [
  { path: '/login', component: () => import('../views/Login.vue') },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', component: () => import('../views/Dashboard.vue') },
      { path: 'tasks', component: () => import('../views/Tasks.vue') },
      { path: 'import', component: () => import('../views/Import.vue') },
      { path: 'stats', component: () => import('../views/Stats.vue') },
      { path: 'system', component: () => import('../views/System.vue') },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const token = localStorage.getItem('token')
  if (to.path === '/login') {
    if (token) return '/dashboard'
    return true
  }
  if (!token) return { path: '/login', query: { redirect: to.fullPath } }
  const auth = useAuth()
  if (!auth.user) {
    try {
      await auth.refreshMe()
    } catch {
      auth.logout()
      return '/login'
    }
  }
  if (to.path === '/system' && !['sys_admin', 'dept_admin'].includes(auth.user?.role)) {
    return '/dashboard'
  }
  return true
})

export default router
