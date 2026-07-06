<template>
  <div class="dashboard">
    <!-- 操作栏 -->
    <div class="dashboard-header flex-between">
      <h2><el-icon><DataAnalysis /></el-icon> 数据看板</h2>
      <div class="header-actions">
        <el-select
          v-model="houseStore.selectedMonth"
          placeholder="选择月份"
          style="width: 160px; margin-right: 12px"
          @change="onMonthChange"
        >
          <el-option
            v-for="m in houseStore.monthList"
            :key="m"
            :label="formatMonth(m)"
            :value="m"
          />
        </el-select>
        <el-button
          v-if="!houseStore.dbInitialized && !houseStore.loading"
          type="primary"
          :loading="importing"
          @click="handleImportJson"
        >
          导入数据到数据库
        </el-button>
      </div>
    </div>

    <!-- 初始化提示 -->
    <el-alert
      v-if="!houseStore.dbInitialized && !houseStore.loading"
      title="数据库为空，请先导入 houseData 中的 JSON 数据"
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 20px"
    />

    <!-- 指标卡片 -->
    <el-row :gutter="20" class="summary-row">
      <el-col :span="6">
        <el-card shadow="hover" class="summary-card">
          <div class="stat-label">本月成交套数</div>
          <div class="stat-value">{{ houseStore.monthTotal.count.toLocaleString() }} <span class="stat-unit">套</span></div>
          <div class="stat-sub">
            环比
            <span :class="currentMomRate >= 0 ? 'stat-up' : 'stat-down'">
              {{ formatPercent(currentMomRate) }}
            </span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="summary-card">
          <div class="stat-label">本月成交面积</div>
          <div class="stat-value">{{ formatArea(houseStore.monthTotal.area) }} <span class="stat-unit">万m²</span></div>
          <div class="stat-sub">
            上月 {{ formatArea(houseStore.prevMonthTotal.area) }} 万m²
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="summary-card">
          <div class="stat-label">套均面积</div>
          <div class="stat-value">{{ avgArea }} <span class="stat-unit">m²</span></div>
          <div class="stat-sub">
            总套数 {{ houseStore.monthTotal.count.toLocaleString() }}
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="summary-card">
          <div class="stat-label">当月各区有成交</div>
          <div class="stat-value">{{ activeDistricts }} <span class="stat-unit">个</span></div>
          <div class="stat-sub">
            共 {{ houseStore.districtSummary.length }} 个区域
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 趋势图 -->
    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="24">
        <el-card shadow="hover">
          <template #header>
            <div class="flex-between">
              <span><el-icon><TrendCharts /></el-icon> 月度成交趋势</span>
              <el-radio-group v-model="trendType" size="small">
                <el-radio-button value="count">成交套数</el-radio-button>
                <el-radio-button value="area">成交面积</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="trendChartRef" style="height: 360px" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 区域分析 & 占比 -->
    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="14">
        <el-card shadow="hover">
          <template #header>
            <span><el-icon><DataAnalysis /></el-icon> 各区域成交排名（{{ formatMonth(houseStore.selectedMonth) }}）</span>
          </template>
          <div ref="rankChartRef" style="height: 340px" />
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card shadow="hover">
          <template #header>
            <span><el-icon><PieChart /></el-icon> 各区域成交占比</span>
          </template>
          <div ref="pieChartRef" style="height: 340px" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { DataAnalysis, TrendCharts, PieChart } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { useHouseStore } from '@/stores/house'

const houseStore = useHouseStore()
const importing = ref(false)
const trendType = ref('count')

const trendChartRef = ref<HTMLDivElement>()
const rankChartRef = ref<HTMLDivElement>()
const pieChartRef = ref<HTMLDivElement>()

let trendChart: echarts.ECharts | null = null
let rankChart: echarts.ECharts | null = null
let pieChart: echarts.ECharts | null = null

const currentMomRate = computed(() => {
  const s = houseStore.currentSummary
  return s ? s.momRate : 0
})

const avgArea = computed(() => {
  const total = houseStore.monthTotal
  return total.count > 0 ? Math.round(total.area / total.count * 100) / 100 : 0
})

const activeDistricts = computed(() =>
  houseStore.districtSummary.filter(d => d.count > 0).length
)

function formatMonth(ym: string) {
  if (!ym) return ''
  return `${ym.slice(0, 4)}年${ym.slice(4)}月`
}

function formatPercent(rate: number) {
  const pct = (rate * 100).toFixed(2)
  return rate >= 0 ? `↑ ${pct}%` : `↓ ${Math.abs(Number(pct))}%`
}

function formatArea(v: number) {
  return (v / 10000).toFixed(2)
}

