# CRM → Books 实时同步实施指南

## 📋 目录

1. [前置准备](#前置准备)
2. [步骤一：创建自定义字段](#步骤一创建自定义字段)
3. [步骤二：创建日志模块](#步骤二创建日志模块)
4. [步骤三：获取 Books API 凭证](#步骤三获取-books-api-凭证)
5. [步骤四：部署同步函数](#步骤四部署同步函数)
6. [步骤五：创建 Workflow 自动触发](#步骤五创建-workflow-自动触发)
7. [步骤六：测试验证](#步骤六测试验证)
8. [常见问题](#常见问题)

---

## 前置准备

### ✅ 确认已完成

- [ ] CRM 中已有 NetSuite 同步的 SO/PO 数据
- [ ] CRM 中已有 Account 和 Product 数据
- [ ] 有 Zoho Books 的管理员权限
- [ ] 了解 Deluge 脚本基础

---

## 步骤一：创建自定义字段

### 1.1 Sales Order 模块

在 **Sales Orders** 模块添加以下自定义字段：

| 字段标签 | API 名称 | 字段类型 | 用途 |
|---------|---------|---------|------|
| Books SO ID | `Books_SO_ID` | Single Line | 存储 Books 中的 SO ID |
| Books Sync Status | `Books_Sync_Status` | Pick List | 同步状态（Pending/Success/Failed） |
| Books Sync Time | `Books_Sync_Time` | Date Time | 最后同步时间 |

**操作步骤**：
1. 进入 **设置 → 自定义 → 模块**
2. 选择 **Sales Orders** 模块
3. 点击 **创建字段**
4. 按上表创建 3 个字段
5. 保存

---

### 1.2 Purchase Order 模块

在 **Purchase_Orders** 模块添加以下自定义字段：

| 字段标签 | API 名称 | 字段类型 | 用途 |
|---------|---------|---------|------|
| Books PO ID | `Books_PO_ID` | Single Line | 存储 Books 中的 PO ID |
| Books Sync Status | `Books_Sync_Status` | Pick List | 同步状态（Pending/Success/Failed） |
| Books Sync Time | `Books_Sync_Time` | Date Time | 最后同步时间 |

**操作步骤**：同 Sales Order

---

### 1.3 Account 模块（如果还没有）

检查 **Accounts** 模块是否有以下字段：

| 字段标签 | API 名称 | 字段类型 | 用途 |
|---------|---------|---------|------|
| Books Customer ID | `Books_Customer_ID` | Single Line | 存储 Books 中的客户 ID |

如果没有，请创建。

---

### 1.4 Vendor 模块

在 **Vendors** 模块添加以下自定义字段：

| 字段标签 | API 名称 | 字段类型 | 用途 |
|---------|---------|---------|------|
| Books Vendor ID | `Books_Vendor_ID` | Single Line | 存储 Books 中的供应商 ID |

**操作步骤**：同 Sales Order

---

### 1.5 Product 模块（如果还没有）

检查 **Products** 模块是否有以下字段：

| 字段标签 | API 名称 | 字段类型 | 用途 |
|---------|---------|---------|------|
| Books Item ID | `Books_Item_ID` | Single Line | 存储 Books 中的产品 ID |

如果没有，请创建。

---

## 步骤二：创建日志模块

为了追踪同步状态和排查问题，建议创建一个专门的日志模块。

### 2.1 创建 Books_Sync_Logs 模块

1. 进入 **设置 → 模块**
2. 点击 **创建新模块**
3. 模块名称：`Books_Sync_Logs`
4. 添加以下字段：

| 字段标签 | API 名称 | 字段类型 | 必填 |
|---------|---------|---------|------|
| Name | `Name` | Single Line | ✅ |
| Module | `Module` | Pick List (Sales_Orders, Purchase_Orders, Accounts, Vendors, Products) | ✅ |
| CRM Record ID | `CRM_Record_ID` | Single Line | |
| Books Record ID | `Books_Record_ID` | Single Line | |
| Sync Status | `Sync_Status` | Pick List (Success, Failed, Pending) | ✅ |
| Error Message | `Error_Message` | Multi Line | |
| Sync Time | `Sync_Time` | Date Time | ✅ |

---

## 步骤三：获取 Books API 凭证

### 3.1 获取 Organization ID

1. 登录 Zoho Books
2. 进入 **设置 → 组织信息**
3. 记录 **组织 ID** (Organization ID)

### 3.2 获取 Auth Token（推荐用于测试）

**方法一：使用老版 Authtoken**
1. 访问：https://accounts.zoho.com/apiauthtoken/create?SCOPE=ZohoBooks/booksapi
2. 登录你的 Zoho 账号
3. 输入应用名称（如：CRM_to_Books_Sync）
4. 点击 **生成**
5. 复制生成的 Authtoken

**方法二：使用 OAuth（推荐用于生产环境）**
1. 访问 Zoho API Console：https://api-console.zoho.com/
2. 创建 **Self Client**
3. 选择作用域：`ZohoBooks.fullaccess.all`
4. 生成授权码和访问令牌
5. 在 Zoho CRM 中创建 Connection：
   - 进入 **设置 → 连接 → 连接**
   - 创建新连接：`zoho_books`
   - 选择服务：Zoho Books
   - 输入凭证

### 3.3 确定 API 域名

根据你的 Books 数据中心选择对应的 API 域名：

| 数据中心 | API 域名 |
|---------|---------|
| 美国 (US) | `https://books.zoho.com/api/v3` |
| 欧洲 (EU) | `https://books.zoho.eu/api/v3` |
| 澳洲 (AU) | `https://books.zoho.com.au/api/v3` |
| 印度 (IN) | `https://books.zoho.in/api/v3` |
| 日本 (JP) | `https://books.zoho.jp/api/v3` |

**如何确定你的数据中心？**
- 查看你的 Books URL，例如 `https://books.zoho.com` → 美国
- 或在 Books 中查看 **设置 → 组织信息 → 数据中心**

---

## 步骤四：部署同步函数

### 4.1 创建函数

在 Zoho CRM 中创建以下函数：

#### 函数 1：Books_Config

- **文件**: [Books_Config.deluge](Books_Config.deluge)
- **函数名**: `standalone.GetBooksConfig`
- **作用**: 配置 Books API 信息

**操作步骤**：
1. 进入 **设置 → 自动化 → 函数**
2. 点击 **创建函数**
3. 函数名称：`GetBooksConfig`
4. 命名空间：`standalone`
5. 复制 [Books_Config.deluge](Books_Config.deluge) 的代码
6. **修改配置**：
   ```deluge
   config.put("authToken", "你的Books_Authtoken");
   config.put("organizationId", "你的Organization_ID");
   config.put("baseUrl", "https://books.zoho.com/api/v3");  // 根据你的数据中心修改
   ```
7. 保存

---

#### 函数 2：SyncVendorToBooks

- **文件**: [Sync_Vendor_To_Books.deluge](Sync_Vendor_To_Books.deluge)
- **函数名**: `standalone.SyncVendorToBooks`
- **参数**: `vendorId` (String)
- **作用**: 同步 Vendor 到 Books

**操作步骤**：
1. 创建函数：`SyncVendorToBooks`
2. 命名空间：`standalone`
3. 添加参数：`vendorId` (String)
4. 复制代码并保存

---

#### 函数 3：SyncSalesOrderToBooks

- **文件**: [Sync_SalesOrder_To_Books.deluge](Sync_SalesOrder_To_Books.deluge)
- **函数名**: `standalone.SyncSalesOrderToBooks`
- **参数**: `soId` (String)
- **作用**: 同步 Sales Order 到 Books

**操作步骤**：
1. 创建函数：`SyncSalesOrderToBooks`
2. 命名空间：`standalone`
3. 添加参数：`soId` (String)
4. 复制代码并保存

---

#### 函数 4：SyncPurchaseOrderToBooks

- **文件**: [Sync_PurchaseOrder_To_Books.deluge](Sync_PurchaseOrder_To_Books.deluge)
- **函数名**: `standalone.SyncPurchaseOrderToBooks`
- **参数**: `poId` (String)
- **作用**: 同步 Purchase Order 到 Books

**操作步骤**：
1. 创建函数：`SyncPurchaseOrderToBooks`
2. 命名空间：`standalone`
3. 添加参数：`poId` (String)
4. 复制代码并保存

---

### 4.2 更新现有函数

如果你之前已经创建了 `SyncAccountToBooks` 和 `SyncProductToBooks`，确保它们是最新版本：

- [CRM_to_Books_Sync_Account_Update.deluge](CRM_to_Books_Sync_Account_Update.deluge)
- [CRM_to_Books_Sync_Product_Update.deluge](CRM_to_Books_Sync_Product_Update.deluge)

---

## 步骤五：创建 Workflow 自动触发

### 5.1 Sales Order Workflow

创建 Workflow 规则，在 SO 创建时自动触发同步：

**操作步骤**：
1. 进入 **设置 → 自动化 → 工作流规则**
2. 点击 **创建规则**
3. 填写基本信息：
   - **模块**: Sales Orders
   - **规则名称**: `Sync_SO_to_Books_On_Create`
   - **描述**: 当 SO 创建时，自动同步到 Books
4. 触发条件：
   - **执行条件**: 创建记录时 (On Create)
   - **过滤条件**: （可选，如只同步特定状态的 SO）
5. 执行动作：
   - **动作类型**: 自定义函数
   - **函数**: `SyncSalesOrderToBooks`
   - **参数映射**:
     ```
     soId = ${Sales_Orders.ID}
     ```
6. 保存

---

### 5.2 Purchase Order Workflow

创建 PO 的 Workflow 规则：

**操作步骤**：
1. 进入 **设置 → 自动化 → 工作流规则**
2. 点击 **创建规则**
3. 填写基本信息：
   - **模块**: Purchase Orders
   - **规则名称**: `Sync_PO_to_Books_On_Create`
   - **描述**: 当 PO 创建时，自动同步到 Books
4. 触发条件：
   - **执行条件**: 创建记录时 (On Create)
   - **过滤条件**: （可选）
5. 执行动作：
   - **动作类型**: 自定义函数
   - **函数**: `SyncPurchaseOrderToBooks`
   - **参数映射**:
     ```
     poId = ${Purchase_Orders.ID}
     ```
6. 保存

---

## 步骤六：测试验证

### 6.1 准备测试数据

在测试之前，确保：
- ✅ CRM 中有一个 Account（已同步到 Books 或将要同步）
- ✅ CRM 中有 Products（已同步到 Books 或将要同步）
- ✅ CRM 中有一个 Vendor（已同步到 Books 或将要同步）

### 6.2 测试 Sales Order 同步

#### 方法一：手动执行函数（推荐用于初次测试）

1. 进入 **设置 → 自动化 → 函数**
2. 找到 `SyncSalesOrderToBooks` 函数
3. 点击 **执行**
4. 输入一个 SO ID（从 CRM 中找一个现有的 SO）
5. 查看执行结果

**预期结果**：
- 函数执行成功
- CRM SO 记录中填充了 `Books_SO_ID`
- Books 中创建了对应的 Sales Order
- `Books_Sync_Logs` 中记录了成功日志

#### 方法二：创建新 SO（测试 Workflow）

1. 在 CRM 中创建一个新的 Sales Order
2. 填写必要信息（Account、Products）
3. 保存
4. 检查：
   - SO 的 `Books_SO_ID` 字段是否有值
   - Books 中是否创建了对应的 Sales Order
   - `Books_Sync_Logs` 中是否有记录

### 6.3 测试 Purchase Order 同步

#### 方法一：手动执行函数

1. 进入 **设置 → 自动化 → 函数**
2. 找到 `SyncPurchaseOrderToBooks` 函数
3. 点击 **执行**
4. 输入一个 PO ID
5. 查看执行结果

#### 方法二：创建新 PO（测试 Workflow）

1. 在 CRM 中创建一个新的 Purchase Order
2. 填写必要信息（Vendor、Products）
3. 保存
4. 检查同步结果

### 6.4 查看同步日志

进入 `Books_Sync_Logs` 模块，查看所有同步记录：
- 成功记录：Status = Success
- 失败记录：Status = Failed，查看 Error_Message 了解原因

### 6.5 在 Books 中验证

登录 Zoho Books，检查：
1. **Contacts** 模块：是否有新创建的客户和供应商
2. **Items** 模块：是否有新创建的产品
3. **Sales Orders** 模块：是否有新创建的 SO
4. **Purchase Orders** 模块：是否有新创建的 PO

---

## 常见问题

### Q1: 同步失败，提示 "Customer not found"

**原因**: Account 还未同步到 Books

**解决方案**:
- 确保 Account 已同步到 Books Customer
- 可以先手动执行 `SyncAccountToBooks` 函数
- 或者修改 Workflow，在创建 SO 之前先触发 Account 同步

---

### Q2: 同步失败，提示 "Item not found"

**原因**: Product 还未同步到 Books

**解决方案**:
- 确保 Product 已同步到 Books Item
- 可以先手动执行 `SyncProductToBooks` 函数
- 或者创建 Product 创建时的 Workflow

---

### Q3: 同步失败，提示 "Authentication failed"

**原因**: Books API 认证信息错误

**解决方案**:
- 检查 `Books_Config.deluge` 中的 authToken 是否正确
- 检查 organizationId 是否正确
- 确保 authToken 未过期（老版 authtoken 通常不会过期）

---

### Q4: 提示 "API limit exceeded"

**原因**: Zoho Books API 有调用频率限制（每分钟 100 次）

**解决方案**:
- 批量同步时，添加延迟
- 在配置中调整 `apiDelay` 参数

---

### Q5: 已同步的 SO/PO 在 Books 中看不到

**原因**: 可能是状态问题或权限问题

**解决方案**:
- 检查 Books 中 SO/PO 的状态（可能是草稿状态）
- 确认你有查看所有 SO/PO 的权限
- 在 Books 中搜索 SO/PO 编号（reference_number）

---

### Q6: 子表（行项目）没有同步

**原因**: CRM 字段名不匹配

**解决方案**:
- 检查 CRM 中子表的字段名：
  - SO: `Product_Details` 或 `Ordered_Items`
  - PO: `Purchase_Items`
- 根据实际情况修改同步函数中的字段名

---

### Q7: 地址信息没有同步

**原因**: CRM 地址字段名不匹配

**解决方案**:
- 检查 CRM 中地址字段的 API 名称
- 常见命名：
  - `Billing_Street`, `Billing_City`, `Billing_State`, `Billing_Code`, `Billing_Country`
  - `Shipping_Street`, `Shipping_City`, `Shipping_State`, `Shipping_Code`, `Shipping_Country`
- 根据实际情况修改同步函数

---

## 下一步

### ✅ 完成实时同步后

1. **监控同步状态**
   - 定期检查 `Books_Sync_Logs`
   - 关注失败的同步记录

2. **历史数据批量同步**
   - 创建批量同步函数
   - 分批次同步现有数据

3. **错误重试机制**
   - 创建定时任务，自动重试失败的同步
   - 设置重试次数限制（如 3 次）

4. **通知机制**
   - 当同步失败时，发送邮件通知管理员
   - 在 CRM 中显示同步状态

---

## 技术支持

如有问题，请检查：
1. 函数执行日志（在函数编辑器中查看）
2. `Books_Sync_Logs` 模块中的错误信息
3. Books API 响应（在代码中添加 `info` 语句查看）

---

## 文件清单

| 文件名 | 用途 | 状态 |
|--------|------|------|
| [Books_Config.deluge](Books_Config.deluge) | Books API 配置 | ✅ 新建 |
| [Sync_Vendor_To_Books.deluge](Sync_Vendor_To_Books.deluge) | Vendor 同步 | ✅ 新建 |
| [Sync_SalesOrder_To_Books.deluge](Sync_SalesOrder_To_Books.deluge) | Sales Order 同步 | ✅ 新建 |
| [Sync_PurchaseOrder_To_Books.deluge](Sync_PurchaseOrder_To_Books.deluge) | Purchase Order 同步 | ✅ 新建 |
| [CRM_to_Books_Sync_Account_Update.deluge](CRM_to_Books_Sync_Account_Update.deluge) | Account 同步 | ✅ 已有 |
| [CRM_to_Books_Sync_Product_Update.deluge](CRM_to_Books_Sync_Product_Update.deluge) | Product 同步 | ✅ 已有 |

---

**最后更新**: 2026-07-16
**版本**: 1.0
