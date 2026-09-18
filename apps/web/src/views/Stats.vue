<template>
  <div class="page-panel">
    <h2 class="page-title">统计分析</h2>
    <div class="filter-row">
      <el-date-picker v-model="range" type="daterange" value-format="YYYY-MM-DD" start-placeholder="计划起" end-placeholder="计划止" @change="load" />
      <el-button type="primary" @click="load">刷新</el-button>
    </div>
    <div class="nums">
      <div>总量 <b>{{ s.total || 0 }}</b></div>
      <div>待随访 <b>{{ s.pending || 0 }}</b></div>
      <div>已随访 <b>{{ s.done || 0 }}</b></div>
      <div>已逾期 <b>{{ s.overdue || 0 }}</b></div>
      <div>完成率 <b>{{ s.completionRate || 0 }}%</b></div>
    </div>
    <div class="chart-row">
      <div ref="pieEl" class="chart"></div>
      <div ref="barEl" class="chart"></div>
    </div>
    <el-table :data="s.deptRanking || []" style="margin-top:12px">
      <el-table-column type="index" label="#" width="60" />
      <el-table-column prop="deptName" label="科室" />
      <el-table-column prop="count" label="任务数" width="120" />
    </el-table>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import * as echarts from 'echarts'
import http from '../api/http'

const range = ref([])
const s = reactive({})
const pieEl = ref()
const barEl = ref()
let charts = []

async function load() {
  const params = {}
  if (range.value?.length === 2) {
    params.from = range.value[0]
    params.to = range.value[1]
  }
  Object.assign(s, await http.get('/dashboard/summary', { params }))
  await nextTick()
  render()
}

function render() {
  charts.forEach((c) => c.dispose())
  const pie = echarts.init(pieEl.value)
  pie.setOption({
    color: ['#ffb020', '#3ee0a8', '#ff5b6e'],
    tooltip: { trigger: 'item' },
    title: { text: '随访状态占比', left: 'center', textStyle: { color: '#e9f7ff', fontSize: 14 } },
    series: [{
      type: 'pie',
      radius: ['40%', '64%'],
      label: { color: '#c8fff8' },
      data: [
        { name: '待随访', value: s.pending || 0 },
        { name: '已随访', value: s.done || 0 },
        { name: '已逾期', value: s.overdue || 0 },
      ],
    }],
  })
  const bar = echarts.init(barEl.value)
  bar.setOption({
    title: { text: '科室工作量', left: 'center', textStyle: { color: '#e9f7ff', fontSize: 14 } },
    grid: { left: 48, right: 16, top: 40, bottom: 32 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: (s.deptRanking || []).map((x) => x.deptName), axisLabel: { color: '#9ad3e2' } },
    yAxis: { type: 'value', axisLabel: { color: '#9ad3e2' }, splitLine: { lineStyle: { color: 'rgba(126,232,224,0.08)' } } },
    series: [{
      type: 'bar',
      data: (s.deptRanking || []).map((x) => x.count),
      itemStyle: { color: '#2ad4d0', borderRadius: [6, 6, 0, 0] },
    }],
  })
  charts = [pie, bar]
}

onMounted(load)
onBeforeUnmount(() => charts.forEach((c) => c.dispose()))
</script>

<style scoped>
.nums { display: flex; gap: 24px; margin: 8px 0 16px; color: var(--muted); }
.nums b { color: #fff; margin-left: 6px; font-size: 18px; }
.chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.chart { height: 320px; background: rgba(7, 50, 78, 0.4); border-radius: 12px; }
@media (max-width: 900px) { .chart-row { grid-template-columns: 1fr; } }
</style>
