void PO_Daily_Reminder( Map organization) {

// 从参数获取组织 ID
orgId = organization.get("organization_id");
// 获取今天日期
today = zoho.currentdate;
todayStr = today.toString("yyyy-MM-dd");
info "开始执行采购订单提醒 - " + todayStr;
// 使用 invokeurl 查询所有采购订单
response = invokeurl
[
	url :"https://www.zohoapis.com/books/v3/purchaseorders?organization_id=" + orgId
	type :GET
	connection:"books"
];
// 从响应中提取采购订单列表
allOrders = response.get("purchaseorders");
if(allOrders == null)
{
	info "未找到采购订单";
	return;
}
reminderCount = 0;
for each  order in allOrders
{
	// 使用 unformatted 字段，格式为 yyyy-MM-dd
	remindDate = order.get("cf_remind_date_unformatted");
	// 检查：日期字段有值
	if(remindDate != null && remindDate != "")
	{
		remindDateObj = remindDate.toDate("yyyy-MM-dd");
		info "PO: " + order.get("purchaseorder_number") + ", Remind Date: " + remindDate + ", after parse: " + remindDateObj;
		if(remindDateObj >= today)
		{
			purchaseorderId = order.get("purchaseorder_id");
			orderNo = order.get("purchaseorder_number");
			info "Deal with PO: " + orderNo + ", Remind date: " + remindDate;
			// 获取 remarks
			customFieldHash = order.get("custom_field_hash");
			remarks = "";
			if(customFieldHash != null)
			{
				remarks = ifnull(customFieldHash.get("cf_remarks"),"");
			}
			// 构建邮件参数
			emailParams = Map();
			emailParams.put("to_mail_ids",{"liufangxin539@163.com"});
			emailParams.put("send_from_org_email_id",true);
			emailParams.put("subject","Reminder: Submit PO Request!");
			emailParams.put("body","Dear users, please submit po request before " + remindDateObj);
			// 发送邮件
			// 使用 sendmail 直接发送邮件（不依赖采购订单审批 API）
			sendmail
			[
				from :zoho.adminuserid
				to :"liufangxin539@163.com"
				subject :"Purchase Order Reminder: " + orderNo
				message :"Dear approver,\n\nThis is a reminder for Purchase Order: " + orderNo + "\nReminder Date: " + remindDate + "\n\nPlease take action."
			]
			info "PO " + orderNo + " Email Sent. ";
			reminderCount = reminderCount + 1;
		}
	}
}
info "Finish，totally send " + reminderCount + " emails";
}