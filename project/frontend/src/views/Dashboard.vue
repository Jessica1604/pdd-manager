<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <el-row :gutter="16">
      <el-col :span="6" v-for="card in statCards" :key="card.key">
        <el-card shadow="never" class="stat-card" v-loading="dashboardStore.loading">
          <div class="stat-content">
            <div class="stat-info">
              <div class="stat-label">{{ card.label }}</div>
              <div class="stat-value" :style="{ color: card.color }">{{ card.value }}</div>
            </div>
            <div class="stat-icon" :style="{ background: card.color + '1a' }">
              <el-icon :size="28" :color="card.color"><component :is="card.icon" /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 趋势图 + TOP 10 -->
    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="16">
        <el-card shadow="never">
          <template #header>
            <div class="card-header">
              <span>销售趋势</span>
              <el-radio-group v-model="trendDays" size="small" @change="onTrendChange">
                <el-radio-button :value="7">近7天</el-radio-button>
                <el-radio-button :value="30">近30天</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="trendChartRef" style="height:300px"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never" style="height:100%">
          <template #header>热销商品 TOP 10</template>
          <div v-if="!dashboardStore.topGoods.length" class="empty">暂无数据</div>
          <div v-for="(item, i) in dashboardStore.topGoods" :key="i" class="top-item">
            <span class="rank" :class="i < 3 ? 'top3' : ''">{{ i + 1 }}</span>
            <span class="name" :title="item.name">{{ item.name }}</span>
            <span class="count">{{ item.sales }}单</span>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 库存预警 -->
    <el-card shadow="never" style="margin-top:16px">
      <template #header>
        <div class="card-header">
          <span>库存预警</span>
          <el-tag type="danger" v-if="dashboardStore.stockWarnings.length">
            {{ dashboardStore.stockWarnings.length }} 件商品库存不足
          </el-tag>
        </div>
      </template>
      <el-table :data="dashboardStore.stockWarnings" size="small">
        <el-table-column prop="goods_id" label="商品ID" width="140" />
        <el-table-column prop="goods_name" label="商品名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="stock" label="当前库存" width="120">
          <template #default="{ row }">
            <el-tag type="danger" effect="dark">{{ row.stock }} 件</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default>
            <el-tag type="success" size="small">上架中</el-tag>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="!dashboardStore.stockWarnings.length" class="empty">暂无库存预警</div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useDashboardStore } from '@/stores/dashboard'
import * as echarts from 'echarts'

const dashboardStore = useDashboardStore()
const trendChartRef = ref()
const trendDays = ref(7)
let chart = null

const statCards = computed(() => {
  const s = dashboardStore.summary
  return [
    { key: 'sales',    label: '今日销售额', value: `¥${s?.todaySales ?? 0}`,   color: '#e02020', icon: 'Money' },
    { key: 'orders',   label: '今日订单量', value: s?.todayOrders ?? 0,         color: '#1890ff', icon: 'ShoppingCart' },
    { key: 'refunds',  label: '今日退款量', value: s?.todayRefunds ?? 0,        color: '#faad14', icon: 'RefreshLeft' },
    { key: 'warnings', label: '库存预警',   value: s?.stockWarnings ?? 0,       color: '#ff4d4f', icon: 'Warning' }
  ]
})

onMounted(async () => {
  await dashboardStore.fetchAll(trendDays.value)
  await nextTick()
  initChart()
})

onUnmounted(() => {
  chart?.dispose()
})

watch(() => dashboardStore.trend, () => {
  updateChart()
})

async function onTrendChange(days) {
  await dashboardStore.fetchTrend(days)
}

function initChart() {
  if (!trendChartRef.value) return
  chart = echarts.init(trendChartRef.value)
  updateChart()
  window.addEventListener('resize', () => chart?.resize())
}

function updateChart() {
  if (!chart) return
  const data = dashboardStore.trend
  const dates = data.map(d => d.date)
  const amounts = data.map(d => +d.totalAmount.toFixed(2))
  const orders = data.map(d => d.orderCount)

  chart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: ['销售额(元)', '订单量'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: dates, boundaryGap: false },
    yAxis: [
      { type: 'value', name: '销售额', axisLabel: { formatter: '¥{value}' } },
      { type: 'value', name: '订单量' }
    ],
    series: [
      {
        name: '销售额(元)',
        type: 'line',
        smooth: true,
        data: amounts,
        yAxisIndex: 0,
        itemStyle: { color: '#e02020' },
        areaStyle: { color: 'rgba(224,32,32,0.08)' }
      },
      {
        name: '订单量',
        type: 'bar',
        data: orders,
        yAxisIndex: 1,
        itemStyle: { color: '#1890ff' }
      }
    ]
  })
}
</script>

<style scoped>
.stat-card { border-radius: 8px; }
.stat-content { display: flex; justify-content: space-between; align-items: center; }
.stat-label { font-size: 14px; color: #8c8c8c; margin-bottom: 8px; }
.stat-value { font-size: 28px; font-weight: bold; }
.stat-icon { width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.top-item { display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid #f5f5f5; gap: 10px; }
.rank { width: 22px; height: 22px; border-radius: 50%; background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; flex-shrink: 0; }
.rank.top3 { background: #e02020; color: #fff; }
.name { flex: 1; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.count { font-size: 13px; color: #8c8c8c; flex-shrink: 0; }
.empty { text-align: center; color: #bfbfbf; padding: 32px 0; font-size: 14px; }
</style>
