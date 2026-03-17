<template>
  <div class="settings-page">
    <el-row :gutter="16">
      <!-- 飞书通知 -->
      <el-col :span="12">
        <el-card shadow="never" header="飞书通知配置">
          <el-form :model="form" label-width="140px" v-loading="loading">
            <el-form-item label="Webhook 地址">
              <el-input
                v-model="form.feishu_webhook_url"
                placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
                clearable
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="save('feishu')" :loading="saving.feishu">保存</el-button>
              <el-button @click="testWebhook" :loading="testing" style="margin-left:8px">测试通知</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <!-- 库存预警 -->
      <el-col :span="12">
        <el-card shadow="never" header="库存预警配置">
          <el-form :model="form" label-width="140px" v-loading="loading">
            <el-form-item label="预警阈值（件）">
              <el-input-number
                v-model="form.stock_warning_threshold"
                :min="1" :max="9999"
                style="width:160px"
              />
              <span style="margin-left:8px;color:#8c8c8c;font-size:13px">库存低于此值时飞书告警</span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="save('stock')" :loading="saving.stock">保存</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <!-- 定时任务 -->
      <el-col :span="12" style="margin-top:16px">
        <el-card shadow="never" header="定时任务配置">
          <el-form :model="form" label-width="140px" v-loading="loading">
            <el-form-item label="订单同步">
              <el-switch v-model="form.job_order_enabled" />
              <span class="job-desc">每 5 分钟自动同步待发货订单</span>
            </el-form-item>
            <el-form-item label="库存检查">
              <el-switch v-model="form.job_stock_enabled" />
              <span class="job-desc">每 1 小时检查库存预警</span>
            </el-form-item>
            <el-form-item label="日报生成">
              <el-switch v-model="form.job_report_enabled" />
              <span class="job-desc">每天 00:00 生成并推送日报</span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="save('job')" :loading="saving.job">保存</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <!-- DeepSeek AI -->
      <el-col :span="12" style="margin-top:16px">
        <el-card shadow="never" header="DeepSeek AI 配置">
          <el-form :model="form" label-width="140px" v-loading="loading">
            <el-form-item label="每日调用上限">
              <el-input-number
                v-model="form.deepseek_daily_limit"
                :min="0" :max="99999"
                style="width:160px"
              />
              <span style="margin-left:8px;color:#8c8c8c;font-size:13px">次/天</span>
            </el-form-item>
            <el-form-item label="今日已调用">
              <el-progress
                :percentage="aiUsagePercent"
                :color="aiUsagePercent > 80 ? '#ff4d4f' : '#1890ff'"
                style="width:200px;display:inline-flex;align-items:center"
              />
              <span style="margin-left:8px;color:#595959;font-size:13px">
                {{ aiStats.todayCount || 0 }} / {{ form.deepseek_daily_limit }} 次
              </span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="save('ai')" :loading="saving.ai">保存</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <!-- 操作日志 -->
      <el-col :span="24" style="margin-top:16px">
        <el-card shadow="never">
          <template #header>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span>操作日志</span>
              <el-button size="small" :icon="Refresh" @click="fetchLogs(1)">刷新</el-button>
            </div>
          </template>
          <el-table :data="logs" v-loading="logsLoading" size="small" max-height="360">
            <el-table-column prop="created_at" label="时间" width="180" />
            <el-table-column prop="action" label="操作" width="180" show-overflow-tooltip />
            <el-table-column prop="detail" label="详情" min-width="300" show-overflow-tooltip />
            <el-table-column prop="status" label="结果" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status === 'success' ? 'success' : 'danger'" size="small">
                  {{ row.status === 'success' ? '成功' : '失败' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="!logs.length && !logsLoading" class="empty">暂无操作日志</div>
          <el-pagination
            v-if="logsTotal > 20"
            v-model:current-page="logsPage"
            :page-size="20"
            :total="logsTotal"
            layout="total, prev, pager, next"
            style="margin-top:12px;justify-content:flex-end"
            @current-change="fetchLogs"
          />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import request from '@/api/request'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'

const loading = ref(false)
const saving = ref({ feishu: false, stock: false, job: false, ai: false })
const testing = ref(false)
const logsLoading = ref(false)
const logsPage = ref(1)
const logsTotal = ref(0)
const logs = ref([])
const aiStats = ref({})

const form = ref({
  feishu_webhook_url: '',
  stock_warning_threshold: 10,
  job_order_enabled: true,
  job_stock_enabled: true,
  job_report_enabled: true,
  deepseek_daily_limit: 1000
})

const aiUsagePercent = computed(() => {
  const limit = form.value.deepseek_daily_limit
  if (!limit) return 0
  return Math.min(100, Math.round(((aiStats.value.todayCount || 0) / limit) * 100))
})

onMounted(async () => {
  await Promise.all([fetchConfig(), fetchLogs(1)])
})

async function fetchConfig() {
  loading.value = true
  try {
    const data = await request.get('/settings')
    Object.assign(form.value, {
      feishu_webhook_url: data.feishu_webhook_url || '',
      stock_warning_threshold: data.stock_warning_threshold ?? 10,
      job_order_enabled: data.job_order_enabled !== false,
      job_stock_enabled: data.job_stock_enabled !== false,
      job_report_enabled: data.job_report_enabled !== false,
      deepseek_daily_limit: data.deepseek_daily_limit ?? 1000
    })
    aiStats.value = data.ai_stats || {}
  } finally {
    loading.value = false
  }
}

const saveKeys = {
  feishu: ['feishu_webhook_url'],
  stock: ['stock_warning_threshold'],
  job: ['job_order_enabled', 'job_stock_enabled', 'job_report_enabled'],
  ai: ['deepseek_daily_limit']
}

async function save(type) {
  saving.value[type] = true
  try {
    const payload = {}
    for (const key of saveKeys[type]) {
      payload[key] = form.value[key]
    }
    await request.put('/settings', payload)
    ElMessage.success('保存成功')
  } finally {
    saving.value[type] = false
  }
}

async function testWebhook() {
  if (!form.value.feishu_webhook_url) {
    return ElMessage.warning('请先填写 Webhook 地址并保存')
  }
  testing.value = true
  try {
    await request.post('/settings/test-webhook')
    ElMessage.success('测试通知已发送，请查看飞书')
  } finally {
    testing.value = false
  }
}

async function fetchLogs(page = 1) {
  logsLoading.value = true
  logsPage.value = page
  try {
    const data = await request.get('/settings/logs', { params: { page, pageSize: 20 } })
    logs.value = data.list
    logsTotal.value = data.total
  } finally {
    logsLoading.value = false
  }
}
</script>

<style scoped>
.job-desc { margin-left: 10px; font-size: 13px; color: #8c8c8c; }
.empty { text-align: center; color: #bfbfbf; padding: 32px 0; font-size: 14px; }
</style>
