<template>
  <div class="customer-page">
    <el-tabs v-model="activeTab">
      <!-- 消息记录 -->
      <el-tab-pane label="消息记录" name="messages">
        <el-table :data="messages" v-loading="loading" style="margin-top:8px">
          <el-table-column prop="user_id" label="用户ID" width="150" />
          <el-table-column prop="message" label="消息内容" min-width="200" show-overflow-tooltip />
          <el-table-column prop="reply" label="回复内容" min-width="200" show-overflow-tooltip />
          <el-table-column prop="reply_type" label="回复类型" width="100">
            <template #default="{ row }">
              <el-tag :type="replyTypeTag(row.reply_type)">{{ replyTypeLabel(row.reply_type) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="created_at" label="时间" width="180" />
        </el-table>
        <el-pagination
          v-model:current-page="msgPage"
          :page-size="20"
          :total="msgTotal"
          layout="total, prev, pager, next"
          style="margin-top:12px;justify-content:flex-end"
          @current-change="fetchMessages"
        />
      </el-tab-pane>

      <!-- 回复模板 -->
      <el-tab-pane label="回复模板" name="templates">
        <div style="margin-bottom:12px">
          <el-button type="primary" :icon="Plus" @click="openTemplateDialog()">新增模板</el-button>
        </div>
        <el-table :data="templates" v-loading="tplLoading">
          <el-table-column prop="name" label="模板名称" width="180" />
          <el-table-column prop="content" label="模板内容" min-width="300" show-overflow-tooltip />
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button link type="primary" @click="openTemplateDialog(row)">编辑</el-button>
              <el-button link type="danger" @click="deleteTemplate(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 关键词规则 -->
      <el-tab-pane label="关键词规则" name="rules">
        <div style="margin-bottom:12px">
          <el-button type="primary" :icon="Plus" @click="openRuleDialog()">新增规则</el-button>
        </div>
        <el-table :data="rules" v-loading="ruleLoading">
          <el-table-column prop="keyword" label="关键词" width="200" />
          <el-table-column prop="reply" label="自动回复内容" min-width="300" show-overflow-tooltip />
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button link type="primary" @click="openRuleDialog(row)">编辑</el-button>
              <el-button link type="danger" @click="deleteRule(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 模板弹窗 -->
    <el-dialog v-model="tplVisible" :title="tplForm.id ? '编辑模板' : '新增模板'" width="500px">
      <el-form :model="tplForm" label-width="90px">
        <el-form-item label="模板名称">
          <el-input v-model="tplForm.name" />
        </el-form-item>
        <el-form-item label="模板内容">
          <el-input v-model="tplForm.content" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="tplVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTemplate" :loading="tplSaving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 规则弹窗 -->
    <el-dialog v-model="ruleVisible" :title="ruleForm.id ? '编辑规则' : '新增规则'" width="500px">
      <el-form :model="ruleForm" label-width="90px">
        <el-form-item label="关键词">
          <el-input v-model="ruleForm.keyword" placeholder="多个关键词用逗号分隔" />
        </el-form-item>
        <el-form-item label="自动回复">
          <el-input v-model="ruleForm.reply" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ruleVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRule" :loading="ruleSaving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { customerApi } from '@/api/customer'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'

const activeTab = ref('messages')
const messages = ref([])
const loading = ref(false)
const msgPage = ref(1)
const msgTotal = ref(0)
const templates = ref([])
const tplLoading = ref(false)
const rules = ref([])
const ruleLoading = ref(false)

const tplVisible = ref(false)
const tplForm = ref({})
const tplSaving = ref(false)
const ruleVisible = ref(false)
const ruleForm = ref({})
const ruleSaving = ref(false)

onMounted(() => {
  fetchMessages()
  fetchTemplates()
  fetchRules()
})

function replyTypeLabel(t) {
  return { auto: '自动', ai: 'AI', manual: '人工' }[t] || t
}
function replyTypeTag(t) {
  return { auto: 'info', ai: 'success', manual: 'warning' }[t] || 'info'
}

async function fetchMessages(page = 1) {
  loading.value = true
  try {
    const data = await customerApi.getMessages({ page, pageSize: 20 })
    messages.value = data.list
    msgTotal.value = data.total
  } finally {
    loading.value = false
  }
}

async function fetchTemplates() {
  tplLoading.value = true
  try { templates.value = await customerApi.getTemplates() }
  finally { tplLoading.value = false }
}

async function fetchRules() {
  ruleLoading.value = true
  try { rules.value = await customerApi.getRules() }
  finally { ruleLoading.value = false }
}

function openTemplateDialog(row = {}) {
  tplForm.value = { ...row }
  tplVisible.value = true
}

async function saveTemplate() {
  tplSaving.value = true
  try {
    if (tplForm.value.id) {
      await customerApi.updateTemplate(tplForm.value.id, tplForm.value)
    } else {
      await customerApi.createTemplate(tplForm.value)
    }
    tplVisible.value = false
    ElMessage.success('保存成功')
    fetchTemplates()
  } finally {
    tplSaving.value = false
  }
}

async function deleteTemplate(row) {
  await ElMessageBox.confirm('确认删除该模板？', '提示', { type: 'warning' })
  await customerApi.deleteTemplate(row.id)
  ElMessage.success('删除成功')
  fetchTemplates()
}

function openRuleDialog(row = {}) {
  ruleForm.value = { ...row }
  ruleVisible.value = true
}

async function saveRule() {
  ruleSaving.value = true
  try {
    if (ruleForm.value.id) {
      await customerApi.updateRule(ruleForm.value.id, ruleForm.value)
    } else {
      await customerApi.createRule(ruleForm.value)
    }
    ruleVisible.value = false
    ElMessage.success('保存成功')
    fetchRules()
  } finally {
    ruleSaving.value = false
  }
}

async function deleteRule(row) {
  await ElMessageBox.confirm('确认删除该规则？', '提示', { type: 'warning' })
  await customerApi.deleteRule(row.id)
  ElMessage.success('删除成功')
  fetchRules()
}
</script>
