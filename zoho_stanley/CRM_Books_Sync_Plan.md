# CRM 与 Books 同步方案

## 业务流程

```
CRM（报价、SO创建）→ 同步到 → Books（产品、库存、财务）
                    ← 库存同步 ←
```

---

## 方案概述

### SO 同步：方案A - CRM SO 创建时自动同步到 Books

```
CRM SO 创建 → Workflow 触发 → 创建 Books SO → Books 自动扣减库存
```

### 库存同步：定时同步

```
每 2 小时或每天 → 从 Books 获取库存 → 更新到 CRM 产品模块
```

---

## 第一步：检查原生集成设置

在 Zoho Books 中：
1. **Setup** → **Integrations** → **Zoho CRM**
2. 启用集成
3. 配置同步选项：
   - 同步客户
   - 同步产品
   - 同步 Sales Orders
   - 同步库存

---

## 第二步：测试原生集成

1. 在 CRM 创建一个测试 SO
2. 检查是否自动同步到 Books
3. 检查 Books 库存是否扣减
4. 检查 CRM 中库存是否更新

---

## 第三步：如果原生不满足，需要自定义开发

### 1. SO 同步函数（Workflow 触发）

**触发方式**：CRM SO 创建时 Workflow 调用

**功能**：
- 获取 CRM SO 详情
- 映射字段到 Books SO 格式
- 调用 Books API 创建 SO

**需要处理的字段映射**：

| CRM SO | Books SO | 说明 |
|--------|----------|------|
| Sales_Order_Number | salesorder_number | SO 编号 |
| Account_Name | customer_id | 客户 |
| Product_Details | line_items | 产品明细 |
| Quantity | quantity | 数量 |
| Unit_Price | rate | 单价 |
| Discount | discount | 折扣 |
| Tax | tax | 税 |
| Total | total | 总计 |

### 2. 库存同步函数（Schedule 定时）

**触发方式**：每 2 小时或每天执行

**功能**：
- 从 Books 获取所有产品的库存信息
- 更新到 CRM 产品模块

**Books API**：
```
GET /api/v3/items?organization_id={org_id}
```

**返回字段**：
- item_id
- name
- stock_on_hand（库存数量）

---

## 注意事项

1. **报价价格逻辑**：如果 CRM 有自定义的价格计算逻辑，需要在同步时处理
2. **库存扣减**：Books 创建 SO 后会自动扣减库存
3. **数据一致性**：两边的数据需要定期校验

---

## 待确认问题

- [ ] 原生集成是否满足 SO 同步需求
- [ ] 报价价格逻辑是否能正确同步
- [ ] 库存同步频率要求
- [ ] 是否需要处理退货、取消等场景
