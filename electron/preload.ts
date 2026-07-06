import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // 数据库查询
  dbQuery: (sql: string, params?: unknown[]) =>
    ipcRenderer.invoke('db:query', sql, params),

  // 数据库执行
  dbRun: (sql: string, params?: unknown[]) =>
    ipcRenderer.invoke('db:run', sql, params),

  // JSON 导入到数据库
  importJsonToDb: () => ipcRenderer.invoke('db:importJson'),

  // 数据库导出到 JSON
  exportDbToJson: () => ipcRenderer.invoke('db:exportJson'),

  // 登录
  login: (username: string, password: string) =>
    ipcRenderer.invoke('auth:login', username, password),

  // 从接口获取月度数据
  fetchMonthData: () => ipcRenderer.invoke('api:fetchMonthData'),

  // 保存月度数据到数据库+JSON
  saveMonthData: (data: {
    yearMonth: string
    xmlDateMonth: string
    dataMj: Array<{ name: string; value: number }>
    dataTs: Array<{ name: string; value: number }>
  }) => ipcRenderer.invoke('api:saveMonthData', data),

  // 检查某月数据是否已存在
  checkMonthExists: (yearMonth: string) =>
    ipcRenderer.invoke('api:checkMonthExists', yearMonth)
})
