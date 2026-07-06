<template>
  <div class="app-layout">
    <!-- 固定侧边栏 -->
    <el-aside :width="isCollapse ? '64px' : '220px'" class="app-aside">
      <div class="aside-logo" @click="router.push('/dashboard')">
        <span class="logo-icon"><el-icon :size="24"><HomeFilled /></el-icon></span>
        <span v-show="!isCollapse" class="logo-text">房产数据系统</span>
      </div>

      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapse"
        router
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409eff"
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <template #title>数据看板</template>
        </el-menu-item>
        <el-menu-item index="/data-manage">
          <el-icon><Folder /></el-icon>
          <template #title>数据管理</template>
        </el-menu-item>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <template #title>系统设置</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <!-- 右侧主体 -->
    <div class="main-container" :style="{ marginLeft: isCollapse ? '64px' : '220px' }">
      <!-- 头部 -->
      <el-header class="app-header">
        <div class="header-left">
          <el-icon
            class="collapse-btn"
            @click="isCollapse = !isCollapse"
          >
            <Fold v-if="!isCollapse" />
            <Expand v-else />
          </el-icon>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="currentTitle">{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-tag type="info" size="small" class="user-tag">
            {{ authStore.username }}
            <template v-if="authStore.role === 'admin'">
              (管理员)
            </template>
          </el-tag>
          <el-button type="danger" text size="small" @click="handleLogout">
            退出登录
          </el-button>
        </div>
      </el-header>

      <!-- 内容 -->
      <el-main class="app-main">
        <router-view />
      </el-main>

      <!-- 底部 -->
      <el-footer class="app-footer">
        <span>© 2026 深圳房产数据管理系统 — Made with Vue3 + Electron</span>
      </el-footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { DataAnalysis, Folder, Setting, Fold, Expand, HomeFilled } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const isCollapse = ref(false)

const activeMenu = computed(() => route.path)
const currentTitle = computed(() => route.meta.title as string || '')

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>

<style scoped lang="scss">
.app-layout {
  height: 100vh;
  overflow: hidden;
}

.app-aside {
  background-color: #304156;
  overflow: hidden;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 10;
  transition: width 0.3s;

  .aside-logo {
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);

    .logo-icon {
      font-size: 24px;
    }

    .logo-text {
      margin-left: 8px;
      font-size: 16px;
      font-weight: 600;
      color: #fff;
      white-space: nowrap;
    }
  }

  .el-menu {
    border-right: none;
  }
}

// 右侧主体容器，通过 margin-left 避开固定侧边栏
.main-container {
  margin-left: 220px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  transition: margin-left 0.3s;
}

.app-header {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e4e7ed;
  padding: 0 20px;
  height: 56px;
  flex-shrink: 0;

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;

    .collapse-btn {
      font-size: 20px;
      cursor: pointer;
      color: #606266;

      &:hover {
        color: #409eff;
      }
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;

    .user-tag {
      font-size: 12px;
    }
  }
}

.app-main {
  background: #f5f7fa;
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.app-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  font-size: 12px;
  color: #909399;
  border-top: 1px solid #e4e7ed;
  background: #fff;
  flex-shrink: 0;
}
</style>
