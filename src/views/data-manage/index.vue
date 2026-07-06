<template>
  <div class="data-manage">
    <div class="page-header flex-between">
      <h2><el-icon><List /></el-icon> 数据管理</h2>
      <div class="header-actions">
        <el-button
          :loading="importing"
          type="primary"
          @click="handleImport"
        >
          <el-icon><Download /></el-icon> 从 JSON 导入
        </el-button>
        <el-button
          :loading="fetching"
          type="warning"
          @click="handleFetchFromApi"
        >
          <el-icon><Connection /></el-icon> 从接口获取当月数据
        </el-button>
        <el-button
          :loading="exporting"
          @click="handleExport"
        >
          <el-icon><Upload /></el-icon> 导出到 JSON
        </el-button>
        <el-button type="success" @click="openAddDialog">
          <el-icon><CirclePlus /></el-icon> 新增记录
        </el-button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <el-card shadow="never" style="margin-bottom: 16px">
      <el-row :gutter="20" align="middle">
        <el-col :span="6">
          <el-select v-model="filterDistrict" placeholder="区域筛选" clearable style="width: 100%">
            <el-option
              v-for="d in districts"
              :key="d"
              :label="d"
              :value="d"
            />
          </el-select>
        </el-col>
        <el-col :span="8">
          <el-date-picker
            v-model="filterMonthRange"
            type="monthrange"
            range-separator="至"
            start-placeholder="开始月份"
            end-placeholder="结束月份"
            format="YYYY-MM"
            value-format="YYYYMM"
            style="width: 100%"
          />
        </el-col>
        <el-col :span="4">
          <el-button @click="resetFilter">重置</el-button>
        </el-col>
        <el-col :span="6" class="text-right">
          <span class="text-muted">共 {{ filteredData.length }} 条记录</span>
        </el-col>
      </el-row>
    </el-card>

    <!-- 数据表格 -->
    <el-card shadow="hover">
      <el-table
        :data="pagedData"
        v-loading="houseStore.loading"
        stripe
        border
        style="width: 100%"
        max-height="520"
      >
        <el-table-column prop="year_month" label="月份" width="100" sortable>
          <template #default="{ row }">
            {{ formatMonth(row.year_month) }}
          </template>
        </el-table-column>
        <el-table-column prop="district" label="区域" width="80" />
        <el-table-column prop="count" label="成交套数" width="100" sortable />
        <el-table-column prop="area" label="成交面积(m²)" width="130" sortable>
          <template #default="{ row }">
            {{ row.area.toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column label="套均面积(m²)" min-width="120">
          <template #default="{ row }">
            {{ row.count > 0 ? (row.area / row.count).toFixed(1) : '-' }}
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="flex-between mt-16">
        <span class="text-muted">
          显示第 {{ (currentPage - 1) * pageSize + 1 }} 到
          {{ Math.min(currentPage * pageSize, filteredData.length) }} 条
        </span>
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="filteredData.length"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          size="small"
          background
        />
      </div>
    </el-card>

    <!-- 编辑/新增对话框 -->
    <el-dialog
      v-model="showEditDialog"
      :title="editingId ? '编辑记录' : '新增记录'"
      width="460px"
      @close="resetEditForm"
    >
      <el-form ref="formRef" :model="editForm" :rules="editRules" label-width="90px">
        <el-form-item label="月份" prop="year_month">
          <el-date-picker
            v-model="editForm.year_month"
            type="month"
            placeholder="选择月份"
            format="YYYY-MM"
            value-format="YYYYMM"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="区域" prop="district">
          <el-select v-model="editForm.district" placeholder="选择区域" style="width: 100%">
            <el-option
              v-for="d in districts"
              :key="d"
              :label="d"
              :value="d"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="成交套数" prop="count">
          <el-input-number v-model="editForm.count" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="成交面积(m²)" prop="area">
          <el-input-number v-model="editForm.area" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Upload, Connection, CirclePlus, List } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { useHouseStore } from '@/stores/house'
import type { HouseRecord } from '@/stores/house'

const houseStore = useHouseStore()

const districts = ['南山', '福田', '龙岗', '宝安', '罗湖', '盐田', '龙华', '坪山', '光明', '大鹏', '深汕']

const filterDistrict = ref('')
const filterMonthRange = ref<[string, string] | null>(null)
const currentPage = ref(1)
const pageSize = ref(20)
const importing = ref(false)
const exporting = ref(false)
const fetching = ref(false)

// 编辑表单
const showEditDialog = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const formRef = ref<FormInstance>()

const editForm = ref({
  year_month: '',
  district: '',
  count: 0,
  area: 0
})

const editRules: FormRules = {
  year_month: [{ required: true, message: '请选择月份', trigger: 'change' }],
  district: [{ required: true, message: '请选择区域', trigger: 'change' }],
  count: [{ required: true, message: '请输入成交套数', trigger: 'blur' }],
  area: [{ required: true, message: '请输入成交面积', trigger: 'blur' }]
}

// 筛选后的数据
const filteredData = computed(() => {
  let data = houseStore.allData

  if (filterDistrict.value) {
    data = data.filter(d => d.district === filterDistrict.value)
  }

  if (filterMonthRange.value && filterMonthRange.value.length === 2) {
    const [start, end] = filterMonthRange.value
    data = data.filter(d => d.year_month >= start && d.year_month <= end)
  }

  return data
})

// 分页数据
const pagedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredData.value.slice(start, start + pageSize.value)
})

