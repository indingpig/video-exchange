import { app, BrowserWindow, ipcMain, session } from 'electron'
import path from 'path'
import type { Database as SqlJsDatabase } from 'sql.js'
import { initDatabase, getDatabase, saveDatabase } from './database'
import { fetchMonthData } from './api'

// houseData/*.json 的接口返回结构
interface MonthJsonData {
  data?: {
    dataTs?: Array<{ name: string; value: number }>
    dataMj?: Array<{ name: string; value: number }>
  }
}

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: '深圳房产数据管理系统',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 开发模式加载 vite dev server
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 注册 IPC 处理器
function registerIpcHandlers() {
  const db = getDatabase()

  // 数据库查询
  ipcMain.handle('db:query', async (_event, sql: string, params?: unknown[]) => {
    try {
      const stmt = db.prepare(sql)
      if (params) {
        stmt.bind(params)
      }
      const results: unknown[] = []
      while (stmt.step()) {
        results.push(stmt.getAsObject())
      }
      stmt.free()
      return results
    } catch (error) {
      console.error('db:query error:', error)
      throw error
    }
  })

  // 数据库执行（insert/update/delete）
  ipcMain.handle('db:run', async (_event, sql: string, params?: unknown[]) => {
    try {
      db.run(sql, params)
      // 获取变更信息
      const changes = db.getRowsModified()
      const lastId = sql.trim().toUpperCase().startsWith('INSERT')
        ? (db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] as number) ?? 0
        : 0
      return { changes, lastInsertRowid: lastId }
    } catch (error) {
      console.error('db:run error:', error)
      throw error
    }
  })

  // JSON 导入到数据库
  ipcMain.handle('db:importJson', async () => {
    return await importJsonToDatabase()
  })

  // houseData JSON 增量同步到数据库
  ipcMain.handle('db:syncJson', async () => {
    return await syncJsonToDatabase()
  })

  // 数据库导出到 JSON
  ipcMain.handle('db:exportJson', async () => {
    return await exportDatabaseToJson()
  })

  // 登录
  ipcMain.handle('auth:login', async (_event, username: string, password: string) => {
    try {
      const stmt = db.prepare('SELECT id, username, password, role FROM users WHERE username = ?')
      stmt.bind([username])
      if (stmt.step()) {
        const user = stmt.getAsObject() as { id: number; username: string; password: string; role: string }
        stmt.free()
        // 简单密码比对（生产环境应使用 bcrypt）
        if (user.password === password) {
          const token = Buffer.from(`${user.id}:${user.username}:${Date.now()}`).toString('base64')
          return { success: true, token, role: user.role, message: '登录成功' }
        }
      } else {
        stmt.free()
      }
      return { success: false, message: '用户名或密码错误' }
    } catch (error) {
      console.error('auth:login error:', error)
      return { success: false, message: '登录失败' }
    }
  })

  // 从接口获取月度数据
  ipcMain.handle('api:fetchMonthData', async () => {
    console.log('[IPC] 📡 收到 fetchMonthData 请求')
    const result = await fetchMonthData()
    console.log('[IPC] 📡 结果:', { success: result.success, message: result.message })
    return result
  })

  // 保存月度数据（同时写入 SQLite 和 JSON）
  ipcMain.handle('api:saveMonthData', async (_event, data: {
    yearMonth: string
    xmlDateMonth: string
    dataMj: Array<{ name: string; value: number }>
    dataTs: Array<{ name: string; value: number }>
  }) => {
    console.log('[IPC] 💾 收到 saveMonthData:', data.yearMonth, `${data.dataTs.length} 条`)
    return await saveMonthData(data)
  })

  // 检查某月数据是否已存在
  ipcMain.handle('api:checkMonthExists', async (_event, yearMonth: string) => {
    return await checkMonthExists(yearMonth)
  })
}

// 写入单个月份数据（先删后插），返回写入行数；无 dataTs 的文件视为无效，原样跳过
function writeMonthRows(db: SqlJsDatabase, yearMonth: string, json: MonthJsonData): number {
  const rows = json.data?.dataTs
  if (!rows) return 0

  db.run('DELETE FROM house_data WHERE year_month = ?', [yearMonth])
  for (const item of rows) {
    const areaItem = json.data?.dataMj?.find(a => a.name === item.name)
    db.run(
      'INSERT INTO house_data (year_month, district, area, count) VALUES (?, ?, ?, ?)',
      [yearMonth, item.name, areaItem ? areaItem.value : 0, item.value]
    )
  }
  return rows.length
}

