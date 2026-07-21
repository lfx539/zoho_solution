# CRM → Books 实时同步方案

## 一、方案概述

### 同步方向
- **CRM → Books**（单向同步）

### 同步模块
1. **Sales Order (SO)** - 高优先级
2. **Purchase Order (PO)** - 高优先级
3. **Account** - 客户同步
4. **Vendor** - 供应商同步
5. **Product/Item** - 产品同步

### 触发方式
- **实时同步**：在 CRM 创建 SO/PO 时，通过 Workflow 自动触发同步

### 同步时机
- **仅创建时同步**：SO/PO 创建时同步一次，后续修改不同步

---

## 二、技术架构

### 1. 整体流程

```
CRM 创建 SO/PO
     ↓
Workflow 触发
     ↓
Deluge Function
     ↓
检查依赖数据（Account/Vendor/Product）
     ↓
调用 Books API 创建 SO/PO
     ↓
保存同步结果到 Logs
     ↓
更新 CRM 记录（存储 Books ID）
```

### 2. 依赖关系

```
SO 同步依赖：
- Account（客户）
- Product（产品）

PO 同步依赖：
- Vendor（供应商）
- Product（产品）
```

---

## 三、实现步骤

### 步骤 1：Books API 配置

在 Zoho Books 中获取 API 凭证：
1. 登录 Zoho Books
2. 进入 **设置 → API**
3. 生成 **Auth Token** 和 **Organization ID**
4. 记录以下信息：
   - `authToken`: Books API Token
   - `organizationId`: Books 组织 ID
   - `baseUrl`: `https://books.zoho.com/api/v3`

---

### 步骤 2：创建自定义字段

#### 在 CRM 中创建字段

**Sales Order 模块**：
- `Books_SO_ID` (Text) - 存储 Books 中的 SO ID
- `Books_Sync_Status` (Text) - 同步状态（Pending/Success/Failed）
- `Books_Sync_Time` (DateTime) - 同步时间

**Purchase Order 模块**：
- `Books_PO_ID` (Text) - 存储 Books 中的 PO ID
- `Books_Sync_Status` (Text) - 同步状态
- `Books_Sync_Time` (DateTime) - 同步时间

**Account 模块**：
- `Books_Customer_ID` (Text) - 存储 Books 中的客户 ID

**Vendor 模块**：
- `Books_Vendor_ID` (Text) - 存储 Books 中的供应商 ID

**Product 模块**：
- `Books_Item_ID` (Text) - 存储 Books 中的产品 ID

---

### 步骤 3：创建同步函数

#### 3.1 通用配置函数

```deluge
// 文件：Books_Config.deluge
string standalone.GetBooksConfig()
{
    config = Map();
    config.put("authToken", "YOUR_BOOKS_AUTH_TOKEN");
    config.put("organizationId", "YOUR_ORGANIZATION_ID");
    config.put("baseUrl", "https://books.zoho.com/api/v3");
    
    return config;
}
```

#### 3.2 同步 Account 到 Books

```deluge
// 文件：Sync_Account_To_Books.deluge
string standalone.SyncAccountToBooks(accountId)
{
    // 获取 Account 信息
    account = zoho.crm.getRecordById("Accounts", accountId);
    
    // 检查是否已同步
    booksCustomerId = account.get("Books_Customer_ID");
    if(booksCustomerId != null && booksCustomerId != "")
    {
        return booksCustomerId;  // 已同步，直接返回
    }
    
    // 获取 Books 配置
    config = standalone.GetBooksConfig().toMap();
    baseUrl = config.get("baseUrl");
    authToken = config.get("authToken");
    orgId = config.get("organizationId");
    
    // 构建 Books Customer 数据
    customerData = Map();
    customerData.put("display_name", account.get("Account_Name"));
    customerData.put("company_name", account.get("Account_Name"));
    customerData.put("email", account.get("Email"));
    customerData.put("phone", account.get("Phone"));
    customerData.put("billing_address", Map()
        .put("address", account.get("Billing_Street"))
        .put("city", account.get("Billing_City"))
        .put("state", account.get("Billing_State"))
        .put("zip", account.get("Billing_Code"))
        .put("country", account.get("Billing_Country"))
    );
    
    // 调用 Books API 创建客户
    headers = Map();
    headers.put("Authorization", "Zoho-authtoken " + authToken);
    
    response = invokeurl
    [
        url: baseUrl + "/contacts?organization_id=" + orgId
        type: POST
        parameters: customerData.toString()
        headers: headers
    ];
    
    // 解析响应
    responseMap = response.toJSONMap();
    if(responseMap.get("code") == 0)
    {
        contact = responseMap.get("contact");
        contactId = contact.get("contact_id");
        
        // 更新 CRM Account
        updateMap = Map();
        updateMap.put("Books_Customer_ID", contactId);
        zoho.crm.updateRecord("Accounts", accountId.toString(), updateMap);
        
        return contactId;
    }
    else
    {
        info "同步 Account 失败: " + responseMap.get("message");
        return null;
    }
}
```

