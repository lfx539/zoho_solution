/*
 * CRM 按钮 Deluge 函数
 *
 * 功能：跳转到 Creator 产品选择页面
 * 触发：蓝图 Closed Won 状态点击按钮
 *
 * 配置步骤：
 * 1. 在 Zoho CRM > 设置 > 自动化 > 蓝图
 * 2. Closed Won 状态添加按钮
 * 3. 按钮执行此函数
 */

string button.ConfirmPurchaseProducts()
{
    // 获取当前 Deal 记录 ID
    dealId = record.get("id");

    // 获取 Deal 名称（用于 Creator 页面标题显示）
    dealName = record.get("Deal_Name");

    // Creator 应用配置
    // TODO: 替换为你的 Creator 应用信息
    // 可以在 Creator 页面预览时从浏览器地址栏获取完整 URL
    creatorOwner = "你的组织名";                    // Zoho Creator 账号所有者
    creatorAppName = "deal-product-selector";       // Creator 应用名称
    creatorPageName = "ProductSelectionPage";       // Creator 页面名称

    // 拼接 Creator 页面 URL
    // 格式：https://creator.zoho.com/{owner}/{app}/#Script:{page}?deal_id={dealId}
    creatorUrl = "https://creator.zoho.com/" + creatorOwner + "/" + creatorAppName + "/#Script:" + creatorPageName + "?deal_id=" + dealId + "&deal_name=" + urlencode(dealName);

    // 跳转到 Creator 页面（新窗口打开）
    openUrl(creatorUrl, "new window");

    return "";
}
