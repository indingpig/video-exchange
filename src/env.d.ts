/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

interface Window {
  api: {
    // 数据库操作
    dbQuery: (sql: string, params?: unknown[]) => Promise<unknown>
    dbRun: (sql: string, params?: unknown[]) => Promise<{ changes: number; lastInsertRowid: number }>
    // JSON 导入导出
    importJsonToDb: () => Promise<{ success: boolean; count: number; message: string }>
    exportDbToJson: () => Promise<{ success: boolean; message: string }>
    // houseData JSON 增量同步到数据库
    syncJson: () => Promise<{ synced: number; rows: number }>
    // 认证
    login: (username: string, password: string) => Promise<{ success: boolean; token?: string; role?: string; message: string }>
    // 接口获取数据
    fetchMonthData: () => Promise<{
      success: boolean
      data?: {
        yearMonth: string
        xmlDateMonth: string
        dataMj: Array<{ name: string; value: number }>
        dataTs: Array<{ name: string; value: number }>
      }
      message?: string
    }>
    // 保存数据
    saveMonthData: (data: {
      yearMonth: string
      xmlDateMonth: string
      dataMj: Array<{ name: string; value: number }>
      dataTs: Array<{ name: string; value: number }>
    }) => Promise<{ success: boolean; count: number; message: string }>
    // 检查数据是否存在
    checkMonthExists: (yearMonth: string) => Promise<{ exists: boolean }>
  }
}
