<template>
  <div class="settings">
    <div class="page-header">
      <h2><el-icon><Setting /></el-icon> 系统设置</h2>
    </div>

    <!-- 用户管理 -->
    <el-card shadow="hover" style="margin-bottom: 20px">
      <template #header>
        <div class="flex-between">
          <span><el-icon><UserFilled /></el-icon> 用户管理</span>
          <el-button type="primary" size="small" @click="openAddUser"><el-icon><CirclePlus /></el-icon> 新增用户</el-button>
        </div>
      </template>

      <el-table :data="userList" stripe border style="width: 100%" v-loading="userLoading">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="username" label="用户名" width="150" />
        <el-table-column prop="role" label="角色" width="100">
          <template #default="{ row }">
            <el-tag :type="row.role === 'admin' ? 'danger' : 'info'" size="small">
              {{ row.role === 'admin' ? '管理员' : '普通用户' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created" label="创建时间" width="180" />
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button type="primary" text size="small" @click="openChangePwd(row)">修改密码</el-button>
            <el-button
              v-if="row.username !== 'admin'"
              type="danger"
              text
              size="small"
              @click="handleDeleteUser(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 数据统计 -->
    <el-card shadow="hover" style="margin-bottom: 20px">
      <template #header>
        <span><el-icon><Box /></el-icon> 数据统计</span>
      </template>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="数据库记录数">
          {{ houseStore.allData.length }} 条
        </el-descriptions-item>
        <el-descriptions-item label="覆盖月份">
          {{ houseStore.monthList.length }} 个月
        </el-descriptions-item>
        <el-descriptions-item label="数据范围">
          {{ dataRange }}
        </el-descriptions-item>
        <el-descriptions-item label="覆盖区域">
          {{ districtList.length }} 个区
        </el-descriptions-item>
        <el-descriptions-item label="累计成交套数">
          {{ totalAllCount.toLocaleString() }} 套
        </el-descriptions-item>
        <el-descriptions-item label="累计成交面积">
          {{ (totalAllArea / 10000).toFixed(2) }} 万m²
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- 危险操作 -->
    <el-card shadow="hover">
      <template #header>
        <span style="color: #f56c6c"><el-icon><WarningFilled /></el-icon> 危险操作</span>
      </template>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-popconfirm
            title="确定要清空所有房产数据吗？此操作不可恢复！"
            @confirm="handleClearData"
          >
            <template #reference>
              <el-button type="danger" plain>清空房产数据</el-button>
            </template>
          </el-popconfirm>
          <p style="margin-top: 8px; font-size: 12px; color: #909399;">
            清除所有 house_data 表中的数据
          </p>
        </el-col>
        <el-col :span="12">
          <el-popconfirm
            title="确定要重新导入数据吗？将覆盖所有现有数据！"
            @confirm="handleReimport"
          >
            <template #reference>
              <el-button type="warning" plain :loading="reimporting">从 JSON 重新导入</el-button>
            </template>
          </el-popconfirm>
          <p style="margin-top: 8px; font-size: 12px; color: #909399;">
            清空后重新从 houseData 目录导入
          </p>
        </el-col>
      </el-row>
    </el-card>

    <!-- 新增用户对话框 -->
    <el-dialog
      v-model="showUserDialog"
      :title="dialogMode === 'add' ? '新增用户' : '修改密码'"
      width="400px"
      @close="resetUserForm"
    >
      <el-form ref="userFormRef" :model="userForm" :rules="userRules" label-width="80px">
        <el-form-item v-if="dialogMode === 'add'" label="用户名" prop="username">
          <el-input v-model="userForm.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item v-else label="用户名">
          <span>{{ userForm.username }}</span>
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="userForm.password"
            type="password"
            placeholder="请输入密码"
            show-password
          />
        </el-form-item>
        <el-form-item v-if="dialogMode === 'add'" label="角色" prop="role">
          <el-select v-model="userForm.role" style="width: 100%">
            <el-option label="普通用户" value="user" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showUserDialog = false">取消</el-button>
        <el-button type="primary" :loading="userSaving" @click="handleUserSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Setting, UserFilled, Box, WarningFilled, CirclePlus } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { useHouseStore } from '@/stores/house'
import { useAuthStore } from '@/stores/auth'

const houseStore = useHouseStore()
const authStore = useAuthStore()

const userLoading = ref(false)
const userList = ref<Array<{ id: number; username: string; role: string; created: string }>>([])
const showUserDialog = ref(false)
const dialogMode = ref<'add' | 'pwd'>('add')
const userSaving = ref(false)
const reimporting = ref(false)
const userFormRef = ref<FormInstance>()
const userForm = ref({ username: '', password: '', role: 'user' })

const userRules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }, { min: 3, message: '至少3位', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }]
}

