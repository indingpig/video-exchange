import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import fs from 'fs'
import path from 'path'

let db: SqlJsDatabase | null = null

// 数据库文件路径（放在 houseData 同级目录）
const DB_PATH = path.join(__dirname, '../data/house.db')

// 获取 sql-wasm.wasm 的正确路径
function getWasmPath(): string {
  const possiblePaths = [
    path.join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm'),
    path.join(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm'),
    path.join(process.resourcesPath || '', 'sql-wasm.wasm'),
  ]
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p
  }
  // 如果都找不到，返回默认路径
  return possiblePaths[0]
}

/**
 * 初始化数据库：加载或创建 SQLite 数据库文件，建表并插入默认管理员账号
 */
export async function initDatabase(): Promise<void> {
  const wasmPath = getWasmPath()
  console.log('[DB] Loading sql.js wasm from:', wasmPath)

  const SQL = await initSqlJs({
    locateFile: (file: string) => {
      if (file.endsWith('.wasm')) return wasmPath
      return file
    }
  })

  // 确保 data 目录存在
  const dataDir = path.dirname(DB_PATH)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  // 加载已有数据库或创建新数据库
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  // 创建表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created TEXT DEFAULT (datetime('now','localtime'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS house_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year_month TEXT NOT NULL,
      district TEXT NOT NULL,
      area REAL DEFAULT 0,
      count INTEGER DEFAULT 0,
      UNIQUE(year_month, district)
    )
  `)

  // 插入默认管理员账号（如果不存在）
  const result = db.exec("SELECT id FROM users WHERE username = 'admin'")
  if (!result.length || !result[0].values.length) {
    db.run("INSERT INTO users (username, password, role) VALUES ('admin', 'admin123', 'admin')")
    saveDatabase()
  } else {
    saveDatabase()
  }
}

/**
 * 保存数据库到文件
 */
export function saveDatabase(): void {
  if (!db) return
  const data = db.export()
  const buffer = Buffer.from(data)
  const dataDir = path.dirname(DB_PATH)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
  fs.writeFileSync(DB_PATH, buffer)
}

/**
 * 获取数据库实例
 */
export function getDatabase(): SqlJsDatabase {
  if (!db) {
    throw new Error('数据库未初始化')
  }
  return db
}
