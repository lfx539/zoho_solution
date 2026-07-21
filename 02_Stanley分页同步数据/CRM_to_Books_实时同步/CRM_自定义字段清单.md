# CRM 自定义字段清单（Books 同步）

## 📋 字段列表

### 1️⃣ Accounts 模块

| 字段标签 | API 名称 | 字段类型 | 用途 |
|---------|---------|---------|------|
| Books Customer ID | `Books_Customer_ID` | Single Line | 存储 Books 中的客户 ID |

**说明**：用于标记该 Account 已同步到 Books，避免重复同步。

---

### 2️⃣ Vendors 模块

| 字段标签 | API 名称 | 字段类型 | 用途 |
|---------|---------|---------|------|
| Books Vendor ID | `Books_Vendor_ID` | Single Line | 存储 Books 中的供应商 ID |

**说明**：用于标记该 Vendor 已同步到 Books，避免重复同步。

---

### 3️⃣ Products 模块

| 字段标签 | API 名称 | 字段类型 | 用途 |
|---------|---------|---------|------|
| Books Item ID | `Books_Item_ID` | Single Line | 存储 Books 中的产品 ID |

**说明**：用于标记该 Product 已同步到 Books，避免重复同步。

---

### 4️⃣ Sales Orders 模块 ⭐

| 字段标签 | API 名称 | 字段类型 | 必填 | 用途 |
|---------|---------|---------|------|------|
| Books SO ID | `Books_SO_ID` | Single Line | ✅ | 存储 Books 中的 Sales Order ID |
| Books Sync Status | `Books_Sync_Status` | Pick List | ✅ | 同步状态 |

**Pick List 选项**：
- `Pending` - 待同步
- `Success` - 同步成功
- `Failed` - 同步失败

**说明**：
- `Books_SO_ID`：用于标记该 SO 已同步到 Books，避免重复同步
- `Books_Sync_Status`：用于追踪同步状态，方便排查问题

---

### 5️⃣ Purchase Orders 模块 ⭐

| 字段标签 | API 名称 | 字段类型 | 必填 | 用途 |
|---------|---------|---------|------|------|
| Books PO ID | `Books_PO_ID` | Single Line | ✅ | 存储 Books 中的 Purchase Order ID |
| Books Sync Status | `Books_Sync_Status` | Pick List | ✅ | 同步状态 |

**Pick List 选项**：
- `Pending` - 待同步
- `Success` - 同步成功
- `Failed` - 同步失败

**说明**：
- `Books_PO_ID`：用于标记该 PO 已同步到 Books，避免重复同步
- `Books_Sync_Status`：用于追踪同步状态，方便排查问题

---

### 6️⃣ BooksSyncLogs 模块 ⭐

这是一个**自定义模块**，用于记录所有同步日志，方便排查问题。

| 字段标签 | API 名称 | 字段类型 | 必填 | 用途 |
|---------|---------|---------|------|------|
| Name | `Name` | Single Line | ✅ | 日志名称（自动生成） |
| Module | `Module` | Pick List | ✅ | 同步的模块 |
| CRM Record ID | `CRM_Record_ID` | Single Line | | CRM 记录 ID |
| Books Record ID | `Books_Record_ID` | Single Line | | Books 记录 ID |
| Sync Status | `Sync_Status` | Pick List | ✅ | 同步状态 |
| Error Message | `Error_Message` | Multi Line | | 错误信息 |
| Sync Time | `Sync_Time` | Date Time | ✅ | 同步时间 |

**Pick List 选项（Module）**：
- `Sales_Orders`
- `Purchase_Orders`
- `Accounts`
- `Vendors`
- `Products`

**Pick List 选项（Sync Status）**：
- `Success` - 同步成功
- `Failed` - 同步失败
- `Pending` - 待同步

---

## 📊 字段汇总

### 必须添加的字段

| 模块 | 字段数量 |
|------|---------|
| Accounts | 1 个 |
| Vendors | 1 个 |
| Products | 1 个 |
| Sales Orders | 2 个 |
| Purchase Orders | 2 个 |

**总计**：**7 个字段**

### 可选模块

| 模块 | 字段数量 |
|------|---------|
| BooksSyncLogs | 7 个字段 |

---

## 🚀 创建步骤

### 步骤 1: 创建字段

在 CRM 中按以下顺序创建字段：

1. **Accounts 模块**
   - 设置 → 自定义 → 模块 → Accounts → 创建字段
   - 创建 `Books_Customer_ID` (Single Line)

2. **Vendors 模块**
   - 设置 → 自定义 → 模块 → Vendors → 创建字段
   - 创建 `Books_Vendor_ID` (Single Line)

3. **Products 模块**
   - 设置 → 自定义 → 模块 → Products → 创建字段
   - 创建 `Books_Item_ID` (Single Line)

4. **Sales Orders 模块**
   - 设置 → 自定义 → 模块 → Sales Orders → 创建字段
   - 创建 `Books_SO_ID` (Single Line)
   - 创建 `Books_Sync_Status` (Pick List)

5. **Purchase Orders 模块**
   - 设置 → 自定义 → 模块 → Purchase Orders → 创建字段
   - 创建 `Books_PO_ID` (Single Line)
   - 创建 `Books_Sync_Status` (Pick List)

### 步骤 2: 创建日志模块（可选）

1. **创建模块**
   - 设置 → 模块 → 创建新模块
   - 模块名称：`BooksSyncLogs`

2. **创建字段**
   - 按上表创建 7 个字段

---

## ⚠️ 重要提醒

### 1. API 名称必须准确

字段的 **API 名称** 必须与代码中使用的名称完全一致：

- `Books_Customer_ID` (不是 `Books_CustomerId` 或 `books_customer_id`)
- `Books_Vendor_ID` (不是 `Books_VendorId`)
- `Books_Item_ID` (不是 `Books_ItemId`)
- `Books_SO_ID` (不是 `Books_So_ID` 或 `Books_SO_Id`)
- `Books_PO_ID` (不是 `Books_Po_ID` 或 `Books_PO_Id`)
- `Books_Sync_Status` (不是 `Books_SyncStatus`)

### 2. 检查现有字段

在创建之前，先检查模块中是否已经有这些字段，避免重复创建。

### 3. 字段权限

确保这些字段对所有需要的用户/角色可见。

---

## 📝 字段用途说明

### Books ID 字段（5 个）

这些字段用于存储 Books 中对应记录的 ID，主要作用：
- ✅ 避免重复同步（检查是否已有 ID）
- ✅ 用于后续更新操作（如果有需要）
- ✅ 用于关联查询（从 Books 获取数据）

### 同步状态字段（2 个）

用于追踪同步状态，主要作用：
- ✅ 快速筛选失败的记录
- ✅ 监控同步成功率
- ✅ 触发重试逻辑

---

## 🔍 验证字段创建

创建完成后，可以通过以下方式验证：

1. **在记录详情页查看**
   - 打开任意 Sales Order 记录
   - 检查是否能看到新增的字段

2. **通过 API 验证**
   ```
   GET https://www.zohoapis.com.au/crm/v8/settings/fields?module=Sales_Orders
   ```
   查看返回的字段列表中是否包含新增字段

---

**创建完成后，即可部署同步函数并测试！** 🎉
