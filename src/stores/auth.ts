import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '')
  const username = ref(localStorage.getItem('username') || '')
  const role = ref(localStorage.getItem('role') || '')

  const isLoggedIn = computed(() => !!token.value)

  async function login(user: string, password: string): Promise<{ success: boolean; message: string }> {
    try {
      const result = await window.api.login(user, password)
      if (result.success) {
        token.value = result.token || ''
        username.value = user
        role.value = result.role || 'user'

        localStorage.setItem('token', token.value)
        localStorage.setItem('username', username.value)
        localStorage.setItem('role', role.value)
      }
      return result
    } catch (error) {
      return { success: false, message: '登录失败，请检查网络连接' }
    }
  }

  function logout() {
    token.value = ''
    username.value = ''
    role.value = ''
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    localStorage.removeItem('role')
  }

  return {
    token,
    username,
    role,
    isLoggedIn,
    login,
    logout
  }
})
