/*
 * Zoho Books 自定义函数 - 获取采购订单自定义视图并发送邮件
 *
 * 功能：
 * 1. 获取采购订单自定义视图 "polist" 的列表
 * 2. 格式化数据为 HTML 表格
 * 3. 发送邮件给指定人员
 *
 * 使用方法：
 * 在 Zoho Books > 设置 > 自动化 > 自定义函数 中创建
 * 可以通过工作流或手动触发
 */

void SendPOListEmail(Map organization)
{
	// 获取组织 ID
	organizationId = organization.get("organization_id");
	info "Organization ID: " + organizationId;

	// ==================== 获取采购订单列表 ====================
	// 使用 invokeurl 调用 API

	apiUrl = "https://www.zohoapis.com/books/v3/purchaseorders?organization_id=" + organizationId;

	poListResp = invokeurl
	[
		url: apiUrl
		type: GET
		connection: "books"
	];

	info "PO List Response: " + poListResp;

	// ==================== 方法2：使用 invokeurl 调用 API ====================
	// 如果需要通过自定义视图 ID 获取，使用此方法
	// filterId = "你的自定义视图ID";  // 在 Zoho Books 中查看自定义视图的 ID

	// apiUrl = "https://www.zohoapis.com/books/v3/purchaseorders?organization_id=" + organizationId + "&filter_id=" + filterId;
	// poListResp = invokeurl
	// [
	// 	url: apiUrl
	// 	type: GET
	// 	connection: "books"
	// ];
	// poList = poListResp.get("purchaseorders");

	// ==================== 构建邮件内容 ====================
	emailSubject = "采购订单列表 - " + zoho.currentdate;

	emailBody = "<html><head><style>";
	emailBody = emailBody + "body { font-family: Arial, sans-serif; }";
	emailBody = emailBody + "table { border-collapse: collapse; width: 100%; }";
	emailBody = emailBody + "th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }";
	emailBody = emailBody + "th { background-color: #4CAF50; color: white; }";
	emailBody = emailBody + "tr:nth-child(even) { background-color: #f2f2f2; }";
	emailBody = emailBody + "</style></head><body>";

	emailBody = emailBody + "<h2>采购订单列表</h2>";
	emailBody = emailBody + "<p>生成时间：" + zoho.currenttime + "</p>";
	emailBody = emailBody + "<table>";
	emailBody = emailBody + "<tr><th>PO编号</th><th>供应商</th><th>日期</th><th>金额</th><th>状态</th></tr>";

	// 遍历采购订单列表
	purchaseOrders = poListResp.get("purchaseorders");
	if(purchaseOrders != null && purchaseOrders.size() > 0)
	{
		for each po in purchaseOrders
		{
			poNumber = ifnull(po.get("purchaseorder_number"), "");
			vendorName = ifnull(po.get("vendor_name"), "");
			poDate = ifnull(po.get("date"), "");
			total = ifnull(po.get("total"), "");
			status = ifnull(po.get("status"), "");

			emailBody = emailBody + "<tr>";
			emailBody = emailBody + "<td>" + poNumber + "</td>";
			emailBody = emailBody + "<td>" + vendorName + "</td>";
			emailBody = emailBody + "<td>" + poDate + "</td>";
			emailBody = emailBody + "<td>" + total + "</td>";
			emailBody = emailBody + "<td>" + status + "</td>";
			emailBody = emailBody + "</tr>";
		}
	}
	else
	{
		emailBody = emailBody + "<tr><td colspan='5'>暂无采购订单数据</td></tr>";
	}

	emailBody = emailBody + "</table>";

	// 计算记录数量
	poCount = 0;
	if(purchaseOrders != null)
	{
		poCount = purchaseOrders.size();
	}
	emailBody = emailBody + "<p>共计 " + poCount + " 条采购订单</p>";
	emailBody = emailBody + "</body></html>";

	// ==================== 发送邮件 ====================
	// 多个收件人用逗号分隔
	toEmail = "a@163.com,b@163.com";

	sendmail
	[
		from: zoho.adminuserid
		to: toEmail
		subject: emailSubject
		message: emailBody
	]

	info "邮件已发送至: " + toEmail;
}
