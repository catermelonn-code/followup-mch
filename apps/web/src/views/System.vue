<template>
  <div class="page-panel">
    <h2 class="page-title">系统管理</h2>
    <el-tabs v-model="tab">
      <el-tab-pane label="科室人员" name="staff">
        <div class="filter-row">
          <el-input v-model="keyword" placeholder="姓名 / 工号 / 登录名" clearable style="width:220px" @keyup.enter="loadStaff" />
          <el-button type="primary" @click="loadStaff">查询</el-button>
          <el-button @click="dlStaffTpl">人员模板</el-button>
          <el-upload :show-file-list="false" :http-request="uploadStaff" accept=".xlsx,.xls">
            <el-button>导入人员</el-button>
          </el-upload>
        </div>
        <el-table :data="staff" height="480">
          <el-table-column prop="name" label="姓名" width="100" />
          <el-table-column prop="username" label="登录名" width="120" />
          <el-table-column prop="employeeNo" label="工号" width="100" />
          <el-table-column prop="deptName" label="科室" width="130" />
          <el-table-column prop="roleLabel" label="角色" width="120" />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">{{ row.active ? '启用' : '停用' }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="导入留痕" name="imports">
        <el-radio-group v-model="kind" style="margin-bottom:12px" @change="loadImports">
          <el-radio-button value="">全部</el-radio-button>
          <el-radio-button value="followup">随访导入</el-radio-button>
          <el-radio-button value="staff">人员导入</el-radio-button>
        </el-radio-group>
        <el-table :data="batches" @row-click="openBatch">
          <el-table-column prop="id" label="批次" width="80" />
          <el-table-column prop="filename" label="文件名" min-width="180" />
          <el-table-column prop="kind" label="类型" width="100">
            <template #default="{ row }">{{ row.kind === 'staff' ? '人员' : '随访' }}</template>
          </el-table-column>
          <el-table-column prop="operator" label="操作人" width="100" />
          <el-table-column prop="deptName" label="科室" width="110" />
          <el-table-column prop="successCount" label="成功" width="80" />
          <el-table-column prop="skipCount" label="跳过" width="80" />
          <el-table-column prop="failCount" label="失败" width="80" />
          <el-table-column label="时间" width="180">
            <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString('zh-CN') }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="rowOpen" :title="`批次 #${batch?.id} 行结果`" width="720px">
      <el-table :data="batch?.rows || []" height="420">
        <el-table-column prop="rowNo" label="行号" width="70" />
        <el-table-column prop="outcome" label="结果" width="90" />
        <el-table-column prop="reason" label="说明" min-width="220" />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import http from '../api/http'

const tab = ref('staff')
const keyword = ref('')
const staff = ref([])
const kind = ref('')
const batches = ref([])
const rowOpen = ref(false)
const batch = ref(null)

async function loadStaff() {
  staff.value = await http.get('/staff', { params: { keyword: keyword.value } })
}
async function loadImports() {
  batches.value = await http.get('/imports', { params: { kind: kind.value } })
}
function dlStaffTpl() {
  const token = localStorage.getItem('token')
  fetch('/api/staff/template', { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.blob())
    .then((b) => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = '人员导入模板.xlsx'
      a.click()
    })
}
async function uploadStaff({ file }) {
  const fd = new FormData()
  fd.append('file', file)
  const r = await http.post('/staff/import', fd)
  ElMessage.success(`人员导入：成功 ${r.successCount}，跳过 ${r.skipCount}，失败 ${r.failCount}`)
  await loadStaff()
  await loadImports()
}
async function openBatch(row) {
  batch.value = await http.get(`/imports/${row.id}`)
  rowOpen.value = true
}

onMounted(async () => {
  await loadStaff()
  await loadImports()
})
</script>
