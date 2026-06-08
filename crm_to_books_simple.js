/*
 * Zoho CRM - 跳转到 Zoho Books 新建报价单 (简化版)
 * 不需要 Connection，直接通过 URL 跳转
 *
 * 优点: 简单快捷，不需要 API 配置
 * 缺点: 无法预填客户信息，需手动填写
 */

organizationId = "891257442";

// 直接打开 Zoho Books 新建报价单页面
booksUrl = "https://books.zoho.com/app/" + organizationId + "#/quotes/new";

openUrl(booksUrl, "new window");