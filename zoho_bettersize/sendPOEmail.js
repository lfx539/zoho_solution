
// 获取采购订单 ID
purchaseorderId = purchaseorder.get("purchaseorder_id");
organizationId = organization.get("organization_id");
customFieldHash = purchaseorder.get("custom_field_hash");
if(customFieldHash != null)
{
	remarks = customFieldHash.get("cf_remarks");
}
// 构建邮件参数
emailParams = Map();
emailParams.put("to_mail_ids",{"liufangxin539@163.com"});
// 替换为实际的供应商邮箱
emailParams.put("send_from_org_email_id",true);
// 可选：添加抄送
// emailParams.put("cc_mail_ids", ["manager@example.com"]);
// 可选：自定义邮件主题和内容
emailParams.put("subject","您有一个任务待审批");
emailParams.put("body","尊敬的供应商，请查收附件中的采购订单。" + remarks);
// 发送邮件
response = invokeurl
[
	url :"https://www.zohoapis.com/books/v3/purchaseorders/" + purchaseorderId + "/email?organization_id=" + organizationId
	type :POST
	parameters:emailParams.toString()
	connection:"books"
];
info "邮件发送响应: " + response;
