# Zoho Solution

Zoho CRM 与 Zoho Books 集成解决方案。

## 功能

- **CRM 到 Books 跳转按钮**: 在 Zoho CRM 中点击按钮，跳转到 Zoho Books 新建报价单页面

## 文件说明

| 文件 | 说明 |
|------|------|
| `crm_to_books_button.js` | Zoho CRM Deluge 脚本 - 创建跳转按钮 |
| `README.md` | 说明文档 |

## 配置步骤

### 1. 创建 Connection

在 Zoho CRM 中创建连接到 Zoho Books 的 Connection：

1. 进入 **设置** > **扩展** > **API** > **连接**
2. 创建新连接，使用 OAuth 授权
3. 需要的权限：
   - Zoho Books: `ZohoBooks.fullaccess.all`
   - Zoho CRM: `ZohoCRM.modules.all`

### 2. 添加自定义按钮

在 Zoho CRM 的目标模块（如 Contacts、Accounts 或 Quotes）中添加自定义按钮：

1. 进入 **设置** > **定制** > **模块和字段**
2. 选择目标模块
3. 添加按钮，粘贴 `crm_to_books_button.js` 中的代码

## 注意事项

- 需要提供有效的 Connection 名称
- 确保 Zoho Books 组织 ID 正确
- 根据实际需求调整传递的参数