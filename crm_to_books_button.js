/*
 * Zoho CRM - 跳转到 Zoho Books 新建报价单
 * 模块: Contacts / Accounts / Quotes
 * 按钮类型: 自定义按钮 (onClick)
 *
 * 使用方式:
 * 1. 在 Zoho CRM 目标模块中添加自定义按钮
 * 2. 将本脚本粘贴到按钮的 "onClick" 动作中
 * 3. 根据实际情况修改下面的配置参数
 */

// ============ 配置参数 ============

// Connection 名称 (在 Zoho CRM 中创建)
connectionName = "zoho_books_connection";

// Zoho Books 组织 ID
organizationId = "YOUR_ORG_ID";

// 目标模块 (Contacts / Accounts / Quotes)
moduleName = "Contacts";

// ============ 业务逻辑 ============

// 获取当前记录 ID
recordId = input.id;

// 获取记录详情
recordData = zoho.crm.getRecordById(moduleName, recordId);

// 获取客户名称
customerName = ifnull(recordData.get("First_Name"), "") + " " + ifnull(recordData.get("Last_Name"), "");

// 获取客户邮箱
customerEmail = ifnull(recordData.get("Email"), "");

// 获取客户电话
customerPhone = ifnull(recordData.get("Phone"), "");

// 获取公司信息 (如果是 Contacts 模块)
accountId = "";
if(recordData.get("Account_Name") != null) {
    accountId = recordData.get("Account_Name").get("id");
    accountData = zoho.crm.getRecordById("Accounts", accountId);
    customerName = ifnull(accountData.get("Account_Name"), customerName);
}

// 构建 Zoho Books 新建报价单 URL
booksBaseUrl = "https://books.zoho.com.cn";
newQuoteUrl = booksBaseUrl + "/app/quotes/quote/new?v=" + organizationId;

// 添加预填参数
// 客户名称
urlWithCustomer = newQuoteUrl + "&customer_name=" + urlEncode(customerName);

// 准备跳转
openUrl(urlWithCustomer, "new window");

// ============ 可选: 通过 API 创建报价单 ============
/*
 * 如果需要通过 API 预创建报价单 (不只跳转)，可使用以下代码:
 */

/*
// 构建报价单数据
quoteData = Map();
quoteData.put("customer_name", customerName);
quoteData.put("email", customerEmail);
quoteData.put("phone", customerPhone);

// 调用 Zoho Books API 创建报价单
response = zoho.books.createRecord(
    "Quotes",
    organizationId,
    quoteData,
    connectionName
);

// 检查创建结果
if(response.get("code") == 0) {
    // 成功，跳转到编辑页面
    quoteId = response.get("quote").get("quote_id");
    openUrl(booksBaseUrl + "/app/quotes/quote/" + quoteId, "new window");
} else {
    // 失败，提示错误
    alert "创建报价单失败: " + response.get("message");
}
*/