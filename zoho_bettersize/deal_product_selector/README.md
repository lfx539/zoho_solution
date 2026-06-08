# Deal 产品选择器 - 实现指南

## 概述

当商机状态变为 Closed Won 时，用户点击按钮跳转到 Zoho Creator 页面，选择要采购的产品，系统自动创建 Products_Purchased 记录。

## 文件说明

| 文件 | 说明 |
|------|------|
| 01_crm_button_function.js | CRM 按钮函数，跳转到 Creator 页面 |
| 02_creator_page_script.js | Creator 页面脚本，显示产品列表 + 复选框 |
| 03_create_products_purchased.js | Creator 表单提交处理，创建采购记录 |

---

## 配置步骤

### 第一步：CRM 端配置

#### 1.1 创建 Deal 子表

在 Deal 模块创建子表 `Product_Interested_In`，字段：

| 字段 API 名称 | 字段类型 | 说明 |
|---------------|----------|------|
| Product | 查找(Products) | 关联产品模块 |
| Quantity | 数字 | 数量 |
| Unit_Price | 货币 | 单价 |

#### 1.2 配置蓝图按钮

1. 进入 CRM > 设置 > 自动化 > 蓝图
2. 编辑 Deal 模块的蓝图
3. 在 Closed Won 状态添加按钮：
   - 按钮名称：确认采购产品
   - 执行函数：使用 `01_crm_button_function.js` 的代码

#### 1.3 修改按钮函数配置

修改代码中的以下变量：
```javascript
creatorOwner = "你的组织名";           // 替换为你的 Creator 账号
creatorAppName = "deal-product-selector";  // 替换为你的应用名称
creatorPageName = "ProductSelectionPage";   // 替换为你的页面名称
```

---

### 第二步：Zoho Creator 应用配置

#### 2.1 创建应用

1. 登录 Zoho Creator：https://creator.zoho.com
2. 点击右上角 **+ Create Application**
3. 选择 **Create from Scratch**
4. 输入应用名称：`deal-product-selector`
5. 点击 **Create**

#### 2.2 创建表单 ProductSelectionForm

**步骤：**

1. 在应用中，点击左侧 **+ Create** 按钮
2. 选择 **Form**
3. 选择 **Create form from scratch**
4. 输入表单名称：`ProductSelectionForm`
5. 点击 **Create Form**

**添加字段：**

1. 拖拽 **Single Line** 字段到表单
   - Field Name: `Deal_ID`
   - 点击 Done

2. 拖拽 **Multi Line** 字段到表单
   - Field Name: `Selected_Products`
   - 点击 Done

3. 点击右上角 **Save** 保存表单

#### 2.3 创建页面 ProductSelectionPage

**步骤：**

1. 点击左侧 **+ Create** 按钮
2. 选择 **Page**
3. 输入页面名称：`ProductSelectionPage`
4. **Datasource 选择**：选择 **Script**（不选表单，直接用脚本生成页面）
5. 点击 **Create Page**

**为什么选择 Script：**
- 我们不需要绑定表单数据
- 页面内容完全由 Deluge 脚本动态生成
- 通过调用 CRM API 获取数据

**粘贴代码：**

1. 进入页面编辑器后，点击右上角 **Script** 标签页
2. 将 `02_creator_page_script.js` 的全部代码粘贴进去
3. 点击 **Save** 保存

#### 2.4 配置表单工作流

**步骤：**

1. 进入 **ProductSelectionForm** 表单
2. 点击右上角 **Workflow** 标签页
3. 点击 **Create New Workflow**
4. 配置触发器：
   - **Workflow Name**: `CreateProductsPurchased`
   - **When to trigger**: 选择 **On Add**（创建记录时触发）
5. 点击 **Create Workflow**

**添加脚本：**

1. 在脚本编辑区域，找到 `On Add` 代码块
2. 将 `03_create_products_purchased.js` 的代码粘贴进去
3. 注意：脚本中使用的 `input.Deal_ID` 和 `input.Selected_Products` 会自动引用表单字段
4. 点击 **Save** 保存

---

### 第三步：连接配置

#### 3.1 创建 CRM 连接

**在 Zoho Creator 中创建：**

1. 点击右上角 **Settings**（齿轮图标）
2. 左侧菜单选择 **Connections**
3. 点击 **Create Connection**
4. 选择 **Zoho CRM**
5. 配置连接：
   - **Connection Name**: `crm`（必须是这个名称，代码中使用）
   - **Connection Link Name**: `crm`
6. 点击 **Connect**
7. 在弹出的授权窗口中，选择你的 CRM 组织并授权
8. 授权成功后，连接状态会显示为 **Active**

**授权范围说明：**

默认会请求以下权限，确保全部勾选：
- `ZohoCRM.modules.ALL` - 读写所有模块数据
- `ZohoCRM.settings.ALL` - 读取设置信息

#### 3.2 验证连接

确保代码中的 connection 名称与创建的连接名称一致：
- `02_creator_page_script.js` 第 26 行：`connection: "crm"`
- `03_create_products_purchased.js` 第 25 行：`connection: "crm"`

---

### Datasource 选择详解

创建 Page 时会看到 Datasource 选项：

| 选项 | 说明 | 适用场景 |
|------|------|----------|
| **Form** | 绑定表单，页面显示表单数据 | 需要展示/编辑表单记录 |
| **Report** | 绑定报表，页面显示报表数据 | 需要展示数据列表 |
| **Script** | 纯脚本页面，无预设数据源 | **我们选择这个** - 动态调用 API 获取数据 |
| **Schedule** | 定时任务页面 | 定时执行脚本 |

**为什么选择 Script：**

1. 我们的数据来源是 CRM API，不是 Creator 表单
2. 页面内容需要根据 URL 参数（deal_id）动态生成
3. 更灵活，完全由代码控制页面逻辑

---

### 第四步：URL 配置说明

Creator 页面的访问 URL 格式：

```
https://creator.zoho.com/{owner_name}/{app_name}/#Script:{page_name}?deal_id={deal_id}
```

**示例：**
```
https://creator.zoho.com/mycompany/deal-product-selector/#Script:ProductSelectionPage?deal_id=5809562000077156029
```

**获取正确的 URL：**

1. 在 Creator 中打开你创建的页面
2. 点击右上角 **Live** 按钮预览页面
3. 从浏览器地址栏复制 URL
4. 在 CRM 按钮函数中使用这个 URL 格式

---

## 测试流程

1. 在 CRM 中创建一个 Deal，添加子表产品数据
2. 将 Deal 状态改为 Closed Won
3. 点击"确认采购产品"按钮
4. 验证：
   - 是否正确跳转到 Creator 页面
   - 页面是否显示产品列表
   - 勾选产品并确认后，是否创建了 Products_Purchased 记录

---

## 常见问题

### Q1: 页面显示空白或报错

检查：
- Creator 连接是否正确配置
- Deal ID 是否正确传递
- 子表 API 名称是否为 `Product_Interested_In`

### Q2: 创建 Products_Purchased 失败

检查：
- CRM 连接是否有创建权限
- Products_Purchased 模块的必填字段是否都已赋值
- 查看 Creator 日志中的错误信息

### Q3: 中文字符乱码

确保：
- 使用 `urlencode()` 对 URL 参数编码
- Creator 页面已设置 UTF-8 编码

---

## 扩展功能（可选）

1. **添加loading效果**：在页面加载时显示加载动画
2. **批量操作**：支持全选/反选
3. **创建后回跳**：创建成功后自动关闭页面或跳转回 CRM
4. **发送通知**：创建成功后发送邮件通知相关人员
