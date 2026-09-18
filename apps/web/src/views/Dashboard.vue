<template>
  <div class="dash">
    <div class="kpis">
      <div class="kpi">
        <div>
          <div class="k-label">总随访记录</div>
          <div class="k-num">{{ s.total ?? '—' }}</div>
        </div>
        <div class="k-ico">☰</div>
      </div>
      <div class="kpi">
        <div>
          <div class="k-label">待随访</div>
          <div class="k-num">{{ s.pending ?? '—' }}</div>
        </div>
        <div class="k-ico">👤</div>
      </div>
      <div class="kpi">
        <div>
          <div class="k-label">已随访</div>
          <div class="k-num">{{ s.done ?? '—' }}</div>
        </div>
        <div class="k-ico">📅</div>
      </div>
      <div class="kpi">
        <div>
          <div class="k-label">完成率</div>
          <div class="k-num">{{ s.completionRate ?? '—' }}%</div>
        </div>
        <div class="k-ico">◎</div>
      </div>
    </div>

    <div class="board">
      <div class="charts">
        <div class="board-h">数据看板</div>
        <div class="chart-row">
          <div class="chart-box">
            <div class="c-title">孕产妇随访趋势</div>
            <div ref="trendEl" class="chart"></div>
          </div>
          <div class="chart-box">
            <div class="c-title">儿童随访状态</div>
            <div ref="pieEl" class="chart"></div>
          </div>
          <div class="chart-box">
            <div class="c-title">科室随访排行</div>
            <div ref="barEl" class="chart"></div>
          </div>
        </div>
      </div>
      <aside class="todos">
        <div class="todos-h">今日待办提醒</div>
        <div v-if="!(s.todayTodos || []).length" class="empty">今日无待办</div>
        <div v-for="t in s.todayTodos || []" :key="t.type" class="todo" @click="goToday">
          <div class="t-ico">{{ iconFor(t.type) }}</div>
          <div class="t-name">{{ t.type }}</div>
          <div class="t-count">{{ t.count }} 条</div>
        </div>
        <div class="todo-foot">逾期 {{ s.overdue || 0 }} 条，点条目进入任务列表</div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import http from '../api/http'

const router = useRouter()
const s = reactive({})
const trendEl = ref()
const pieEl = ref()
const barEl = ref()
let charts = []

function iconFor(type) {
  if (type.includes('孕')) return '👤'
  if (type.includes('产')) return '▤'
  return '◎'
}
function goToday() {
  router.push('/tasks?status=today')
}

const axis = {
  axisLine: { lineStyle: { color: 'rgba(126,232,224,0.25)' } },
  axisLabel: { color: '#9ad3e2' },
  splitLine: { lineStyle: { color: 'rgba(126,232,224,0.08)' } },
}

function render() {
  charts.forEach((c) => c.dispose())
  charts = []
  const trend = echarts.init(trendEl.value)
  trend.setOption({
    color: ['#3ee0d8'],
    grid: { left: 36, right: 12, top: 24, bottom: 28 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: (s.maternalTrend || []).map((x) => x.label), ...axis },
    yAxis: { type: 'value', ...axis },
    series: [{
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      areaStyle: { color: 'rgba(62,224,216,0.12)' },
      data: (s.maternalTrend || []).map((x) => x.count),
    }],
  })
  const pie = echarts.init(pieEl.value)
  const child = s.childStatus || []
  pie.setOption({
    color: ['#7ee0c9', '#2bb8c9', '#1a8fa3'],
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['52%', '74%'],
      label: { color: '#c8fff8', formatter: '{d}%' },
      data: child.map((x) => ({ name: x.label, value: x.count })),
    }],
  })
  const bar = echarts.init(barEl.value)
  const depts = s.deptRanking || []
  bar.setOption({
    color: ['#3ee0d8'],
    grid: { left: 36, right: 12, top: 24, bottom: 28 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: depts.map((x) => x.deptName), ...axis },
    yAxis: { type: 'value', ...axis },
    series: [{
      type: 'bar',
      barWidth: 18,
      itemStyle: {
        borderRadius: [6, 6, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#7ef0ea' },
          { offset: 1, color: '#1aa8b8' },
        ]),
      },
      data: depts.map((x) => x.count),
    }],
  })
  charts = [trend, pie, bar]
}

function onResize() {
  charts.forEach((c) => c.resize())
}

onMounted(async () => {
  Object.assign(s, await http.get('/dashboard/summary'))
  await nextTick()
  render()
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  charts.forEach((c) => c.dispose())
})
</script>

<style scoped>
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.kpi {
  background: linear-gradient(135deg, #33d3d4 0%, #17b0c2 70%, #129bb0 100%);
  border-radius: 14px;
  padding: 18px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 108px;
  box-shadow: 0 10px 24px rgba(18, 155, 176, 0.28);
  position: relative;
  overflow: hidden;
}
.kpi::after {
  content: '';
  position: absolute;
  right: -20px; bottom: -30px;
  width: 120px; height: 120px;
  border-radius: 50%;
  background: rgba(255,255,255,0.08);
}
.k-label { opacity: 0.92; font-size: 14px; }
.k-num { font-size: 36px; font-weight: 800; margin-top: 8px; letter-spacing: 0.5px; }
.k-ico { font-size: 28px; opacity: 0.85; z-index: 1; }
.board {
  margin-top: 16px;
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 14px;
  min-height: 420px;
}
.charts {
  background: linear-gradient(180deg, #0d4d6e, #0a3d58);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 16px 18px 10px;
}
.board-h {
  font-size: 16px; font-weight: 800; padding-bottom: 8px;
  border-bottom: 3px solid #2ad4d0; display: inline-block; margin-bottom: 8px;
}
.chart-row { display: grid; grid-template-columns: 1.2fr 0.9fr 1fr; gap: 8px; }
.chart-box { min-width: 0; }
.c-title { text-align: center; color: #d7f6ff; font-weight: 700; margin-top: 6px; }
.chart { height: 280px; }
.todos {
  background: linear-gradient(180deg, #0d4d6e, #0a3d58);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 16px;
}
.todos-h { font-weight: 800; margin-bottom: 14px; }
.todo {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 12px 4px;
  border-bottom: 1px solid var(--line);
  cursor: pointer;
}
.todo:hover { color: #7ef0ea; }
.t-count { color: #7ef0ea; font-weight: 800; }
.todo-foot, .empty { color: var(--muted); font-size: 12px; margin-top: 12px; }
@media (max-width: 1100px) {
  .kpis { grid-template-columns: 1fr 1fr; }
  .board, .chart-row { grid-template-columns: 1fr; }
}
</style>