// 记录月份文件已同步的修改时间
function markMonthSynced(db: SqlJsDatabase, yearMonth: string, mtime: number): void {
  db.run('INSERT OR REPLACE INTO sync_meta (year_month, mtime) VALUES (?, ?)', [yearMonth, mtime])
}

// 查询月份文件已同步的修改时间，未同步过返回 null
function getSyncedMtime(db: SqlJsDatabase, yearMonth: string): number | null {
  const stmt = db.prepare('SELECT mtime FROM sync_meta WHERE year_month = ?')
  stmt.bind([yearMonth])
  const mtime = stmt.step() ? (stmt.getAsObject().mtime as number) : null
  stmt.free()
  return mtime
}

// 按 mtime 增量同步 houseData/*.json 到数据库：只导入新增或文件有变更的月份
async function syncJsonToDatabase(): Promise<{ synced: number; rows: number }> {
  const db = getDatabase()
  const fs = await import('fs')
  const houseDataDir = path.join(__dirname, '../houseData')

  if (!fs.existsSync(houseDataDir)) {
    return { synced: 0, rows: 0 }
  }

  const pending: Array<{ yearMonth: string; json: MonthJsonData; mtime: number }> = []
  for (const file of fs.readdirSync(houseDataDir).filter(f => f.endsWith('.json'))) {
    const filePath = path.join(houseDataDir, file)
    const yearMonth = file.replace('.json', '')
    const mtime = fs.statSync(filePath).mtimeMs

    if (getSyncedMtime(db, yearMonth) === mtime) continue

    try {
      const json = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MonthJsonData
      if (!json.data?.dataTs) {
        console.warn(`[Sync] 跳过无效文件: ${file}`)
        continue
      }
      pending.push({ yearMonth, json, mtime })
    } catch (error) {
      console.warn(`[Sync] 解析失败跳过: ${file}`, error)
    }
  }

  if (!pending.length) {
    return { synced: 0, rows: 0 }
  }

  let rows = 0
  db.run('BEGIN TRANSACTION')
  try {
    for (const item of pending) {
      rows += writeMonthRows(db, item.yearMonth, item.json)
      markMonthSynced(db, item.yearMonth, item.mtime)
    }
    db.run('COMMIT')
    saveDatabase()
    console.log(`[Sync] JSON 增量同步完成: ${pending.length} 个月份, ${rows} 行`)
    return { synced: pending.length, rows }
  } catch (error) {
    db.run('ROLLBACK')
    console.error('syncJsonToDatabase error:', error)
    return { synced: 0, rows: 0 }
  }
}

// 全量导入 JSON 到数据库
async function importJsonToDatabase() {
  const db = getDatabase()
  const fs = await import('fs')
  const houseDataDir = path.join(__dirname, '../houseData')

  if (!fs.existsSync(houseDataDir)) {
    return { success: false, count: 0, message: 'houseData 目录不存在' }
  }

  const files = fs.readdirSync(houseDataDir).filter(f => f.endsWith('.json'))
  let count = 0

  db.run('BEGIN TRANSACTION')
  try {
    for (const file of files) {
      const filePath = path.join(houseDataDir, file)
      const yearMonth = file.replace('.json', '')
      const json = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MonthJsonData

      count += writeMonthRows(db, yearMonth, json)
      markMonthSynced(db, yearMonth, fs.statSync(filePath).mtimeMs)
    }
    db.run('COMMIT')
    saveDatabase()
    return { success: true, count, message: `成功导入 ${files.length} 个月份，共 ${count} 条数据` }
  } catch (error) {
    db.run('ROLLBACK')
    console.error('importJsonToDatabase error:', error)
    return { success: false, count: 0, message: `导入失败: ${error}` }
  }
}

