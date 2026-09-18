<template>
  <div class="shell">
    <aside class="side">
      <div class="brand">
        <div class="logo" aria-hidden="true">
          <svg viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="22" fill="#0a4a66" />
            <circle cx="24" cy="24" r="16" fill="none" stroke="#7ee8e0" stroke-width="2.2" />
            <path d="M24 13v22M13 24h22" stroke="#c8fff8" stroke-width="3.2" stroke-linecap="round" />
          </svg>
        </div>
        <div class="brand-text">
          <div class="brand-name">妇幼保健院</div>
          <div class="brand-sub">随访管理系统</div>
        </div>
      </div>
      <nav>
        <router-link to="/dashboard" class="nav-item">
          <span class="ico">⌂</span> 首页看板
        </router-link>
        <router-link to="/tasks" class="nav-item">
          <span class="ico">☰</span> 随访任务
        </router-link>
        <router-link to="/import" class="nav-item">
          <span class="ico">⇩</span> 数据导入
        </router-link>
        <router-link to="/stats" class="nav-item">
          <span class="ico">▣</span> 统计分析
        </router-link>
        <router-link v-if="auth.canManage" to="/system" class="nav-item">
          <span class="ico">⚙</span> 系统管理
        </router-link>
      </nav>
    </aside>
    <div class="main">
      <header class="top">
        <div class="top-title">妇幼保健院随访管理系统</div>
        <div class="top-right">
          <button class="icon-btn" title="首页" @click="$router.push('/dashboard')">⌂</button>
          <button class="icon-btn" title="导入记录" @click="$router.push('/system')">▤</button>
          <el-popover placement="bottom-end" :width="280" trigger="click">
            <template #reference>
              <button class="icon-btn bell">
                🔔
                <i v-if="badge" class="dot">{{ badge > 99 ? '99+' : badge }}</i>
              </button>
            </template>
            <div class="note-pop">
              <div class="note-h">待办提醒</div>
              <div v-if="!notes.length" class="muted">暂无待办</div>
              <div v-for="n in notes" :key="n.type" class="note-row" @click="$router.push('/tasks?status=today')">
                <span>{{ n.type }}</span>
                <b>{{ n.count }} 条</b>
              </div>
              <div class="note-foot">逾期 {{ overdue }} 条 · 今日待随访 {{ dueToday }} 条</div>
            </div>
          </el-popover>
          <div class="clock">{{ clock }}</div>
          <el-dropdown>
            <span class="who">
              {{ auth.user?.name }}
              <small>{{ auth.roleLabel }}</small>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="pwdOpen = true">修改密码</el-dropdown-item>
                <el-dropdown-item @click="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>
      <section class="content">
        <router-view />
      </section>
    </div>

    <el-dialog v-model="pwdOpen" title="修改密码" width="420px">
      <el-form label-width="88px">
        <el-form-item label="原密码"><el-input v-model="pwd.oldPassword" type="password" show-password /></el-form-item>
        <el-form-item label="新密码"><el-input v-model="pwd.newPassword" type="password" show-password /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdOpen = false">取消</el-button>
        <el-button type="primary" :loading="pwdLoading" @click="changePwd">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import http from '../api/http'
import { useAuth } from '../stores/auth'

const auth = useAuth()
const router = useRouter()
const clock = ref('')
let timer
function tick() {
  const d = new Date()
  clock.value = d.toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 5)
}
tick()
timer = setInterval(tick, 1000)
onUnmounted(() => clearInterval(timer))

const badge = computed(() => auth.user?.notifications?.badge || 0)
const notes = computed(() => auth.user?.notifications?.byType || [])
const overdue = computed(() => auth.user?.notifications?.overdue || 0)
const dueToday = computed(() => auth.user?.notifications?.dueToday || 0)

onMounted(() => {
  auth.refreshMe().catch(() => {})
})

function logout() {
  auth.logout()
  router.push('/login')
}

const pwdOpen = ref(false)
const pwdLoading = ref(false)
const pwd = reactive({ oldPassword: '', newPassword: '' })
async function changePwd() {
  pwdLoading.value = true
  try {
    await http.post('/auth/change-password', pwd)
    ElMessage.success('密码已更新')
    pwdOpen.value = false
    pwd.oldPassword = ''
    pwd.newPassword = ''
  } finally {
    pwdLoading.value = false
  }
}
</script>

<style scoped>
.shell { display: flex; height: 100%; min-height: 100vh; }
.side {
  width: 210px;
  background: linear-gradient(180deg, #06324b, #041f32);
  padding: 18px 12px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  border-right: 1px solid var(--line);
}
.brand { display: flex; gap: 10px; align-items: center; padding: 4px 8px 12px; }
.logo svg { width: 42px; height: 42px; display: block; }
.brand-name { font-weight: 800; font-size: 15px; letter-spacing: 0.5px; }
.brand-sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border-radius: 10px;
  color: #c5e6f0;
  margin-bottom: 6px;
  font-size: 14px;
}
.nav-item:hover { background: rgba(42, 212, 208, 0.08); }
.nav-item.router-link-active {
  background: linear-gradient(90deg, #1ec8c8, #14a8b8);
  color: #fff;
  font-weight: 700;
  box-shadow: 0 6px 16px rgba(20, 168, 184, 0.35);
}
.ico { width: 18px; text-align: center; opacity: 0.95; }
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.top {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 22px;
  background: linear-gradient(90deg, #0a4a6a, #0c5a78);
  border-bottom: 1px solid var(--line);
}
.top-title { font-size: 20px; font-weight: 800; letter-spacing: 1px; }
.top-right { display: flex; align-items: center; gap: 12px; }
.icon-btn {
  width: 34px; height: 34px; border: 0; border-radius: 8px;
  background: rgba(255,255,255,0.06); color: #dff6ff; cursor: pointer; position: relative;
}
.bell .dot {
  position: absolute; top: -4px; right: -4px;
  background: #ff4d62; color: #fff; font-style: normal;
  font-size: 10px; min-width: 16px; height: 16px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center; padding: 0 3px;
}
.clock { color: var(--muted); font-variant-numeric: tabular-nums; min-width: 48px; }
.who { cursor: pointer; display: flex; flex-direction: column; line-height: 1.2; font-weight: 600; }
.who small { color: var(--muted); font-weight: 400; }
.content { flex: 1; overflow: auto; padding: 18px 20px 24px; }
.note-h { font-weight: 700; margin-bottom: 8px; }
.note-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--line); cursor: pointer; }
.note-foot { margin-top: 8px; color: var(--muted); font-size: 12px; }
.muted { color: var(--muted); }
</style>
