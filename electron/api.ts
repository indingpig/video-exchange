/**
 * 深圳住建局接口服务
 * 负责调用政府 API 获取二手房月度成交数据
 */
import axios from 'axios'

// 接口地址
export const API_URL = 'https://fdc.zjj.sz.gov.cn/api/marketInfoShow/getEsfCjxxGsMonthDataNew'

// 通用请求实例
const http = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Referer': 'https://fdc.zjj.sz.gov.cn/',
  }
})

// 返回数据类型
export interface ApiMonthData {
  yearMonth: string
  xmlDateMonth: string
  dataMj: Array<{ name: string; value: number }>
  dataTs: Array<{ name: string; value: number }>
}

export interface ApiResult {
  success: boolean
  data?: ApiMonthData
  message?: string
}

/**
 * 将 "2023年09月" 格式转换为 "202309"
 */
export function monthToFilename(xmlDateMonth: string): string {
  const match = xmlDateMonth.match(/(\d{4})年(\d{1,2})月/)
  if (match) {
    return match[1] + match[2].padStart(2, '0')
  }
  return xmlDateMonth.replace(/[年月]/g, '')
}

/**
 * 从深圳住建局接口获取当月二手房成交数据
 */
export async function fetchMonthData(): Promise<ApiResult> {
  const startTime = Date.now()
  console.log('[API] 🚀 开始请求:', API_URL)

  try {
    const response = await http.post(API_URL)
    const elapsed = Date.now() - startTime
    console.log(`[API] ✅ 响应 ${response.status}, 耗时 ${elapsed}ms`)

    const json = response.data
    console.log('[API] 📦 数据结构:', {
      status: json.status,
      hasData: !!json.data,
      xmlDateMonth: json.data?.xmlDateMonth,
      dataTsCount: json.data?.dataTs?.length,
      dataMjCount: json.data?.dataMj?.length
    })

    if (json.status !== 1 || !json.data) {
      console.warn('[API] ⚠️ 接口返回异常 status:', json.status, 'msg:', json.msg)
      return { success: false, message: json.msg || '接口返回数据异常' }
    }

    const { xmlDateMonth, dataMj, dataTs } = json.data

    if (!xmlDateMonth || !Array.isArray(dataTs) || dataTs.length === 0) {
      console.warn('[API] ⚠️ 数据不完整:', { xmlDateMonth, dataTsType: typeof dataTs, dataTsLength: dataTs?.length })
      return { success: false, message: '接口返回的数据不完整' }
    }

    const yearMonth = monthToFilename(xmlDateMonth)
    console.log(`[API] 🎯 解析成功: ${xmlDateMonth} → ${yearMonth}, ${dataTs.length} 个区域`)

    return {
      success: true,
      data: { yearMonth, xmlDateMonth, dataMj: dataMj || [], dataTs }
    }
  } catch (error) {
    const elapsed = Date.now() - startTime
    console.error(`[API] ❌ 请求失败 (${elapsed}ms):`, error)

    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        return { success: false, message: '请求超时，请检查网络连接' }
      }
      if (error.response) {
        console.error(`[API] 服务器响应: ${error.response.status}`, error.response.data)
        return { success: false, message: `服务器错误: ${error.response.status}` }
      }
      console.error('[API] 网络错误:', error.code, error.message)
      return { success: false, message: `网络请求失败: ${error.message}` }
    }
    return { success: false, message: `未知错误: ${(error as Error).message}` }
  }
}
