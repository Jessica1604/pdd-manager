<template>
  <div class="goods-page">
    <el-card shadow="never">
      <!-- 搜索栏 -->
      <div class="toolbar">
        <div class="filters">
          <el-input
            v-model="goodsStore.params.keyword"
            placeholder="搜索商品名称"
            clearable
            style="width:220px"
            @keyup.enter="handleSearch"
          />
          <el-select v-model="goodsStore.params.status" placeholder="全部状态" clearable style="width:140px">
            <el-option label="上架中" value="on" />
            <el-option label="已下架" value="off" />
          </el-select>
          <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </div>
        <div class="actions">
          <el-button :icon="Refresh" @click="handleSync" :loading="syncing">同步商品</el-button>
          <el-button type="success" @click="batchOnShelf" :disabled="!selectedIds.length">批量上架</el-button>
          <el-button type="warning" @click="batchOffShelf" :disabled="!selectedIds.length">批量下架</el-button>
        </div>
      </div>

      <!-- 表格 -->
      <el-table
        :data="goodsStore.list"
        v-loading="goodsStore.loading"
        @selection-change="handleSelectionChange"
        style="margin-top:16px"
      >
        <el-table-column type="selection" width="50" />

        <!-- 商品图片 -->
        <el-table-column label="图片" width="80">
          <template #default="{ row }">
            <el-image
              v-if="row.image_url"
              :src="row.image_url"
              :preview-src-list="[row.image_url]"
              :preview-teleported="true"
              fit="cover"
              style="width:48px;height:48px;border-radius:4px;cursor:pointer"
            />
            <div v-else class="no-img">
              <el-icon color="#d9d9d9" :size="24"><Picture /></el-icon>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="goods_id" label="商品ID" width="130" />
        <el-table-column prop="goods_name" label="商品名称" min-width="200" show-overflow-tooltip />

        <el-table-column prop="price" label="价格" width="100">
          <template #default="{ row }">¥{{ row.price?.toFixed(2) }}</template>
        </el-table-column>

        <!-- 库存行内编辑 -->
        <el-table-column prop="stock" label="库存" width="140">
          <template #default="{ row }">
            <div class="stock-cell" v-if="editingStockId !== row.goods_id" @click="startEditStock(row)">
              <el-tag :type="row.stock < 10 ? 'danger' : 'success'" style="cursor:pointer">
                {{ row.stock }}
              </el-tag>
              <el-icon class="edit-icon" :size="12"><Edit /></el-icon>
            </div>
            <div v-else class="stock-edit">
              <el-input-number
                v-model="editingStockVal"
                :min="0"
                size="small"
                style="width:90px"
                @keyup.enter="saveStock(row)"
                @keyup.esc="cancelEditStock"
                ref="stockInputRef"
              />
              <el-button type="primary" link :icon="Check" @click="saveStock(row)" />
              <el-button type="info" link :icon="Close" @click="cancelEditStock" />
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'on' ? 'success' : 'info'">
              {{ row.status === 'on' ? '上架中' : '已下架' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button
              link
              :type="row.status === 'on' ? 'warning' : 'success'"
              @click="toggleStatus(row)"
            >
              {{ row.status === 'on' ? '下架' : '上架' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        v-model:current-page="goodsStore.params.page"
        v-model:page-size="goodsStore.params.pageSize"
        :total="goodsStore.total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        style="margin-top:16px;justify-content:flex-end"
        @change="goodsStore.fetchList"
      />
    </el-card>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="editVisible" title="编辑商品" width="520px">
      <el-form :model="editForm" label-width="90px">
        <!-- 图片预览 -->
        <el-form-item label="商品图片">
          <div class="img-preview">
            <el-image
              v-if="editForm.image_url"
              :src="editForm.image_url"
              :preview-src-list="[editForm.image_url]"
              :preview-teleported="true"
              fit="cover"
              style="width:80px;height:80px;border-radius:6px"
            />
            <div v-else class="no-img large">
              <el-icon color="#d9d9d9" :size="36"><Picture /></el-icon>
            </div>
            <el-input
              v-model="editForm.image_url"
              placeholder="图片 URL"
              style="margin-left:12px;flex:1"
            />
          </div>
        </el-form-item>
        <el-form-item label="商品名称">
          <el-input v-model="editForm.goods_name" />
        </el-form-item>
        <el-form-item label="价格(元)">
          <el-input-number v-model="editForm.price" :precision="2" :min="0" style="width:160px" />
        </el-form-item>
        <el-form-item label="库存">
          <el-input-number v-model="editForm.stock" :min="0" style="width:160px" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted } from 'vue'
import { useGoodsStore } from '@/stores/goods'
import { goodsApi } from '@/api/goods'
import { ElMessage } from 'element-plus'
import { Search, Refresh, Edit, Check, Close, Picture } from '@element-plus/icons-vue'

const goodsStore = useGoodsStore()
const selectedIds = ref([])
const editVisible = ref(false)
const editForm = ref({})
const saving = ref(false)
const syncing = ref(false)

// 库存行内编辑
const editingStockId = ref(null)
const editingStockVal = ref(0)
const stockInputRef = ref()

onMounted(() => goodsStore.fetchList())

function handleSearch() {
  goodsStore.params.page = 1
  goodsStore.fetchList()
}

function handleReset() {
  goodsStore.params.keyword = ''
  goodsStore.params.status = ''
  goodsStore.params.page = 1
  goodsStore.fetchList()
}

function handleSelectionChange(rows) {
  selectedIds.value = rows.map(r => r.goods_id)
}

function openEdit(row) {
  editForm.value = { ...row }
  editVisible.value = true
}

async function handleSave() {
  saving.value = true
  try {
    await goodsStore.updateGoods(editForm.value.goods_id, {
      goodsName: editForm.value.goods_name,
      price: editForm.value.price,
      stock: editForm.value.stock,
      image_url: editForm.value.image_url
    })
    editVisible.value = false
    ElMessage.success('保存成功')
  } finally {
    saving.value = false
  }
}

async function toggleStatus(row) {
  await goodsStore.batchUpdateStatus([row.goods_id], row.status !== 'on')
  ElMessage.success('操作成功')
}

async function batchOnShelf() {
  await goodsStore.batchUpdateStatus(selectedIds.value, true)
  ElMessage.success('批量上架成功')
}

async function batchOffShelf() {
  await goodsStore.batchUpdateStatus(selectedIds.value, false)
  ElMessage.success('批量下架成功')
}

async function handleSync() {
  syncing.value = true
  try {
    await goodsApi.sync()
    await goodsStore.fetchList()
    ElMessage.success('同步成功')
  } finally {
    syncing.value = false
  }
}

// 库存行内编辑
function startEditStock(row) {
  editingStockId.value = row.goods_id
  editingStockVal.value = row.stock
  nextTick(() => stockInputRef.value?.focus())
}

async function saveStock(row) {
  if (editingStockVal.value === row.stock) {
    cancelEditStock()
    return
  }
  try {
    await goodsStore.updateStock(row.goods_id, editingStockVal.value)
    ElMessage.success('库存已更新')
  } finally {
    cancelEditStock()
  }
}

function cancelEditStock() {
  editingStockId.value = null
  editingStockVal.value = 0
}
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.filters { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.actions { display: flex; gap: 8px; }

.no-img {
  width: 48px; height: 48px;
  background: #fafafa;
  border: 1px dashed #d9d9d9;
  border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
}
.no-img.large { width: 80px; height: 80px; }

.stock-cell {
  display: flex; align-items: center; gap: 6px; cursor: pointer;
}
.edit-icon { color: #bfbfbf; opacity: 0; transition: opacity 0.2s; }
.stock-cell:hover .edit-icon { opacity: 1; }

.stock-edit { display: flex; align-items: center; gap: 2px; }

.img-preview { display: flex; align-items: center; }
</style>