function initTrendChart() {
  if (!trendChartRef.value) return
  trendChart = echarts.init(trendChartRef.value)

  const data = houseStore.monthlyTrend
  const months = data.map(d => d.yearMonth)
  const values = trendType.value === 'count'
    ? data.map(d => d.totalCount)
    : data.map(d => Math.round(d.totalArea / 10000 * 100) / 100)

  trendChart.setOption({
    tooltip: {
      trigger: 'axis',
      formatter(params: { name: string; value: number; seriesName: string }[]) {
        const p = params[0]
        return `${p.name}<br/>${p.seriesName}: ${p.value.toLocaleString()}`
      }
    },
    grid: { left: 50, right: 30, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: months,
      axisLabel: { rotate: 45, fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      name: trendType.value === 'count' ? '套数' : '面积(万m²)'
    },
    series: [{
      name: trendType.value === 'count' ? '成交套数' : '成交面积',
      type: 'line',
      data: values,
      smooth: true,
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(64,158,255,0.35)' },
          { offset: 1, color: 'rgba(64,158,255,0.05)' }
        ])
      },
      lineStyle: { color: '#409eff', width: 2 },
      itemStyle: { color: '#409eff' }
    }]
  })
}

function initRankChart() {
  if (!rankChartRef.value) return
  rankChart = echarts.init(rankChartRef.value)

  const data = houseStore.districtSummary
  const names = data.map(d => d.name).reverse()
  const counts = data.map(d => d.count).reverse()

  rankChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 60, top: 10, bottom: 20 },
    xAxis: { type: 'value', name: '套' },
    yAxis: { type: 'category', data: names },
    series: [{
      type: 'bar',
      data: counts,
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: '#409eff' },
          { offset: 1, color: '#79bbff' }
        ]),
        borderRadius: [0, 4, 4, 0]
      },
      label: {
        show: true,
        position: 'right',
        fontSize: 11
      }
    }]
  })
}

function initPieChart() {
  if (!pieChartRef.value) return
  pieChart = echarts.init(pieChartRef.value)

  const data = houseStore.districtSummary
    .filter(d => d.count > 0)
    .map(d => ({ name: d.name, value: d.count }))

  pieChart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} 套 ({d}%)'
    },
    series: [{
      type: 'pie',
      radius: ['45%', '75%'],
      center: ['50%', '50%'],
      data,
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' }
      },
      label: {
        formatter: '{b}\n{d}%'
      }
    }]
  })
}

function resizeCharts() {
  trendChart?.resize()
  rankChart?.resize()
  pieChart?.resize()
}

watch(trendType, () => {
  if (trendChart) {
    const data = houseStore.monthlyTrend
    const values = trendType.value === 'count'
      ? data.map(d => d.totalCount)
      : data.map(d => Math.round(d.totalArea / 10000 * 100) / 100)

    trendChart.setOption({
      yAxis: { name: trendType.value === 'count' ? '套数' : '面积(万m²)' },
      series: [{
        name: trendType.value === 'count' ? '成交套数' : '成交面积',
        data: values
      }]
    })
  }
})

watch(() => houseStore.selectedMonth, () => {
  nextTick(() => {
    initRankChart()
    initPieChart()
  })
})

watch(() => houseStore.monthlyTrend, () => {
  nextTick(() => {
    initTrendChart()
  })
}, { deep: true })

onMounted(async () => {
  await houseStore.loadFromDb()
  if (!houseStore.selectedMonth && houseStore.monthList.length > 0) {
    houseStore.selectedMonth = houseStore.monthList[houseStore.monthList.length - 1]
  }
  nextTick(() => {
    initTrendChart()
    initRankChart()
    initPieChart()
  })
  window.addEventListener('resize', resizeCharts)
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeCharts)
  trendChart?.dispose()
  rankChart?.dispose()
  pieChart?.dispose()
})

async function handleImportJson() {
  importing.value = true
  const result = await houseStore.importJson()
  importing.value = false
  if (result.success) {
    ElMessage.success(result.message)
    if (!houseStore.selectedMonth && houseStore.monthList.length > 0) {
      houseStore.selectedMonth = houseStore.monthList[houseStore.monthList.length - 1]
    }
    nextTick(() => {
      initTrendChart()
      initRankChart()
      initPieChart()
    })
  } else {
    ElMessage.error(result.message)
  }
}

function onMonthChange() {
  // watch 自动处理图表更新
}
</script>

<style scoped lang="scss">
.dashboard-header {
  margin-bottom: 20px;

  h2 {
    font-size: 20px;
    font-weight: 600;
  }
}

.summary-row {
  .summary-card {
    :deep(.el-card__body) {
      padding: 20px;
    }

    .stat-value {
      margin: 8px 0;
    }

    .stat-unit {
      font-size: 14px;
      font-weight: 400;
      color: #909399;
    }

    .stat-sub {
      font-size: 13px;
      color: #909399;
    }
  }
}
</style>
