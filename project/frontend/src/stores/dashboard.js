import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dashboardApi } from '@/api/dashboard'

// 单店铺系统，shopId 固定为 1
const SHOP_ID = 1

export const useDashboardStore = defineStore('dashboard', () => {
  const summary = ref(null)
  const trend = ref([])
  const topGoods = ref([])
  const stockWarnings = ref([])
  const loading = ref(false)

  async function fetchAll(days = 7) {
    loading.value = true
    try {
      const [s, t, g, w] = await Promise.all([
        dashboardApi.getSummary(SHOP_ID),
        dashboardApi.getTrend(SHOP_ID, days),
        dashboardApi.getTopGoods(SHOP_ID),
        dashboardApi.getStockWarnings(SHOP_ID)
      ])
      summary.value = s
      trend.value = t
      topGoods.value = g
      stockWarnings.value = w
    } finally {
      loading.value = false
    }
  }

  async function fetchTrend(days) {
    trend.value = await dashboardApi.getTrend(SHOP_ID, days)
  }

  return { summary, trend, topGoods, stockWarnings, loading, fetchAll, fetchTrend }
})