#### 3.3 同步 Product 到 Books

```deluge
// 文件：Sync_Product_To_Books.deluge
string standalone.SyncProductToBooks(productId)
{
    // 获取 Product 信息
    product = zoho.crm.getRecordById("Products", productId);
    
    // 检查是否已同步
    booksItemId = product.get("Books_Item_ID");
    if(booksItemId != null && booksItemId != "")
    {
        return booksItemId;
    }
    
    // 获取 Books 配置
    config = standalone.GetBooksConfig().toMap();
    baseUrl = config.get("baseUrl");
    authToken = config.get("authToken");
    orgId = config.get("organizationId");
    
    // 构建 Books Item 数据
    itemData = Map();
    itemData.put("name", product.get("Product_Name"));
    itemData.put("sku", product.get("Product_Code"));
    itemData.put("rate", product.get("Unit_Price"));
    itemData.put("description", product.get("Description"));
    itemData.put("item_type", "goods");  // 或 "service"
    
    // 调用 Books API
    headers = Map();
    headers.put("Authorization", "Zoho-authtoken " + authToken);
    
    response = invokeurl
    [
        url: baseUrl + "/items?organization_id=" + orgId
        type: POST
        parameters: itemData.toString()
        headers: headers
    ];
    
    // 解析响应
    responseMap = response.toJSONMap();
    if(responseMap.get("code") == 0)
    {
        item = responseMap.get("item");
        itemId = item.get("item_id");
        
        // 更新 CRM Product
        updateMap = Map();
        updateMap.put("Books_Item_ID", itemId);
        zoho.crm.updateRecord("Products", productId.toString(), updateMap);
        
        return itemId;
    }
    else
    {
        return null;
    }
}
```

#### 3.4 同步 Sales Order 到 Books

```deluge
// 文件：Sync_SalesOrder_To_Books.deluge
string standalone.SyncSalesOrderToBooks(soId)
{
    // 获取 Sales Order 信息
    so = zoho.crm.getRecordById("Sales_Orders", soId);
    
    // 检查是否已同步
    booksSoId = so.get("Books_SO_ID");
    if(booksSoId != null && booksSoId != "")
    {
        return "Already synced: " + booksSoId;
    }
    
    // 同步 Account
    accountId = so.get("Account_Name").get("id");
    customerId = standalone.SyncAccountToBooks(accountId);
    if(customerId == null)
    {
        return "Failed to sync Account";
    }
    
    // 获取 Product Items
    productDetails = so.get("Product_Details");
    lineItems = List();
    
    for each product in productDetails
    {
        productId = product.get("product").get("id");
        
        // 同步 Product
        itemId = standalone.SyncProductToBooks(productId);
        if(itemId == null)
        {
            return "Failed to sync Product: " + productId;
        }
        
        // 构建行项目
        lineItem = Map();
        lineItem.put("item_id", itemId);
        lineItem.put("quantity", product.get("quantity"));
        lineItem.put("rate", product.get("list_price"));
        lineItem.put("name", product.get("product").get("name"));
        
        lineItems.add(lineItem);
    }
    
    // 获取 Books 配置
    config = standalone.GetBooksConfig().toMap();
    baseUrl = config.get("baseUrl");
    authToken = config.get("authToken");
    orgId = config.get("organizationId");
    
    // 构建 Books Sales Order 数据
    soData = Map();
    soData.put("customer_id", customerId);
    soData.put("date", so.get("Created_Time").substring(0, 10));
    soData.put("reference_number", so.get("SO_Number"));
    soData.put("line_items", lineItems);
    
    // 调用 Books API 创建 Sales Order
    headers = Map();
    headers.put("Authorization", "Zoho-authtoken " + authToken);
    
    response = invokeurl
    [
        url: baseUrl + "/salesorders?organization_id=" + orgId
        type: POST
        parameters: soData.toString()
        headers: headers
    ];
    
    // 解析响应
    responseMap = response.toJSONMap();
    if(responseMap.get("code") == 0)
    {
        salesorder = responseMap.get("salesorder");
        booksSoId = salesorder.get("salesorder_id");
        
        // 更新 CRM Sales Order
        updateMap = Map();
        updateMap.put("Books_SO_ID", booksSoId);
        updateMap.put("Books_Sync_Status", "Success");
        updateMap.put("Books_Sync_Time", zoho.currenttime);
        zoho.crm.updateRecord("Sales_Orders", soId.toString(), updateMap);
        
        return "Success: " + booksSoId;
    }
    else
    {
        // 记录失败
        updateMap = Map();
        updateMap.put("Books_Sync_Status", "Failed");
        updateMap.put("Books_Sync_Time", zoho.currenttime);
        zoho.crm.updateRecord("Sales_Orders", soId.toString(), updateMap);
        
        return "Failed: " + responseMap.get("message");
    }
}
```

