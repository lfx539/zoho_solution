/*
 * Zoho Books - 采购订单 Shipping Method 确认
 *
 * 功能：
 * - 当采购订单选择不同 Shipping Method 时
 * - 设置 Confirmation Status 为 "pending"
 * - 根据不同选项给 cf_remarks 赋值不同信息
 *
 * 使用方法：
 * 在 Zoho Books > 设置 > 自动化 > 工作流 中创建工作流
 * 触发器：创建/编辑采购订单
 * 动作：执行此函数
 */

void ShippingMethodAlert(Map purchaseorder, Map organization, Map user)
{
	// 获取采购订单 ID
	purchaseorderId = purchaseorder.get("purchaseorder_id");
	organizationId = organization.get("organization_id");

	// 调试信息
	info "purchaseorderId: " + purchaseorderId;
	info "organizationId: " + organizationId;

	// 获取 Shipping Method
	shippingMethod = "";
	// 方法1: 从 custom_field_hash 获取
	customFieldHash = purchaseorder.get("custom_field_hash");
	if(customFieldHash != null)
	{
		shippingMethod = customFieldHash.get("cf_shipping_method");
	}
	// 方法2: 从 custom_fields 数组获取
	if(shippingMethod == null || shippingMethod == "")
	{
		customFields = purchaseorder.get("custom_fields");
		if(customFields != null && customFields.size() > 0)
		{
			for each field in customFields
			{
				if(field.get("api_name") == "cf_shipping_method")
				{
					shippingMethod = field.get("value");
					break;
				}
			}
		}
	}

	// 根据不同的 Shipping Method 设置备注
	remarks = "";
	if(shippingMethod == "Sea Freight")
	{
		remarks = "海运需要 4-6 周时间";
	}
	else if(shippingMethod == "Air Freight")
	{
		remarks = "空运需要 1-2 周时间";
	}
	else if(shippingMethod == "To Customer")
	{
		remarks = "货物会直接发送给客户";
	}
	info "运输方式: " + shippingMethod + "，备注: " + remarks;

	// 更新自定义字段
	if(remarks != "")
	{
		customFieldList = List();
		customFieldMap1 = Map();
		customFieldMap1.put('api_name',"cf_remarks");
		customFieldMap1.put('value', remarks);
		customFieldList.add(customFieldMap1);
		customFieldMap2 = Map();
		customFieldMap2.put('api_name',"cf_confirmation_status");
		customFieldMap2.put('value', "Pending");
		customFieldList.add(customFieldMap2);
		DataMap = Map();
		DataMap.put("custom_fields",customFieldList);
		response = invokeurl
		[
			url :"https://www.zohoapis.com/books/v3/purchaseorder/" + purchaseorderId + "/customfields?organization_id=" + organizationId
			type :PUT
			parameters:DataMap.toString()
			connection:"books"
		];
		info response;
	}
}
