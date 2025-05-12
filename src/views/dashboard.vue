<template>
  <div class="dashboard-container">
    <el-row :gutter="20">
      <!-- CPU Usage -->
      <el-col :span="6">
        <el-card class="metric-card">
          <div class="metric-title">CPU</div>
          <div class="metric-value">
            <span class="value">12</span>
            <span class="unit">%</span>
          </div>
          <div class="metric-chart">
            <el-progress
              :percentage="12"
              :show-text="false"
              :stroke-width="4"
              status="success"
            />
          </div>
        </el-card>
      </el-col>

      <!-- Memory Usage -->
      <el-col :span="6">
        <el-card class="metric-card">
          <div class="metric-title">Memory</div>
          <div class="metric-value">
            <span class="value">145</span>
            <span class="unit">MiB</span>
          </div>
          <div class="metric-chart">
            <el-progress
              :percentage="55"
              :show-text="false"
              :stroke-width="4"
              status="warning"
            />
          </div>
        </el-card>
      </el-col>

      <!-- Event Loop Lag -->
      <el-col :span="6">
        <el-card class="metric-card">
          <div class="metric-title">Event Loop Lag</div>
          <div class="metric-value">
            <span class="value">0.1</span>
            <span class="unit">ms</span>
          </div>
          <div class="metric-chart">
            <el-progress
              :percentage="10"
              :show-text="false"
              :stroke-width="4"
              status="success"
            />
          </div>
        </el-card>
      </el-col>

      <!-- Issues -->
      <el-col :span="6">
        <el-card class="metric-card">
          <div class="metric-title">Issues</div>
          <div class="metric-value">
            <span class="value">0</span>
          </div>
          <div class="metric-chart">
            <el-progress
              :percentage="0"
              :show-text="false"
              :stroke-width="4"
              status="success"
            />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Detailed Metrics -->
    <!-- <el-row :gutter="20" class="mt-4">
      <el-col :span="24">
        <el-card class="detail-card">
          <el-descriptions :column="4" border>
            <el-descriptions-item label="Active handles">
              135
            </el-descriptions-item>
            <el-descriptions-item label="Active requests">
              0
            </el-descriptions-item>
            <el-descriptions-item label="Event Loop Latency">
              0.1ms
            </el-descriptions-item>
            <el-descriptions-item label="Event Loop Latency p95">
              1.2ms
            </el-descriptions-item>

            <el-descriptions-item label="Heap Size">
              86.7MiB
            </el-descriptions-item>
            <el-descriptions-item label="Heap Usage">55%</el-descriptions-item>
            <el-descriptions-item label="Used Heap Size">
              48.1MiB
            </el-descriptions-item>
            <el-descriptions-item label="Redis Queue Size">
              0.1
            </el-descriptions-item>

            <el-descriptions-item label="authorize/sec">0</el-descriptions-item>
            <el-descriptions-item label="Cached buckets">
              108
            </el-descriptions-item>
            <el-descriptions-item label="events/sec">0</el-descriptions-item>
            <el-descriptions-item label="except/sec">2.2</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row> -->

    <!-- Actions -->
    <!-- <el-row :gutter="20" class="mt-4">
      <el-col :span="24">
        <el-card class="action-card">
          <div class="action-buttons">
            <el-button type="primary" size="small">
              TOGGLE DEBUG LOGGING
            </el-button>
            <el-button type="primary" size="small">GETREDIS NODES</el-button>
            <el-button type="primary" size="small">REFRESH ES HOSTS</el-button>
            <el-button type="primary" size="small">GET ES HOSTS</el-button>
            <el-button type="primary" size="small">
              How to add an action
              <el-icon class="el-icon--right"><question-filled /></el-icon>
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row> -->
  </div>
</template>

<script setup lang="ts">
import { QuestionFilled } from "@element-plus/icons-vue";
</script>

<style lang="scss" scoped>
.dashboard-container {
  // background-color: var(--el-bg-color);
  min-height: 100vh;

  .metric-card {
    background-color: var(--el-bg-color-overlay);
    border: 1px solid var(--el-border-color-lighter);

    .metric-title {
      font-size: 14px;
      color: var(--el-text-color-secondary);
      margin-bottom: 10px;
    }

    .metric-value {
      margin-bottom: 15px;

      .value {
        font-size: 28px;
        font-weight: bold;
        color: var(--el-text-color-primary);
      }

      .unit {
        font-size: 16px;
        color: var(--el-text-color-secondary);
        margin-left: 5px;
      }
    }

    .metric-chart {
      margin-top: 10px;
    }
  }

  .detail-card {
    background-color: var(--el-bg-color-overlay);

    :deep(.el-descriptions__label) {
      color: var(--el-text-color-secondary);
    }

    :deep(.el-descriptions__content) {
      color: var(--el-text-color-primary);
    }
  }

  .action-card {
    background-color: var(--el-bg-color-overlay);

    .action-buttons {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
  }

  .mt-4 {
    margin-top: 16px;
  }
}
</style>
