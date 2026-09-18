import { defineStore } from 'pinia'
import http from '../api/http'

export const useAuth = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    user: JSON.parse(localStorage.getItem('user') || 'null'),
  }),
  getters: {
    isAdmin: (s) => s.user?.role === 'sys_admin',
    canManage: (s) => s.user?.role === 'sys_admin' || s.user?.role === 'dept_admin',
    roleLabel: (s) =>
      ({ nurse: '普通医护', dept_admin: '科室管理员', sys_admin: '系统管理员' }[s.user?.role] || ''),
  },
  actions: {
    async login(username, password) {
      const data = await http.post('/auth/login', { username, password })
      this.token = data.token
      this.user = data.user
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      return data.user
    },
    async refreshMe() {
      if (!this.token) return null
      const user = await http.get('/auth/me')
      this.user = user
      localStorage.setItem('user', JSON.stringify(user))
      return user
    },
    logout() {
      this.token = ''
      this.user = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    },
  },
})