// 导出数据库到 JSON
async function exportDatabaseToJson() {
  const db = getDatabase()
  const fs = await import('fs')
  const houseDataDir = path.join(__dirname, '../houseData')

  try {
    const results = db.exec(`
      SELECT year_month, district, area, count 
      FROM house_data 
      ORDER BY year_month, district
    `)

    if (!results.length || !results[0].values.length) {
      return { success: false, message: '数据库中没有数据' }
    }

    // 按月份分组
    const monthMap = new Map<string, Array<{ name: string; value: number }>>()
    const areaMap = new Map<string, Array<{ name: string; value: number }>>()

    for (const row of results[0].values) {
      const [yearMonth, district, area, count] = row as [string, string, number, number]
      if (!monthMap.has(yearMonth)) {
        monthMap.set(yearMonth, [])
        areaMap.set(yearMonth, [])
      }
      monthMap.get(yearMonth)!.push({ name: district, value: count })
      areaMap.get(yearMonth)!.push({ name: district, value: area })
    }

    for (const [yearMonth, dataTs] of monthMap) {
      const dataMj = areaMap.get(yearMonth) || []
      const json = {
        status: 1,
        msg: '成功',
        data: {
          result: 'success',
          xmlDateMonth: `${yearMonth.slice(0, 4)}年${yearMonth.slice(4)}月`,
          dataMj,
          dataTs,
          xmlDateDay: ''
        }
      }

      if (!fs.existsSync(houseDataDir)) {
        fs.mkdirSync(houseDataDir, { recursive: true })
      }
      fs.writeFileSync(path.join(houseDataDir, `${yearMonth}.json`), JSON.stringify(json, null, 2), 'utf-8')
    }

    return { success: true, message: `成功导出 ${monthMap.size} 个月份数据` }
  } catch (error) {
    console.error('exportDatabaseToJson error:', error)
    return { success: false, message: `导出失败: ${error}` }
  }
}

// 检查某月数据是否已存在
async function checkMonthExists(yearMonth: string): Promise<{ exists: boolean }> {
  const db = getDatabase()
  const stmt = db.prepare('SELECT COUNT(*) as cnt FROM house_data WHERE year_month = ?')
  stmt.bind([yearMonth])
  stmt.step()
  const result = stmt.getAsObject() as { cnt: number }
  stmt.free()
  return { exists: result.cnt > 0 }
}

// 保存月度数据到 SQLite + JSON
async function saveMonthData(data: {
  yearMonth: string
  xmlDateMonth: string
  dataMj: Array<{ name: string; value: number }>
  dataTs: Array<{ name: string; value: number }>
}): Promise<{ success: boolean; count: number; message: string }> {
  const db = getDatabase()
  const fs = await import('fs')
  const houseDataDir = path.join(__dirname, '../houseData')
  let count = 0

  try {
    // 删除该月份旧数据
    db.run('DELETE FROM house_data WHERE year_month = ?', [data.yearMonth])

    // 写入数据库
    db.run('BEGIN TRANSACTION')
    for (const item of data.dataTs) {
      const areaItem = data.dataMj.find(a => a.name === item.name)
      const area = areaItem ? areaItem.value : 0
      db.run(
        'INSERT INTO house_data (year_month, district, area, count) VALUES (?, ?, ?, ?)',
        [data.yearMonth, item.name, area, item.value]
      )
      count++
    }
    db.run('COMMIT')

    // 写入 JSON 文件
    if (!fs.existsSync(houseDataDir)) {
      fs.mkdirSync(houseDataDir, { recursive: true })
    }

    const json = {
      status: 1,
      msg: '成功',
      data: {
        result: 'success',
        xmlDateMonth: data.xmlDateMonth,
        dataMj: data.dataMj,
        dataTs: data.dataTs,
        xmlDateDay: ''
      }
    }

    const filePath = path.join(houseDataDir, `${data.yearMonth}.json`)
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf-8')

    // 记录同步标记并落盘，避免下次同步重复导入
    markMonthSynced(db, data.yearMonth, fs.statSync(filePath).mtimeMs)
    saveDatabase()

    return { success: true, count, message: `成功保存 ${data.xmlDateMonth} 数据，共 ${count} 条` }
  } catch (error) {
    try { db.run('ROLLBACK') } catch { /* ignore */ }
    console.error('saveMonthData error:', error)
    return { success: false, count: 0, message: `保存失败: ${(error as Error).message}` }
  }
}

// Content Security Policy
function setupCSP() {
  const isDev = !!process.env.VITE_DEV_SERVER_URL

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          isDev
            ? [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: http://localhost:*",
              "font-src 'self' data:",
              "connect-src 'self' https://fdc.zjj.sz.gov.cn ws://localhost:*"
            ].join('; ')
            : [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "font-src 'self' data:",
              "connect-src 'self' https://fdc.zjj.sz.gov.cn"
            ].join('; ')
        ]
      }
    })
  })
}

app.whenReady().then(async () => {
  // Content Security Policy
  setupCSP()

  await initDatabase()
  // 启动时同步 houseData 目录，保证月份下拉框始终包含最新 JSON 文件
  await syncJsonToDatabase()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
