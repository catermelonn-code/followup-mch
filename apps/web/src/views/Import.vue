<template>
  <div class="page-panel">
    <h2 class="page-title">数据导入</h2>
    <p class="lead">科室自己导 Excel。一行 = 一次随访。已随访不会被覆盖。</p>
    <div class="filter-row">
      <el-button type="primary" @click="dlTemplate">下载标准模板</el-button>
      <el-upload :show-file-list="false" :http-request="upload" accept=".xlsx,.xls">
        <el-button>上传 Excel</el-button>
      </el-upload>
    </div>
    <div class="rules">
      <div>必填：姓名、联系电话、计划随访日期</div>
      <div>选填：随访责任人（默认导入人）、所属科室（默认本科室）、随访类型（默认常规）、备注</div>
      <div>增量键：电话 + 姓名 + 计划日期。同一文件重复行失败；已随访跳过；待随访/逾期则更新备注与责任人</div>
    </div>

    <div v-if="report" class="result">
      <div class="nums">
        <span class="ok">成功 {{ report.successCount }}</span>
        <span class="skip">跳过 {{ report.skipCount }}</span>
        <span class="fail">失败 {{ report.failCount }}</span>
      </div>
      <el-table :data="report.rows" height="420">
        <el-table-column prop="rowNo" label="行号" width="70" />
        <el-table-column label="结果" width="90">
          <template #default="{ row }">
            <el-tag :type="row.outcome === 'success' ? 'success' : row.outcome === 'skip' ? 'warning' : 'danger'" effect="dark">
              {{ { success: '成功', skip: '跳过', fail: '失败' }[row.outcome] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="说明" min-width="220" />
        <el-table-column label="姓名" width="90">
          <template #default="{ row }">{{ row.raw?.name }}</template>
        </el-table-column>
        <el-table-column label="电话" width="130">
          <template #default="{ row }">{{ row.raw?.phone }}</template>
        </el-table-column>
        <el-table-column label="计划日期" width="120">
          <template #default="{ row }">{{ row.raw?.planDate }}</template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import http from '../api/http'

const report = ref(null)

function downloadBlob(url, filename) {
  const token = localStorage.getItem('token')
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.blob())
    .then((b) => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = filename
      a.click()
    })
}

function dlTemplate() {
  downloadBlob('/api/followups/template', '随访导入模板.xlsx')
}

async function upload({ file }) {
  const fd = new FormData()
  fd.append('file', file)
  report.value = await http.post('/followups/import', fd)
  ElMessage.success(`导入完成：成功 ${report.value.successCount}，跳过 ${report.value.skipCount}，失败 ${report.value.failCount}`)
}
</script>

<style scoped>
.lead { color: var(--muted); margin: 0 0 12px; }
.rules { color: #cfeaf3; font-size: 13px; line-height: 1.8; margin: 8px 0 18px; }
.result { margin-top: 8px; }
.nums { display: flex; gap: 18px; margin-bottom: 10px; font-weight: 700; }
.ok { color: var(--ok); }
.skip { color: var(--warn); }
.fail { color: var(--danger); }
</style>
