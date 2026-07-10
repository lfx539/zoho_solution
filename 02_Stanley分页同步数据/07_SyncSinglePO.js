string standalone.SyncSinglePO(String poId)
{
result = Map();
// 1. 从NetSuite获取PO数据
poUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/purchaseorder/" + poId;
auth = standalone.SetHeaders("GET",poUrl,true);
headers = {"Content-Type":"application/json","Authorization":auth};
response = invokeurl
[
	url :poUrl + "?expandSubResources=true"
	type :GET
	headers:headers
];
if(response == null)
{
	result.put("error","获取PO详情失败");
	return result;
}
// 检查是否有错误响应
try
{
	responseContent = response.getFileContent();
	if(responseContent == null)
	{
		result.put("error","响应内容为空");
		return result;
	}
	// 尝试解析为JSON
	responseList = responseContent.toJSONList();
	if(responseList == null || responseList.size() == 0)
	{
		result.put("error","无法解析响应数据");
		return result;
	}
	poDetail = responseList.get(0);
	// 检查是否有错误信息
	if(poDetail.containsKey("error"))
	{
		errorMsg = poDetail.get("error");
		if(errorMsg != null)
		{
			result.put("error","NetSuite API错误: " + errorMsg);
			return result;
		}
	}
	// 检查是否有 status 字段（可能是错误响应）
	if(poDetail.containsKey("status") && poDetail.get("status") != "success")
	{
		statusMsg = poDetail.get("message");
		if(statusMsg != null)
		{
			result.put("error","NetSuite错误: " + statusMsg);
			return result;
		}
	}
}
catch (parseError)
{
	result.put("error","解析PO详情失败: " + parseError);
	return result;
}
if(poDetail == null)
{
	result.put("error","PO详情为空");
	return result;
}
netSuiteId = poDetail.get("id");
if(netSuiteId == null)
{
	result.put("error","无法获取NetSuite ID");
	return result;
}
// 2. 构建PO字段
params = Map();
params.put("Subject",netSuiteId);
params.put("PO_Number",poDetail.get("tranId"));
params.put("PO_Date",poDetail.get("tranDate"));
params.put("Email",poDetail.get("email"));
params.put("Balance",poDetail.get("balance"));
params.put("ExchangeRate",poDetail.get("exchangeRate"));
// 固定Owner为Sean Ren
params.put("Owner","102317000000370001");
// 处理Vendor (entity)
entityObj = poDetail.get("entity");
if(entityObj != null)
{
	vendorId = entityObj.get("id");
	// 查找CRM中对应的Vendor
	vendorRecord = zoho.crm.searchRecords("Vendors","(Netsuite_Id:equals:" + vendorId + ")");
	if(vendorRecord != null && vendorRecord.size() > 0)
	{
		params.put("Vendor_Name",{"id":vendorRecord.get(0).get("id")});
	}
}
// 处理Location
locationObj = poDetail.get("location");
if(locationObj != null)
{
	params.put("Location",locationObj.get("refName"));
}
// 处理Status
statusObj = poDetail.get("status");
if(statusObj != null)
{
	params.put("Status",statusObj.get("refName"));
}
// 处理Terms
termsObj = poDetail.get("terms");
if(termsObj != null)
{
	params.put("Terms_and_Conditions",termsObj.get("refName"));
}
// 处理Billing Address
billingAddressObj = poDetail.get("billingAddress");
if(billingAddressObj != null)
{
	params.put("Billing_Street",billingAddressObj.get("addr1"));
	params.put("Billing_City",billingAddressObj.get("city"));
	params.put("Billing_State",billingAddressObj.get("state"));
	params.put("Billing_Code",billingAddressObj.get("zip"));
	countryObj = billingAddressObj.get("country");
	if(countryObj != null)
	{
		params.put("Billing_Country",countryObj.get("refName"));
	}
}
// 处理Shipping Address
shippingAddressObj = poDetail.get("shippingAddress");
if(shippingAddressObj != null)
{
	params.put("Shipping_Street",shippingAddressObj.get("addr1"));
	params.put("Shipping_City",shippingAddressObj.get("city"));
	params.put("Shipping_State",shippingAddressObj.get("state"));
	params.put("Shipping_Code",shippingAddressObj.get("zip"));
	shippingCountryObj = shippingAddressObj.get("country");
	if(shippingCountryObj != null)
	{
		params.put("Shipping_Country",shippingCountryObj.get("refName"));
	}
}
// 3. 构建子表数据 (Purchase_Items)
itemList = List();
itemObj = poDetail.get("item");
if(itemObj != null)
{
	itemsList = itemObj.get("items");
	if(itemsList != null && itemsList.size() > 0)
	{
		for each  item in itemsList
		{
			itemRecord = item.get("item");
			if(itemRecord != null)
			{
				itemId = itemRecord.get("id");
				// 查找CRM中对应的产品
				productRecord = zoho.crm.searchRecords("Products","(Internal_ID:equals:" + itemId + ")");
				if(productRecord != null && productRecord.size() > 0)
				{
					productData = productRecord.get(0);
					productId = productData.get("id");
					// 使用 getRecordById 获取完整的产品记录
					fullProductRecord = zoho.crm.getRecordById("Products",productId);
					productInactive = fullProductRecord.get("IsInactive");
					// 获取真实的 inactive 状态
					// 打印产品 inactive 状态
					info "Item " + itemId + " -> Product " + productId + ", IsInactive: " + productInactive;
					// 如果产品不是 inactive（包括字段为空、false、null、0、"false"），才添加到列表
					if(productInactive != true && productInactive != "true" && productInactive != 1 && productInactive != "1")
					{
						itemParams = Map();
						itemParams.put("Product_Name",{"id":productId});
						itemParams.put("Product_Description",item.get("description"));
						itemParams.put("Quantity",item.get("quantity"));
						itemRate = item.get("rate");
						if(itemRate != null)
						{
							itemParams.put("Rate",itemRate);
						}
						itemParams.put("isBillable",item.get("isBillable"));
						itemParams.put("isClosed",item.get("isClosed"));
						itemParams.put("isOpen",item.get("isOpen"));
						itemParams.put("Lead_Time",item.get("leadTime"));
						itemParams.put("Quantity_Available",item.get("quantityAvailable"));
						itemParams.put("Quantity_Billed",item.get("quantityBilled"));
						itemParams.put("Quantity_OnHand",item.get("quantityOnHand"));
						itemParams.put("Quantity_Received",item.get("quantityReceived"));
						// 处理GST Code
						taxCodeObj = item.get("taxCode");
						if(taxCodeObj != null)
						{
							itemParams.put("GST_Code",taxCodeObj.get("refName"));
						}
						// 处理Units
						units = item.get("units");
						if(units != null)
						{
							itemParams.put("Units",standalone.ConvertSaleUnit(units));
						}
						itemList.add(itemParams);
					}
				}
			}
		}
	}
}
// 处理expense数据（合并到Purchase_Items）
expenseObj = poDetail.get("expense");
if(expenseObj != null)
{
	expenseItems = expenseObj.get("items");
	if(expenseItems != null && expenseItems.size() > 0)
	{
		for each  expense in expenseItems
		{
			expenseParams = Map();
			// 标记为 Expense 类型
			expenseParams.put("Item_Type","Expense");
			// Account 作为 Product_Description
			accountObj = expense.get("account");
			if(accountObj != null)
			{
				expenseParams.put("Product_Description",accountObj.get("refName"));
			}
			// 金额（expense 类型：Quantity=1, Rate=amount）
			amount = expense.get("amount");
			if(amount != null)
			{
				expenseParams.put("Quantity",1);
				expenseParams.put("Rate",round(amount,2));
			}
			// Tax
			tax1Amt = expense.get("tax1Amt");
			if(tax1Amt != null)
			{
				expenseParams.put("GST",round(tax1Amt,2));
			}
			// Tax Code
			taxCodeObj = expense.get("taxCode");
			if(taxCodeObj != null)
			{
				expenseParams.put("GST_Code",taxCodeObj.get("refName"));
			}
			// Location
			expenseLocationObj = expense.get("location");
			if(expenseLocationObj != null)
			{
				expenseParams.put("Location",expenseLocationObj.get("refName"));
			}
			// Memo
			memo = expense.get("memo");
			if(memo != null && memo != "")
			{
				expenseParams.put("Product_Description",memo);
			}
			itemList.add(expenseParams);
		}
	}
}
// 4. 检查PO是否存在并执行创建/更新
checkDetail = zoho.crm.searchRecords("Purchase_Orders","(Subject:equals:" + netSuiteId + ")");
if(checkDetail != null && checkDetail.size() > 0)
{
	// 更新PO：删除旧子表项 + 添加新子表项
	existingId = checkDetail.get(0).get("id");
	// GET请求获取完整记录（包含子表信息）
	getResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/Purchase_Orders/" + existingId
		type :GET
		connection:"crm"
	];
	existingPODetail = null;
	if(getResp != null && getResp.get("data") != null && getResp.get("data").size() > 0)
	{
		existingPODetail = getResp.get("data").get(0);
	}
	itemsPayload = List();
	// 标记删除旧行
	if(existingPODetail != null)
	{
		existingItems = existingPODetail.get("Purchase_Items");
		if(existingItems != null && existingItems.size() > 0)
		{
			for each  lineItem in existingItems
			{
				lineItemId = lineItem.get("id");
				if(lineItemId != null)
				{
					itemsPayload.add({"id":lineItemId,"_delete":true});
				}
			}
		}
	}
	// 添加新行（如果有）
	if(itemList.size() > 0)
	{
		itemsPayload.addAll(itemList);
	}
	params.put("Purchase_Items",itemsPayload);
	resParams = Map();
	resList = List();
	resList.add(params);
	resParams.put("data",resList);
	updateResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/Purchase_Orders/" + existingId
		type :PUT
		parameters:resParams.toString()
		connection:"crm"
	];
	result.put("res",updateResp);
}
else
{
	// 创建新PO
	if(itemList.size() > 0)
	{
		params.put("Purchase_Items",itemList);
	}
	resParams = Map();
	resList = List();
	resList.add(params);
	resParams.put("data",resList);
	addResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/Purchase_Orders"
		type :POST
		parameters:resParams.toString()
		connection:"crm"
	];
	result.put("res",addResp);
}
return result;
}