<template>
  <div class="orders-page">
    <el-card shadow="never">
      <!-- 搜索栏 -->
      <div class="toolbar">
        <div class="filters">
          <el-select v-model="ordersStore.params.status" placeholder="全部状态" clearable style="width:130px">
            <el-option label="待发货" value="pending" />
            <el-option label="已发货" value="shipped" />
            <el-option label="退款中" value="refund" />
          </el-select>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width:260px"
          />
          <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </div>
        <div class="actions">
          <el-button :icon="Refresh" @click="handleSync" :loading="syncing">同步订单</el-button>
          <el-button type="primary" @click="batchShipVisible = true" :disabled="!selectedRows.length">
            批量发货
          </el-button>
        </div>
      </div>

      <!-- 表格 -->
      <el-table
        :data="ordersStore.list"
        v-loading="ordersStore.loading"
        @selection-change="handleSelectionChange"
        style="margin-top:16px"
        row-key="order_sn"
      >
        <el-table-column type="selection" width="50" :selectable="(row) => row.status === 'pending'" />
        <el-table-column prop="order_sn" label="订单号" width="190" show-overflow-tooltip />
        <el-table-column prop="buyer_name" label="买家" width="90" />
        <el-table-column prop="goods_info" label="商品" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ parseGoodsName(row.goods_info) }}</template>
        </el-table-column>
        <el-table-column prop="total_amount" label="金额" width="100">
          <template #default="{ row }">¥{{ row.total_amount?.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="tracking_number" label="快递单号" width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.tracking_number || '-' }}</template>
        </el-table-column>
        <el-table-column prop="created_at" label="下单时间" width="170" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">详情</el-button>
            <el-button link type="success" v-if="row.status === 'pending'" @click="openShip(row)">
              发货
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        v-model:current-page="ordersStore.params.page"
        v-model:page-size="ordersStore.params.pageSize"
        :total="ordersStore.total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        style="margin-top:16px;justify-content:flex-end"
        @change="ordersStore.fetchList"
      />
    </el-card>

    <!-- 订单详情弹窗 -->
    <el-dialog v-model="detailVisible" title="订单详情" width="620px">
      <el-descriptions :column="2" border v-if="currentOrder">
        <el-descriptions-item label="订单号" :span="2">{{ currentOrder.order_sn }}</el-descriptions-item>
        <el-descriptions-item label="订单状态">
          <el-tag :type="statusType(currentOrder.status)">{{ statusLabel(currentOrder.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="下单时间">{{ currentOrder.created_at }}</el-descriptions-item>
        <el-descriptions-item label="买家姓名">{{ currentOrder.buyer_name }}</el-descriptions-item>
        <el-descriptions-item label="买家电话">{{ currentOrder.buyer_phone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="收货地址" :span="2">{{ currentOrder.buyer_address || '-' }}</el-descriptions-item>
        <el-descriptions-item label="商品信息" :span="2">{{ parseGoodsName(currentOrder.goods_info) }}</el-descriptions-item>
        <el-descriptions-item label="订单金额">¥{{ currentOrder.total_amount?.toFixed(2) }}</el-descriptions-item>
        <el-descriptions-item label="快递单号">{{ currentOrder.tracking_number || '-' }}</el-descriptions-item>
      </el-descriptions>

      <!-- 备注 -->
      <div style="margin-top:16px">
        <div style="font-size:13px;color:#595959;margin-bottom:8px">订单备注</div>
        <el-input
          v-model="remarkText"
          type="textarea"
          placeholder="添加备注..."
          :rows="3"
        />
        <el-button type="primary" size="small" style="margin-top:8px" @click="handleRemark" :loading="remarkSaving">
          保存备注
        </el-button>
      </div>
    </el-dialog>

    <!-- 单个发货弹窗 -->
    <el-dialog v-model="shipVisible" title="发货" width="420px">
      <el-form label-width="90px">
        <el-form-item label="订单号">
          <span style="color:#595959">{{ currentOrder?.order_sn }}</span>
        </el-form-item>
        <el-form-item label="快递公司">
          <el-input value="圆通快递" disabled />
        </el-form-item>
        <el-form-item label="快递单号">
          <el-input v-model="trackingNumber" placeholder="请输入圆通快递单号" clearable />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="shipVisible = false">取消</el-button>
        <el-button type="primary" @click="handleShip" :loading="shipping">确认发货</el-button>
      </template>
    </el-dialog>

    <!-- 批量发货弹窗 -->
    <el-dialog v-model="batchShipVisible" title="批量发货" width="520px">
      <el-alert type="info" :closable="false" style="margin-bottom:16px">
        CSV 格式：每行一条，格式为 <strong>订单号,快递单号</strong>，无需表头
      </el-alert>
      <el-upload
        drag
        accept=".csv"
        :auto-upload="false"
        :on-change="handleCsvChange"
        :on-remove="() => csvFile = null"
        :limit="1"
      >
        <el-icon :size="40" style="color:#c0c4cc"><Upload /></el-icon>
        <div style="margin-top:8px;color:#606266">拖拽或点击上传 CSV 文件</div>
      </el-upload>

      <!-- 预览解析结果 -->
      <div v-if="csvPreview.length" style="margin-top:12px">
        <div style="font-size:13px;color:#595959;margin-bottom:6px">解析预览（共 {{ csvPreview.length }} 条）</div>
        <el-table :data="csvPreview.slice(0, 5)" size="small" border>
          <el-table-column prop="orderSn" label="订单号" />
          <el-table-column prop="trackingNumber" label="快递单号" />
        </el-table>
        <div v-if="csvPreview.length > 5" style="font-size:12px;color:#8c8c8c;margin-top:4px">
          仅显示前5条...
        </div>
      </div>

      <template #footer>
        <el-button @click="batchShipVisible = false">取消</el-button>
        <el-button type="primary" @click="handleBatchShip" :loading="batchShipping" :disabled="!csvPreview.length">
          确认发货 {{ csvPreview.length ? `(${csvPreview.length}单)` : '' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useOrdersStore } from '@/stores/orders'
import { ordersApi } from '@/api/orders'
import { ElMessage } from 'element-plus'
import { Search, Refresh, Upload } from '@element-plus/icons-vue'

const ordersStore = useOrdersStore()
const dateRange = ref([])
const selectedRows = ref([])

// 详情
const detailVisible = ref(false)
const currentOrder = ref(null)
const remarkText = ref('')
const remarkSaving = ref(false)

// 单个发货
const shipVisible = ref(false)
const trackingNumber = ref('')
const shipping = ref(false)

// 批量发货
const batchShipVisible = ref(false)
const csvFile = ref(null)
const csvPreview = ref([])
const batchShipping = ref(false)

// 同步
const syncing = ref(false)

onMounted(() => ordersStore.fetchList())

function statusLabel(s) {
  return { pending: '待发货', shipped: '已发货', refund: '退款中' }[s] || s
}
function statusType(s) {
  return { pending: 'warning', shipped: 'success', refund: 'danger' }[s] || 'info'
}

function parseGoodsName(goodsInfo) {
  try {
    const items = JSON.parse(goodsInfo)
    if (Array.isArray(items) && items.length) {
      return items.map(i => i.goods_name || '商品').join('、')
    }
  } catch {}
  return goodsInfo || '-'
}

function handleSearch() {
  if (dateRange.value?.length === 2) {
    ordersStore.params.startTime = dateRange.value[0]
    ordersStore.params.endTime = dateRange.value[1]
  } else {
    ordersStore.params.startTime = ''
    ordersStore.params.endTime = ''
  }
  ordersStore.params.page = 1
  ordersStore.fetchList()
}

function handleReset() {
  dateRange.value = []
  ordersStore.params.status = ''
  ordersStore.params.startTime = ''
  ordersStore.params.endTime = ''
  ordersStore.params.page = 1
  ordersStore.fetchList()
}

function handleSelectionChange(rows) {
  selectedRows.value = rows
}

function openDetail(row) {
  currentOrder.value = row
  remarkText.value = row.remark || ''
  detailVisible.value = true
}

function openShip(row) {
  currentOrder.value = row
  trackingNumber.value = ''
  shipVisible.value = true
}

async function handleShip() {
  if (!trackingNumber.value.trim()) return ElMessage.warning('请输入快递单号')
  shipping.value = true
  try {
    await ordersStore.shipOrder(currentOrder.value.order_sn, trackingNumber.value.trim())
    shipVisible.value = false
    ElMessage.success('发货成功')
  } finally {
    shipping.value = false
  }
}

async function handleRemark() {
  remarkSaving.value = true
  try {
    // 备注保存到本地（后续可对接后端接口）
    currentOrder.value.remark = remarkText.value
    ElMessage.success('备注已保存')
  } finally {
    remarkSaving.value = false
  }
}

function handleCsvChange(file) {
  csvFile.value = file.raw
  const reader = new FileReader()
  reader.onload = (e) => {
    const lines = e.target.result.split('\n').filter(l => l.trim())
    csvPreview.value = lines.map(line => {
      const [orderSn, trackingNumber] = line.split(',').map(s => s.trim())
      return { orderSn, trackingNumber }
    }).filter(r => r.orderSn && r.trackingNumber)
  }
  reader.readAsText(file.raw)
}

async function handleBatchShip() {
  if (!csvPreview.value.length) return ElMessage.warning('请上传有效的 CSV 文件')
  batchShipping.value = true
  try {
    await ordersStore.batchShip(csvPreview.value)
    batchShipVisible.value = false
    csvPreview.value = []
    csvFile.value = null
    ElMessage.success(`批量发货成功，共 ${csvPreview.value.length} 单`)
  } finally {
    batchShipping.value = false
  }
}

async function handleSync() {
  syncing.value = true
  try {
    await ordersApi.sync()
    await ordersStore.fetchList()
    ElMessage.success('订单同步成功')
  } finally {
    syncing.value = false
  }
}
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.filters { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.actions { display: flex; gap: 8px; }
</style>