function formatMonth(ym: string) {
  return `${ym.slice(0, 4)}-${ym.slice(4)}`
}

function resetFilter() {
  filterDistrict.value = ''
  filterMonthRange.value = null
  currentPage.value = 1
}

function resetEditForm() {
  editForm.value = { year_month: '', district: '', count: 0, area: 0 }
  editingId.value = null
}

function openAddDialog() {
  resetEditForm()
  showEditDialog.value = true
}

function openEdit(row: HouseRecord) {
  editingId.value = row.id || null
  editForm.value = {
    year_month: row.year_month,
    district: row.district,
    count: row.count,
    area: row.area
  }
  showEditDialog.value = true
}

async function handleSave() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    saving.value = true

    try {
      if (editingId.value) {
        await houseStore.updateRecord({
          id: editingId.value,
          ...editForm.value
        } as HouseRecord)
        ElMessage.success('更新成功')
      } else {
        await houseStore.addRecord(editForm.value)
        ElMessage.success('添加成功')
      }
      showEditDialog.value = false
    } catch {
      ElMessage.error('操作失败')
    } finally {
      saving.value = false
    }
  })
}

async function handleDelete(row: HouseRecord) {
  await ElMessageBox.confirm(
    `确定删除 ${formatMonth(row.year_month)} ${row.district} 的记录吗？`,
    '确认删除',
    { type: 'warning' }
  )
  try {
    await houseStore.deleteRecord(row.id!)
    ElMessage.success('删除成功')
  } catch {
    // 取消
  }
}

async function handleImport() {
  importing.value = true
  const result = await houseStore.importJson()
  importing.value = false
  ElMessage[result.success ? 'success' : 'error'](result.message)
}

async function handleExport() {
  exporting.value = true
  const result = await houseStore.exportJson()
  exporting.value = false
  ElMessage[result.success ? 'success' : 'info'](result.message)
}

async function handleFetchFromApi() {
  fetching.value = true
  try {
    // 1. 请求接口
    const result = await houseStore.fetchFromApi()
    if (!result.success || !result.data) {
      ElMessage.error(result.message || '接口请求失败')
      return
    }

    const { yearMonth, xmlDateMonth, dataMj, dataTs } = result.data

    // 2. 检查是否已存在该月数据
    const existsResult = await houseStore.checkExists(yearMonth)
    if (existsResult.exists) {
      // 弹框确认是否覆盖
      await ElMessageBox.confirm(
        `${xmlDateMonth}（${yearMonth}）的数据已存在，是否重新获取并覆盖？`,
        '数据已存在',
        {
          confirmButtonText: '继续覆盖',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
    }

    // 3. 保存数据
    const saveResult = await houseStore.saveApiData({ yearMonth, xmlDateMonth, dataMj, dataTs })
    if (saveResult.success) {
      ElMessage.success(saveResult.message)
    } else {
      ElMessage.error(saveResult.message)
    }
  } catch {
    // 用户取消操作
  } finally {
    fetching.value = false
  }
}

onMounted(async () => {
  await houseStore.loadFromDb()
})
</script>

<style scoped lang="scss">
.page-header {
  margin-bottom: 20px;

  h2 {
    font-size: 20px;
    font-weight: 600;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }
}
</style>
