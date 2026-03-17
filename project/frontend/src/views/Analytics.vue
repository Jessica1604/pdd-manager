<template>
  <div class="analytics-page">
    <el-tabs v-model="activeTab">
      <!-- 销售数据 -->
      <el-tab-pane label="销售数据" name="sales">
        <div class="tab-toolbar">
          <el-radio-group v-model="trendDays" size="small" @change="fetchTrend">
            <el-radio-button :value="7">近7天</el-radio-button>
            <el-radio-button :value="30">近30天</el-radio-button>
          </el-radio-group>
        </div>

        <!-- 销售趋势图 -->
        <el-row :gutter="16" style="margin-top:16px">
          <el-col :span="24">
            <el-card shadow="never">
              <template #header>销售趋势</template>
              <div ref="trendChartRef" style="height:320px" v-loading="trendLoading"></div>
            </el-card>
          </el-col>
        </el-row>

        <!-- 商品分析 + 订单状态分布 -->
        <el-row :gutter="16" style="margin-top:16px">
          <el-col :span="14">
            <el-card shadow="never">
              <template #header>热销商品 TOP 10</template>
              <el-table :data="topGoods" size="small" v-loading="topGoodsLoading">
                <el-table-column type="index" label="#" width="50" />
                <el-table-column prop="goods_name" label="商品名称" show-overflow-tooltip />
                <el-table-column prop="orderCount" label="销量" width="100" sortable />
                <el-table-column prop="totalAmount" label="销售额" width="120" sortable>
                  <template #default="{ row }">¥{{ row.totalAmount?.toFixed(2) }}</template>
                </el-table-column>
              </el-table>
              <div v-if="!topGoods.length && !topGoodsLoading" class="empty">暂无数据</div>
            </el-card>
          </el-col>
          <el-col :span="10">
            <el-card shadow="never">
              <template #header>库存分析</template>
              <div v-loading="stockLoading">
                <div class="stock-stat">
                  <div class="stat-item">
                    <div class="label">低库存商品</div>
                    <div class="value danger">{{ stockAnalysis.lowStock?.length || 0 }} 件</div>
                  </div>
                  <div class="stat-item">
                    <div class="label">超库存商品</div>
                    <div class="value warning">{{ stockAnalysis.overStock?.length || 0 }} 件</div>
                  </div>
                </div>
                <el-divider />
                <div style="font-size:13px;color:#8c8c8c;margin-bottom:8px">低库存商品（≤10件）</div>
                <div v-if="stockAnalysis.lowStock?.length" class="stock-list">
                  <div v-for="item in stockAnalysis.lowStock.slice(0, 5)" :key="item.goods_id" class="stock-item">
                    <span class="name">{{ item.goods_name }}</span>
                    <el-tag type="danger" size="small">{{ item.stock }} 件</el-tag>
                  </div>
                  <div v-if="stockAnalysis.lowStock.length > 5" style="font-size:12px;color:#bfbfbf;margin-top:6px">
                    还有 {{ stockAnalysis.lowStock.length - 5 }} 件...
                  </div>
                </div>
                <div v-else class="empty small">暂无低库存商品</div>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>

      <!-- AI 分析报告 -->
      <el-tab-pane label="AI 分析报告" name="reports">
        <div class="tab-toolbar">
          <el-button type="primary" @click="generateReport('daily')" :loading="generating" :icon="Document">
            生成日报
          </el-button>
          <el-button @click="generateReport('weekly')" :loading="generating" :icon="Document">
            生成周报
          </el-button>
        </div>

        <el-alert type="info" :closable="false" style="margin-top:16px">
          AI 分析报告功能依赖 DeepSeek API，报告生成后将推送至飞书
        </el-alert>

        <el-empty description="AI 报告历史记录功能将在后续版本实现" style="margin-top:40px" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { analyticsApi } from '@/api/analytics'
import { ElMessage } from 'element-plus'
import { Document } from '@element-plus/icons-vue'
import * as echarts from 'echarts'

const activeTab = ref('sales')
const trendDays = ref(7)
const trendChartRef = ref()
const trendData = ref([])
const trendLoading = ref(false)
const topGoods = ref([])
const topGoodsLoading = ref(false)
const stockAnalysis = ref({})
const stockLoading = ref(false)
const generating = ref(false)

let trendChart = null

onMounted(async () => {
  await Promise.all([fetchTrend(), fetchTopGoods(), fetchStockAnalysis()])
  await nextTick()
  initTrendChart()
})

onUnmounted(() => {
  trendChart?.dispose()
})

watch(() => trendData.value, () => {
  updateTrendChart()
})

async function fetchTrend() {
  trendLoading.value = true
  try {
    trendData.value = await analyticsApi.getTrend(trendDays.value)
  } finally {
    trendLoading.value = false
  }
}

async function fetchTopGoods() {
  topGoodsLoading.value = true
  try {
    const endDate = new Date().toISOString().slice(0, 10)
    const startDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const rows = await analyticsApi.getTopGoods(startDate, endDate, 10)
    topGoods.value = rows.map(r => {
      let goods_name = '未知商品'
      try {
        const items = JSON.parse(r.goods_info)
        goods_name = items[0]?.goods_name || goods_name
      } catch {}
      return { goods_name, orderCount: r.orderCount, totalAmount: r.totalAmount }
    })
  } finally {
    topGoodsLoading.value = false
  }
}

async function fetchStockAnalysis() {
  stockLoading.value = true
  try {
    stockAnalysis.value = await analyticsApi.getStockAnalysis()
  } finally {
    stockLoading.value = false
  }
}

function initTrendChart() {
  if (!trendChartRef.value) return
  trendChart = echarts.init(trendChartRef.value)
  updateTrendChart()
  window.addEventListener('resize', () => trendChart?.resize())
}

function updateTrendChart() {
  if (!trendChart || !trendData.value.length) return
  const dates = trendData.value.map(d => d.date)
  const amounts = trendData.value.map(d => +d.totalAmount.toFixed(2))
  const orders = trendData.value.map(d => d.orderCount)

  trendChart.setOption({
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

async function generateReport(type) {
  generating.value = true
  try {
    if (type === 'daily') {
      await analyticsApi.generateDaily()
      ElMessage.success('日报已生成并推送至飞书')
    } else {
      await analyticsApi.generateWeekly()
      ElMessage.success('周报已生成并推送至飞书')
    }
  } catch (err) {
    ElMessage.error(err.message || '生成失败')
  } finally {
    generating.value = false
  }
}
</script>

<style scoped>
.tab-toolbar { display: flex; gap: 8px; align-items: center; }
.empty { text-align: center; color: #bfbfbf; padding: 40px 0; font-size: 14px; }
.empty.small { padding: 20px 0; font-size: 13px; }

.stock-stat {
  display: flex;
  gap: 24px;
  padding: 16px 0;
}
.stat-item {
  flex: 1;
  text-align: center;
}
.stat-item .label {
  font-size: 13px;
  color: #8c8c8c;
  margin-bottom: 8px;
}
.stat-item .value {
  font-size: 24px;
  font-weight: bold;
}
.stat-item .value.danger { color: #ff4d4f; }
.stat-item .value.warning { color: #faad14; }

.stock-list {
  max-height: 200px;
  overflow-y: auto;
}
.stock-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid #f5f5f5;
}
.stock-item .name {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 8px;
}
</style>