const dataRange = computed(() => {
  const months = houseStore.monthList
  if (!months.length) return '-'
  return `${months[0].slice(0, 4)}-${months[0].slice(4)} ~ ${months[months.length - 1].slice(0, 4)}-${months[months.length - 1].slice(4)}`
})

const districtList = computed(() => {
  return [...new Set(houseStore.allData.map(d => d.district))]
})

const totalAllCount = computed(() =>
  houseStore.allData.reduce((sum, d) => sum + d.count, 0)
)

const totalAllArea = computed(() =>
  houseStore.allData.reduce((sum, d) => sum + d.area, 0)
)

async function loadUsers() {
  userLoading.value = true
  try {
    const data = await window.api.dbQuery('SELECT id, username, role, created FROM users ORDER BY id') as Array<{ id: number; username: string; role: string; created: string }>
    userList.value = data
  } catch (error) {
    console.error('加载用户失败:', error)
  } finally {
    userLoading.value = false
  }
}

function resetUserForm() {
  userForm.value = { username: '', password: '', role: 'user' }
}

function openAddUser() {
  dialogMode.value = 'add'
  resetUserForm()
  showUserDialog.value = true
}

function openChangePwd(row: { username: string }) {
  dialogMode.value = 'pwd'
  userForm.value = { username: row.username, password: '', role: '' }
  showUserDialog.value = true
}

async function handleUserSave() {
  if (!userFormRef.value) return
  await userFormRef.value.validate(async (valid) => {
    if (!valid) return
    userSaving.value = true

    try {
      if (dialogMode.value === 'add') {
        await window.api.dbRun(
          'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
          [userForm.value.username, userForm.value.password, userForm.value.role]
        )
        ElMessage.success('用户创建成功')
      } else {
        await window.api.dbRun(
          'UPDATE users SET password = ? WHERE username = ?',
          [userForm.value.password, userForm.value.username]
        )
        ElMessage.success('密码修改成功')
      }
      showUserDialog.value = false
      await loadUsers()
    } catch {
      ElMessage.error('操作失败，用户名可能已存在')
    } finally {
      userSaving.value = false
    }
  })
}

async function handleDeleteUser(row: { username: string }) {
  await ElMessageBox.confirm(`确定删除用户 "${row.username}" 吗？`, '确认删除', { type: 'warning' })
  try {
    await window.api.dbRun('DELETE FROM users WHERE username = ?', [row.username])
    ElMessage.success('删除成功')
    await loadUsers()
  } catch {
    // 取消
  }
}

async function handleClearData() {
  await houseStore.clearAll()
  ElMessage.success('数据已清空')
}

async function handleReimport() {
  reimporting.value = true
  await houseStore.clearAll()
  const result = await houseStore.importJson()
  reimporting.value = false
  ElMessage[result.success ? 'success' : 'error'](result.message)
}

onMounted(async () => {
  await houseStore.loadFromDb()
  await loadUsers()
})
</script>

<style scoped lang="scss">
.page-header {
  margin-bottom: 20px;

  h2 {
    font-size: 20px;
    font-weight: 600;
  }
}
</style>
