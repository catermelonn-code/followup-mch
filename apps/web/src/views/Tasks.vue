<template>
  <div class="page-panel">
    <h2 class="page-title">随访任务</h2>
    <div class="filter-row">
      <el-radio-group v-model="q.status" @change="load(1)">
        <el-radio-button value="today">今日待办</el-radio-button>
        <el-radio-button value="todo">待办</el-radio-button>
        <el-radio-button value="pending">待随访</el-radio-button>
        <el-radio-button value="overdue">已逾期</el-radio-button>
        <el-radio-button value="done">已随访</el-radio-button>
        <el-radio-button value="">全部</el-radio-button>
      </el-radio-group>
      <el-input v-model="q.name" placeholder="姓名" clearable style="width:120px" @keyup.enter="load(1)" />
      <el-input v-model="q.phone" placeholder="电话" clearable style="width:140px" @keyup.enter="load(1)" />
      <el-select v-model="q.type" placeholder="随访类型" clearable style="width:140px" @change="load(1)">
        <el-option v-for="t in types" :key="t" :label="t" :value="t" />
      </el-select>
      <el-select v-if="auth.isAdmin" v-model="q.deptId" placeholder="科室" clearable style="width:130px" @change="load(1)">
        <el-option v-for="d in depts" :key="d.id" :label="d.name" :value="String(d.id)" />
      </el-select>
      <el-date-picker v-model="range" type="daterange" value-format="YYYY-MM-DD" start-placeholder="计划起" end-placeholder="计划止" @change="onRange" />
      <el-button type="primary" @click="load(1)">查询</el-button>
      <el-button @click="exp">导出</el-button>
    </div>

    <el-table :data="items" stripe height="calc(100vh - 280px)">
      <el-table-column prop="patientName" label="姓名" width="90" />
      <el-table-column prop="phone" label="联系电话" width="130" />
      <el-table-column prop="planDate" label="计划日期" width="120" />
      <el-table-column prop="followUpType" label="随访类型" width="120" />
      <el-table-column prop="deptName" label="科室" width="110" />
      <el-table-column prop="ownerName" label="责任人" width="90" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'done' ? 'success' : row.status === 'overdue' ? 'danger' : 'warning'" effect="dark">
            {{ row.statusLabel }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="note" label="备注" min-width="160" show-overflow-tooltip />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status !== 'done'" type="primary" link @click="openComplete(row)">完成随访</el-button>
          <el-button type="primary" link @click="openDetail(row)">溯源</el-button>
        </template>
      </el-table-column>
    </el-table>
    <div style="margin-top:12px;display:flex;justify-content:flex-end">
      <el-pagination
        background
        layout="total, prev, pager, next"
        :total="total"
        :page-size="q.pageSize"
        :current-page="q.page"
        @current-change="load"
      />
    </div>

    <el-dialog v-model="completeOpen" title="填写随访结果" width="520px">
      <p class="hint">{{ current?.patientName }} · {{ current?.planDate }} · {{ current?.followUpType }}</p>
      <el-input v-model="resultText" type="textarea" :rows="5" maxlength="2000" show-word-limit placeholder="接通情况、宣教内容、异常转诊等" />
      <template #footer>
        <el-button @click="completeOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="complete">提交并锁定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailOpen" title="任务溯源" width="560px">
      <p v-if="detail?.resultText"><b>随访结果：</b>{{ detail.resultText }}</p>
      <el-timeline>
        <el-timeline-item v-for="e in detail?.events || []" :key="e.id" :timestamp="formatTime(e.at)">
          {{ e.actor }}：{{ label(e.fromStatus) }} → {{ label(e.toStatus) }}
          <div class="muted">{{ e.detail }}</div>
        </el-timeline-item>
      </el-timeline>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import http from '../api/http'
import { useAuth } from '../stores/auth'

const auth = useAuth()
const route = useRoute()
const q = reactive({
  status: route.query.status || 'today',
  name: '',
  phone: '',
  type: '',
  deptId: '',
  planFrom: '',
  planTo: '',
  page: 1,
  pageSize: 20,
})
const range = ref([])
const items = ref([])
const total = ref(0)
const types = ref([])
const depts = ref([])
const completeOpen = ref(false)
const detailOpen = ref(false)
const current = ref(null)
const detail = ref(null)
const resultText = ref('')
const saving = ref(false)

function label(s) {
  return { pending: '待随访', done: '已随访', overdue: '已逾期' }[s] || s || '—'
}
function formatTime(t) {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN')
}
function onRange(v) {
  q.planFrom = v?.[0] || ''
  q.planTo = v?.[1] || ''
  load(1)
}
async function load(page = q.page) {
  q.page = page
  const data = await http.get('/followups', { params: q })
  items.value = data.items
  total.value = data.total
}
async function openComplete(row) {
  current.value = row
  resultText.value = ''
  completeOpen.value = true
}
async function complete() {
  if (!resultText.value.trim()) {
    ElMessage.warning('请填写随访结果')
    return
  }
  saving.value = true
  try {
    await http.post(`/followups/${current.value.id}/complete`, { resultText: resultText.value.trim() })
    ElMessage.success('已完成并锁定')
    completeOpen.value = false
    await load()
    await auth.refreshMe()
  } finally {
    saving.value = false
  }
}
async function openDetail(row) {
  detail.value = await http.get(`/followups/${row.id}`)
  detailOpen.value = true
}
function exp() {
  const token = localStorage.getItem('token')
  const qs = new URLSearchParams()
  Object.entries(q).forEach(([k, v]) => {
    if (v !== '' && v != null && k !== 'page' && k !== 'pageSize') qs.set(k, v)
  })
  fetch(`/api/followups/export?${qs}`, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.blob())
    .then((b) => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = '随访记录.xlsx'
      a.click()
    })
}

onMounted(async () => {
  types.value = await http.get('/followups/types')
  depts.value = await http.get('/departments')
  await load(1)
})
</script>

<style scoped>
.hint { color: var(--muted); margin: 0 0 10px; }
.muted { color: var(--muted); font-size: 12px; }
</style>
