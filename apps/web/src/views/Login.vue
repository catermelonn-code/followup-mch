<template>
  <div class="login">
    <div class="card">
      <div class="logo">
        <svg viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="30" fill="#0a4a66" />
          <circle cx="32" cy="32" r="20" fill="none" stroke="#7ee8e0" stroke-width="2.4" />
          <path d="M32 16v32M16 32h32" stroke="#c8fff8" stroke-width="4" stroke-linecap="round" />
        </svg>
      </div>
      <h1>妇幼保健院随访管理系统</h1>
      <el-form @submit.prevent="onSubmit">
        <el-form-item>
          <el-input v-model="username" size="large" placeholder="登录名" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="password" size="large" type="password" show-password placeholder="密码" @keyup.enter="onSubmit" />
        </el-form-item>
        <el-button type="primary" size="large" :loading="loading" style="width:100%" @click="onSubmit">登录</el-button>
      </el-form>
      <div class="hint">
        演示账号（密码均为 admin123）<br />
        admin 系统管理员 · dept01 科室管理员 · nurse01 普通医护
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'

const auth = useAuth()
const router = useRouter()
const route = useRoute()
const username = ref('admin')
const password = ref('admin123')
const loading = ref(false)

async function onSubmit() {
  loading.value = true
  try {
    await auth.login(username.value.trim(), password.value)
    router.push(route.query.redirect || '/dashboard')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login {
  min-height: 100%;
  display: grid;
  place-items: center;
  background:
    radial-gradient(800px 400px at 50% 0%, #12708c 0%, transparent 55%),
    linear-gradient(180deg, #08344f, #041e30);
}
.card {
  width: 420px;
  padding: 36px 32px 28px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(14, 82, 116, 0.75), rgba(8, 40, 62, 0.9));
  border: 1px solid var(--line);
  box-shadow: 0 20px 50px rgba(0,0,0,0.28);
  text-align: center;
}
.logo svg { width: 64px; height: 64px; }
h1 { font-size: 20px; margin: 12px 0 22px; }
.hint { margin-top: 18px; color: var(--muted); font-size: 12px; line-height: 1.7; }
</style>
