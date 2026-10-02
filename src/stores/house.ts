import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface HouseRecord {
  id?: number
  year_month: string
  district: string
  area: number
  count: number
}

export interface MonthSummary {
  yearMonth: string
  totalCount: number
  totalArea: number
  momChange: number  // 环比变化量
  momRate: number    // 环比增长率
  yoyChange: number  // 同比变化量
  yoyRate: number    // 同比增长率
}

export interface DistrictData {
  name: string
  count: number
  area: number
  avgArea: number  // 套均面积
}

export interface PeriodSummary {
  period: string     // "2023Q3" / "2024"
  totalCount: number
  totalArea: number
}

export const useHouseStore = defineStore('house', () => {
  const allData = ref<HouseRecord[]>([])
  const loading = ref(false)
  const selectedMonth = ref('')
  const dbInitialized = ref(false)

  // 所有可用月份列表
  const monthList = computed(() => {
    const months = [...new Set(allData.value.map(d => d.year_month))]
    return months.sort()
  })

  // 当月数据
  const currentMonthData = computed(() => {
    const month = selectedMonth.value || monthList.value[monthList.value.length - 1] || ''
    return allData.value.filter(d => d.year_month === month)
  })

  // 当月各区汇总
  const districtSummary = computed<DistrictData[]>(() => {
    return currentMonthData.value.map(d => ({
      name: d.district,
      count: d.count,
      area: d.area,
      avgArea: d.count > 0 ? Math.round(d.area / d.count * 100) / 100 : 0
    })).sort((a, b) => b.count - a.count)
  })

  // 当月总计
  const monthTotal = computed(() => {
    const count = currentMonthData.value.reduce((sum, d) => sum + d.count, 0)
    const area = currentMonthData.value.reduce((sum, d) => sum + d.area, 0)
    return { count, area }
  })

  // 月度汇总趋势
  const monthlyTrend = computed<MonthSummary[]>(() => {
    const result: MonthSummary[] = []
    const months = monthList.value

    for (let i = 0; i < months.length; i++) {
      const month = months[i]
      const data = allData.value.filter(d => d.year_month === month)
      const totalCount = data.reduce((sum, d) => sum + d.count, 0)
      const totalArea = data.reduce((sum, d) => sum + d.area, 0)

      // 环比
      const prev = result[i - 1]
      const momChange = prev ? totalCount - prev.totalCount : 0
      const momRate = prev && prev.totalCount > 0
        ? (totalCount - prev.totalCount) / prev.totalCount
        : 0

      // 同比（同月份去年）
      const yearAgo = `${parseInt(month.slice(0, 4)) - 1}${month.slice(4)}`
      const yoyData = allData.value.filter(d => d.year_month === yearAgo)
      const yoyTotal = yoyData.reduce((sum, d) => sum + d.count, 0)
      const yoyChange = yoyTotal > 0 ? totalCount - yoyTotal : 0
      const yoyRate = yoyTotal > 0 ? (totalCount - yoyTotal) / yoyTotal : 0

      result.push({
        yearMonth: month,
        totalCount,
        totalArea: Math.round(totalArea * 100) / 100,
        momChange,
        momRate,
        yoyChange,
        yoyRate
      })
    }

    return result
  })

  // 按分组函数汇总套数/面积（季度图、年度图共用），分组键按字典序即时间序
  function aggregatePeriods(keyFn: (yearMonth: string) => string): PeriodSummary[] {
    const map = new Map<string, { count: number; area: number }>()
    for (const d of allData.value) {
      const key = keyFn(d.year_month)
      const acc = map.get(key) ?? { count: 0, area: 0 }
      acc.count += d.count
      acc.area += d.area
      map.set(key, acc)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, acc]) => ({
        period,
        totalCount: acc.count,
        totalArea: Math.round(acc.area * 100) / 100
      }))
  }

  // 季度汇总，"202609" → "2026Q3"
  const quarterlyTrend = computed<PeriodSummary[]>(() =>
    aggregatePeriods(ym => `${ym.slice(0, 4)}Q${Math.floor((Number(ym.slice(4)) - 1) / 3) + 1}`)
  )

  // 年度汇总
  const yearlyTrend = computed<PeriodSummary[]>(() =>
    aggregatePeriods(ym => ym.slice(0, 4))
  )

  // 选中月份的汇总及上一月汇总（环比基准），跟随下拉选择变化
  const selectedSummary = computed(() => {
    const trend = monthlyTrend.value
    const idx = trend.findIndex(t => t.yearMonth === selectedMonth.value)
    const current = idx >= 0 ? trend[idx] : (trend.length > 0 ? trend[trend.length - 1] : null)
    const prev = current && idx > 0 ? trend[idx - 1] : null
    return { current, prev }
  })

  // 从数据库加载所有数据（先增量同步 houseData 目录，自动纳入新增/更新的 JSON 文件）
  async function loadFromDb() {
    loading.value = true
    try {
      await window.api.syncJson()
      const data = await window.api.dbQuery('SELECT * FROM house_data ORDER BY year_month, district') as HouseRecord[]
      allData.value = data
      if (data.length > 0) {
        dbInitialized.value = true
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      loading.value = false
    }
  }

  // 从 JSON 导入到数据库
  async function importJson() {
    loading.value = true
    try {
      const result = await window.api.importJsonToDb()
      if (result.success) {
        await loadFromDb()
      }
      return result
    } catch (error) {
      console.error('导入失败:', error)
      return { success: false, message: '导入失败' }
    } finally {
      loading.value = false
    }
  }

  // 导出数据库到 JSON
  async function exportJson() {
    return await window.api.exportDbToJson()
  }

  // 更新单条记录
  async function updateRecord(record: HouseRecord) {
    await window.api.dbRun(
      'UPDATE house_data SET area = ?, count = ? WHERE id = ?',
      [record.area, record.count, record.id]
    )
    await loadFromDb()
  }

  // 删除某月某区的记录
  async function deleteRecord(id: number) {
    await window.api.dbRun('DELETE FROM house_data WHERE id = ?', [id])
    await loadFromDb()
  }

  // 添加记录
  async function addRecord(record: Omit<HouseRecord, 'id'>) {
    await window.api.dbRun(
      'INSERT OR REPLACE INTO house_data (year_month, district, area, count) VALUES (?, ?, ?, ?)',
      [record.year_month, record.district, record.area, record.count]
    )
    await loadFromDb()
  }

  // 清空数据库
  async function clearAll() {
    await window.api.dbRun('DELETE FROM house_data')
    allData.value = []
  }

  // 从深圳住建局接口获取当月数据
  async function fetchFromApi() {
    loading.value = true
    try {
      const result = await window.api.fetchMonthData()
      return result
    } catch (error) {
      console.error('接口请求失败:', error)
      return { success: false, message: '请求失败: ' + (error as Error).message } as const
    } finally {
      loading.value = false
    }
  }

  // 保存接口数据到数据库+JSON
  async function saveApiData(data: {
    yearMonth: string
    xmlDateMonth: string
    dataMj: Array<{ name: string; value: number }>
    dataTs: Array<{ name: string; value: number }>
  }) {
    loading.value = true
    try {
      const result = await window.api.saveMonthData(data)
      if (result.success) {
        await loadFromDb()
      }
      return result
    } catch (error) {
      console.error('保存失败:', error)
      return { success: false, count: 0, message: '保存失败' }
    } finally {
      loading.value = false
    }
  }

  // 检查月份是否已存在
  async function checkExists(yearMonth: string) {
    return await window.api.checkMonthExists(yearMonth)
  }

  return {
    allData,
    loading,
    dbInitialized,
    selectedMonth,
    monthList,
    currentMonthData,
    districtSummary,
    monthTotal,
    monthlyTrend,
    quarterlyTrend,
    yearlyTrend,
    selectedSummary,
    loadFromDb,
    importJson,
    exportJson,
    updateRecord,
    deleteRecord,
    addRecord,
    clearAll,
    fetchFromApi,
    saveApiData,
    checkExists
  }
})
