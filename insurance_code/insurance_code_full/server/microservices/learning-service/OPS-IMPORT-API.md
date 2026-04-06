# P 端学习资料运营导入 API

更新时间：2026-03-18  
适用对象：运营系统 / 外部内容导入方  
推荐入口：`POST http://127.0.0.1:4100/api/p/learning/*`

## 0. 对接产物

可直接导入或分发的正式文件：

1. OpenAPI：[`./OPS-IMPORT-OPENAPI.yaml`](./OPS-IMPORT-OPENAPI.yaml)
2. Postman Collection：[`./OPS-IMPORT.postman_collection.json`](./OPS-IMPORT.postman_collection.json)

## 1. 能力概览

当前对外开放两条写接口：

1. 单条导入：`POST /api/p/learning/courses`
2. 批量导入：`POST /api/p/learning/courses/batch`

两条接口都支持：

1. 运营 API key 鉴权：`x-ops-api-key`
2. 内联上传文件：`uploadItems[].dataUrl`
3. 幂等控制：`idempotencyKey`

## 2. 鉴权

请求头：

```http
x-ops-api-key: <ops-api-key>
Content-Type: application/json
```

说明：

1. 运营系统对接时不需要 `Authorization`
2. 运营系统对接时不需要 `x-csrf-token`
3. 错误 API key 返回 `401 OPS_API_KEY_INVALID`

## 3. 单条导入

### 3.1 请求体

```json
{
  "title": "家庭资产配置课",
  "category": "运营导入",
  "contentType": "article",
  "level": "中级",
  "content": "课程正文",
  "rewardPoints": 12,
  "status": "published",
  "idempotencyKey": "ops-learning-001",
  "uploadItems": [
    {
      "name": "cover.png",
      "type": "image/png",
      "dataUrl": "data:image/png;base64,..."
    }
  ]
}
```

字段说明：

1. `title`：必填，课程标题
2. `category`：选填，分类
3. `contentType`：选填，默认 `article`
4. `level`：选填，默认 `中级`
5. `content`：选填，正文内容
6. `rewardPoints` / `points`：二选一即可，奖励积分
7. `status`：选填，默认 `published`
8. `coverUrl`：选填；若不传，且上传了图片媒体，则自动取第一张媒体
9. `media`：选填，已上传媒体列表
10. `uploadItems`：选填，内联上传文件列表
11. `idempotencyKey`：选填，建议运营系统始终传

### 3.2 成功返回

```json
{
  "ok": true,
  "course": {
    "id": 101,
    "title": "家庭资产配置课"
  },
  "idempotent": false
}
```

重复提交同一个 `idempotencyKey` 时：

1. 返回第一次创建的 `course`
2. `idempotent=true`
3. 不会重复创建新课程

### 3.3 curl 示例

```bash
curl -X POST http://127.0.0.1:4100/api/p/learning/courses \
  -H "Content-Type: application/json" \
  -H "x-ops-api-key: ops-secret" \
  -d '{
    "title": "家庭资产配置课",
    "category": "运营导入",
    "contentType": "article",
    "level": "中级",
    "content": "课程正文",
    "rewardPoints": 12,
    "status": "published",
    "idempotencyKey": "ops-learning-001"
  }'
```

## 4. 批量导入

### 4.1 请求体

```json
{
  "idempotencyKey": "ops-learning-batch-001",
  "items": [
    {
      "title": "批量课程 A",
      "category": "运营导入",
      "contentType": "article",
      "level": "初级",
      "content": "课程正文 A",
      "rewardPoints": 10,
      "status": "published"
    },
    {
      "title": "批量课程 B",
      "category": "运营导入",
      "contentType": "article",
      "level": "中级",
      "content": "课程正文 B",
      "rewardPoints": 20,
      "status": "published"
    }
  ]
}
```

规则：

1. `items` 至少 1 条
2. `items` 最多 20 条
3. 每条 item 字段与单条导入一致
4. 顶层 `idempotencyKey` 控制整批幂等
5. 任一条失败则整批失败并回滚

### 4.2 成功返回

```json
{
  "ok": true,
  "total": 2,
  "createdCount": 2,
  "items": [
    {
      "index": 0,
      "ok": true,
      "idempotent": false,
      "course": {
        "id": 101,
        "title": "批量课程 A"
      }
    }
  ],
  "courses": [
    {
      "id": 101,
      "title": "批量课程 A"
    }
  ],
  "idempotent": false
}
```

重复提交同一批次 `idempotencyKey` 时：

1. 返回第一次整包结果
2. 顶层 `idempotent=true`
3. 不会重复创建新课程

### 4.3 失败返回

示例：第 2 条标题为空

```json
{
  "code": "COURSE_TITLE_REQUIRED",
  "message": "资料标题不能为空",
  "itemIndex": 1
}
```

说明：

1. `itemIndex` 从 `0` 开始
2. 返回哪个索引，就修正哪一条数据后整批重试

### 4.4 curl 示例

```bash
curl -X POST http://127.0.0.1:4100/api/p/learning/courses/batch \
  -H "Content-Type: application/json" \
  -H "x-ops-api-key: ops-secret" \
  -d '{
    "idempotencyKey": "ops-learning-batch-001",
    "items": [
      {
        "title": "批量课程 A",
        "category": "运营导入",
        "contentType": "article",
        "level": "初级",
        "content": "课程正文 A",
        "rewardPoints": 10,
        "status": "published"
      },
      {
        "title": "批量课程 B",
        "category": "运营导入",
        "contentType": "article",
        "level": "中级",
        "content": "课程正文 B",
        "rewardPoints": 20,
        "status": "published"
      }
    ]
  }'
```

## 5. 上传限制

1. 单文件最大 12MB
2. `uploadItems[].dataUrl` 必须是合法 Data URL
3. 单条课程最多保留 6 个媒体项

## 6. 错误码

1. `OPS_API_KEY_INVALID`：运营 API key 错误
2. `COURSE_TITLE_REQUIRED`：标题为空
3. `COURSE_BATCH_ITEMS_REQUIRED`：批量导入未提交任何 item
4. `COURSE_BATCH_ITEMS_LIMIT_EXCEEDED`：批量导入超过 20 条
5. `INVALID_DATA_URL`：上传内容格式错误
6. `FILE_TOO_LARGE`：文件超过 12MB
7. `COMPANY_ACCOUNT_REQUIRED`：当前身份无权导入

## 7. 接入建议

1. 运营系统始终传 `idempotencyKey`
2. 批量导入优先使用 `/batch`
3. 对 `400/413/401` 按错误码处理，不要盲目重试
4. 对网络超时或 `5xx` 可使用相同 `idempotencyKey` 安全重试