#### 3.5 同步 Purchase Order 到 Books

```deluge
// 文件：Sync_PurchaseOrder_To_Books.deluge
string standalone.SyncPurchaseOrderToBooks(poId)
{
    // 获取 Purchase Order 信息
    po = zoho.crm.getRecordById("Purchase_Orders", poId);
    
    // 检查是否已同步
    booksPoId = po.get("Books_PO_ID");
    if(booksPoId != null && booksPoId != "")
    {
        return "Already synced: " + booksPoId;
    }
    
    // 同步 Vendor
    vendorId = po.get("Vendor_Name").get("id");
    vendorCustomerId = standalone.SyncVendorToBooks(vendorId);
    if(vendorCustomerId == null)
    {
        return "Failed to sync Vendor";
    }
    
    // 获取 Product Items
    productDetails = po.get("Product_Details");
    lineItems = List();
    
    for each product in productDetails
    {
        productId = product.get("product").get("id");
        
        // 同步 Product
        itemId = standalone.SyncProductToBooks(productId);
        if(itemId == null)
        {
            return "Failed to sync Product: " + productId;
        }
        
        // 构建行项目
        lineItem = Map();
        lineItem.put("item_id", itemId);
        lineItem.put("quantity", product.get("quantity"));
        lineItem.put("rate", product.get("list_price"));
        lineItem.put("name", product.get("product").get("name"));
        
        lineItems.add(lineItem);
    }
    
    // 获取 Books 配置
    config = standalone.GetBooksConfig().toMap();
    baseUrl = config.get("baseUrl");
    authToken = config.get("authToken");
    orgId = config.get("organizationId");
    
    // 构建 Books Purchase Order 数据
    poData = Map();
    poData.put("vendor_id", vendorCustomerId);
    poData.put("date", po.get("Created_Time").substring(0, 10));
    poData.put("reference_number", po.get("PO_Number"));
    poData.put("line_items", lineItems);
    
    // 调用 Books API
    headers = Map();
    headers.put("Authorization", "Zoho-authtoken " + authToken);
    
    response = invokeurl
    [
        url: baseUrl + "/purchaseorders?organization_id=" + orgId
        type: POST
        parameters: poData.toString()
        headers: headers
    ];
    
    // 解析响应
    responseMap = response.toJSONMap();
    if(responseMap.get("code") == 0)
    {
        purchaseorder = responseMap.get("purchaseorder");
        booksPoId = purchaseorder.get("purchaseorder_id");
        
        // 更新 CRM Purchase Order
        updateMap = Map();
        updateMap.put("Books_PO_ID", booksPoId);
        updateMap.put("Books_Sync_Status", "Success");
        updateMap.put("Books_Sync_Time", zoho.currenttime);
        zoho.crm.updateRecord("Purchase_Orders", poId.toString(), updateMap);
        
        return "Success: " + booksPoId;
    }
    else
    {
        // 记录失败
        updateMap = Map();
        updateMap.put("Books_Sync_Status", "Failed");
        updateMap.put("Books_Sync_Time", zoho.currenttime);
        zoho.crm.updateRecord("Purchase_Orders", poId.toString(), updateMap);
        
        return "Failed: " + responseMap.get("message");
    }
}
```

---

### 步骤 4：创建 Workflow 规则

#### 4.1 Sales Order Workflow

1. 进入 **设置 → 自动化 → 工作流规则**
2. 创建新规则：
   - 模块：Sales Orders
   - 规则名称：Sync_SO_to_Books
   - 触发条件：**创建记录时**
   - 执行动作：
     - 类型：自定义函数
     - 函数：`Sync_SalesOrder_To_Books`
     - 参数：`soId = ${Sales_Orders.ID}`

#### 4.2 Purchase Order Workflow

1. 创建新规则：
   - 模块：Purchase Orders
   - 规则名称：Sync_PO_to_Books
   - 触发条件：**创建记录时**
   - 执行动作：
     - 类型：自定义函数
     - 函数：`Sync_PurchaseOrder_To_Books`
     - 参数：`poId = ${Purchase_Orders.ID}`

---

## 四、字段映射表

### Sales Order 字段映射

| CRM 字段 | Books 字段 | 说明 |
|---------|-----------|------|
| SO_Number | reference_number | SO 编号 |
| Account_Name | customer_id | 客户（需先同步） |
| Created_Time | date | 创建日期 |
| Product_Details | line_items | 产品明细 |
| Product_Name | name | 产品名称 |
| Quantity | quantity | 数量 |
| List_Price | rate | 单价 |

### Purchase Order 字段映射

| CRM 字段 | Books 字段 | 说明 |
|---------|-----------|------|
| PO_Number | reference_number | PO 编号 |
| Vendor_Name | vendor_id | 供应商（需先同步） |
| Created_Time | date | 创建日期 |
| Product_Details | line_items | 产品明细 |

---

## 五、错误处理

### 1. 日志记录

创建 `Books_Sync_Logs` 模块，记录每次同步：

```deluge
logData = Map();
logData.put("Module", "Sales_Orders");
logData.put("CRM_ID", soId);
logData.put("Books_ID", booksSoId);
logData.put("Status", "Success/Failed");
logData.put("Error_Message", errorMessage);
logData.put("Sync_Time", zoho.currenttime);

zoho.crm.createRecord("Books_Sync_Logs", logData);
```

### 2. 重试机制

对于失败的同步，可以：
1. 创建一个定时任务，每天检查失败的记录
2. 自动重试同步
3. 如果重试 3 次仍失败，发送邮件通知管理员

---

## 六、测试步骤

### 1. 单元测试

1. 测试 `SyncAccountToBooks` 函数
2. 测试 `SyncProductToBooks` 函数
3. 测试 `SyncSalesOrderToBooks` 函数
4. 测试 `SyncPurchaseOrderToBooks` 函数

### 2. 集成测试

1. 在 CRM 创建一个新的 Account
2. 在 CRM 创建一个新的 Product
3. 在 CRM 创建一个新的 Sales Order（包含上述 Account 和 Product）
4. 检查 Books 中是否创建了对应的 Sales Order
5. 验证字段映射是否正确

---

## 七、注意事项

### 1. API 限制
- Zoho Books API 有调用频率限制（每分钟 100 次）
- 如果数据量大，需要考虑批量处理

### 2. 数据一致性
- 确保 Account/Vendor 先同步，再同步 SO/PO
- 确保 Product 先同步，再同步行项目

### 3. 错误处理
- 记录详细的错误日志
- 提供重试机制
- 通知管理员处理失败

### 4. 性能优化
- 对于已同步的数据，直接返回 ID，避免重复同步
- 使用批量 API 减少调用次数

---

## 八、后续优化

### 1. 双向同步
- 支持 Books → CRM 同步
- 处理冲突和数据一致性

### 2. 状态同步
- 当 SO/PO 状态变更时，同步到 Books
- 如：确认、关闭、取消等

### 3. 发票同步
- SO → Books Invoice
- PO → Books Bill

---

## 九、文件清单

- `Books_Config.deluge` - Books API 配置
- `Sync_Account_To_Books.deluge` - 同步 Account
- `Sync_Vendor_To_Books.deluge` - 同步 Vendor
- `Sync_Product_To_Books.deluge` - 同步 Product
- `Sync_SalesOrder_To_Books.deluge` - 同步 SO
- `Sync_PurchaseOrder_To_Books.deluge` - 同步 PO
- `Books_Sync_Retry.deluge` - 重试失败的同步

---

## 十、更新策略调整（重要）

### 问题背景
当 CRM 中增加了新字段后，已同步到 Books 的数据需要重新更新，而不是跳过。

### 解决方案：始终更新策略

#### 之前的逻辑（不更新）
```deluge
// 检查是否已同步
booksCustomerId = account.get("Books_Customer_ID");
if(booksCustomerId != null && booksCustomerId != "")
{
    return booksCustomerId;  // ❌ 已同步，直接返回，不更新
}
```

#### 现在的逻辑（始终更新）
```deluge
booksCustomerId = account.get("Books_Customer_ID");

if(booksCustomerId != null && booksCustomerId != "")
{
    // ✅ 已有 Books ID：执行更新操作
    response = invokeurl
    [
        url: baseUrl + "/contacts/" + booksCustomerId + "?organization_id=" + orgId
        type: PUT  // 使用 PUT 方法更新
        parameters: customerData.toString()
        headers: headers
    ];
}
else
{
    // ✅ 没有 Books ID：执行创建操作
    response = invokeurl
    [
        url: baseUrl + "/contacts?organization_id=" + orgId
        type: POST  // 使用 POST 方法创建
        parameters: customerData.toString()
        headers: headers
    ];
}
```

### 应用模块

1. **Account（客户）** - ✅ 已应用始终更新
2. **Product（产品）** - ✅ 已应用始终更新
3. **Vendor（供应商）** - 保持原有逻辑（仅创建）
4. **SO/PO（订单）** - 保持原有逻辑（仅创建）

### API 方法对照

| 操作 | HTTP 方法 | API 路径 | 说明 |
|-----|----------|---------|------|
| 创建 | POST | `/contacts` | 创建新客户 |
| 更新 | PUT | `/contacts/{contact_id}` | 更新已有客户 |
| 创建 | POST | `/items` | 创建新产品 |
| 更新 | PUT | `/items/{item_id}` | 更新已有产品 |

### 文件清单

- `CRM_to_Books_Sync_Account_Update.deluge` - Account 同步（支持更新）
- `CRM_to_Books_Sync_Product_Update.deluge` - Product 同步（支持更新）

---

## 十一、批量更新已有数据

如果需要批量更新已经同步到 Books 的数据，可以使用以下方法：

### 1. 创建批量更新函数

```deluge
// 文件：Batch_Update_All_Accounts.deluge
void schedule.BatchUpdateAllAccounts()
{
    // 获取所有有 Books_Customer_ID 的 Account
    accounts = zoho.crm.searchRecords("Accounts", "(Books_Customer_ID:is_not_empty)");
    
    successCount = 0;
    failCount = 0;
    
    for each account in accounts
    {
        accountId = account.get("id");
        
        // 调用同步函数（会自动执行更新）
        result = standalone.SyncAccountToBooks(accountId);
        
        if(result != null)
        {
            successCount = successCount + 1;
        }
        else
        {
            failCount = failCount + 1;
        }
    }
    
    info "批量更新完成 - 成功: " + successCount + ", 失败: " + failCount;
}
```

### 2. 执行步骤

1. 在 Zoho CRM 中创建函数 `Batch_Update_All_Accounts`
2. 手动执行一次
3. 检查日志确认更新成功

### 3. 定时任务

如果需要定期同步所有数据，可以创建定时任务：
- 频率：每天凌晨执行
- 函数：`Batch_Update_All_Accounts` 和 `Batch_Update_All_Products`
