string standalone.SyncSingleItemReceipt(String receiptId)
{
result = Map();
// 1. 从NetSuite获取ItemReceipt数据
receiptUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/itemreceipt/" + receiptId;
auth = standalone.SetHeaders("GET",receiptUrl,true);
headers = {"Content-Type":"application/json","Authorization":auth};
response = invokeurl
[
	url :receiptUrl + "?expandSubResources=true"
	type :GET
	headers:headers
];
if(response == null)
{
	result.put("error","获取ItemReceipt详情失败");
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
	receiptDetail = responseList.get(0);
	// 检查是否有错误信息
	if(receiptDetail.containsKey("error"))
	{
		errorMsg = receiptDetail.get("error");
		if(errorMsg != null)
		{
			result.put("error","NetSuite API错误: " + errorMsg);
			return result;
		}
	}
	// 检查是否有 status 字段（可能是错误响应）
	if(receiptDetail.containsKey("status") && receiptDetail.get("status") != "success")
	{
		statusMsg = receiptDetail.get("message");
		if(statusMsg != null)
		{
			result.put("error","NetSuite错误: " + statusMsg);
			return result;
		}
	}
}
catch (parseError)
{
	result.put("error","解析ItemReceipt详情失败: " + parseError);
	return result;
}
if(receiptDetail == null)
{
	result.put("error","ItemReceipt详情为空");
	return result;
}
netSuiteId = receiptDetail.get("id");
if(netSuiteId == null)
{
	result.put("error","无法获取NetSuite ID");
	return result;
}
// 2. 构建主表字段
params = Map();
params.put("Netsuite_Id",netSuiteId);
params.put("Name",receiptDetail.get("tranId"));
params.put("Transaction_Number",receiptDetail.get("tranId"));
// 处理日期
params.put("Receipt_Date",receiptDetail.get("tranDate"));
// 处理货币
currencyObj = receiptDetail.get("currency");
if(currencyObj != null)
{
	params.put("Currency_Type",currencyObj.get("refName"));
}
// 处理ExchangeRate
exchangeRate = receiptDetail.get("exchangeRate");
if(exchangeRate != null)
{
	params.put("ExchangeRate",round(exchangeRate,4));
}
// 处理Location
locationObj = receiptDetail.get("location");
if(locationObj != null)
{
	params.put("Location",locationObj.get("refName"));
}
// 处理Posting Period
postingPeriodObj = receiptDetail.get("postingPeriod");
if(postingPeriodObj != null)
{
	params.put("Posting_Period",postingPeriodObj.get("refName"));
}
// 处理Tran Date
params.put("Tran_Date",receiptDetail.get("tranDate"));
// 处理Created Date
params.put("Created_Date",receiptDetail.get("createdDate"));
// 处理PO关联
createdFromObj = receiptDetail.get("createdFrom");
if(createdFromObj != null)
{
	poId = createdFromObj.get("id");
	// 保存PO ID
	params.put("PO_ID",poId);
	// 查找CRM中的Purchase_Orders
	poRecord = zoho.crm.searchRecords("Purchase_Orders","(Subject:equals:" + poId + ")");
	if(poRecord != null && poRecord.size() > 0)
	{
		params.put("PO_Number",{"id":poRecord.get(0).get("id")});
	}
}
// 处理Vendor
entityObj = receiptDetail.get("entity");
if(entityObj != null)
{
	vendorId = entityObj.get("id");
	vendorRecord = zoho.crm.searchRecords("Vendors","(Netsuite_Id:equals:" + vendorId + ")");
	if(vendorRecord != null && vendorRecord.size() > 0)
	{
		params.put("Vendor_Name",{"id":vendorRecord.get(0).get("id")});
	}
}
// 固定Owner为Sean Ren
params.put("Owner","102317000000370001");
// 处理Class（主表字段）
classObj = receiptDetail.get("class");
if(classObj != null)
{
	params.put("Class",classObj.get("refName"));
}
// 3. 处理item子表
itemObj = receiptDetail.get("item");
itemList = List();
if(itemObj != null)
{
	itemItems = itemObj.get("items");
	if(itemItems != null && itemItems.size() > 0)
	{
		for each  item in itemItems
		{
			itemParams = Map();
			// 处理产品
			itemRecord = item.get("item");
			if(itemRecord != null)
			{
				itemId = itemRecord.get("id");
				itemRefName = itemRecord.get("refName");
				itemType = item.get("itemType");
				// 保存itemType
				itemParams.put("Item_Type",itemType);
				// 保存Item Name
				itemParams.put("Item_Name",item.get("itemName"));
				// 如果是库存商品，关联Products
				if(itemType == "InvtPart")
				{
					productRecord = zoho.crm.searchRecords("Products","(Internal_ID:equals:" + itemId + ")");
					if(productRecord != null && productRecord.size() > 0)
					{
						itemParams.put("Product_Name",{"id":productRecord.get(0).get("id")});
					}
				}
				else
				{
					// 非产品，存文本
					itemParams.put("Product_Reference",itemRefName);
				}
			}
			// 数量和价格
			quantity = item.get("quantity");
			if(quantity != null)
			{
				itemParams.put("Quantity",quantity.toLong());
			}
			rate = item.get("rate");
			if(rate != null)
			{
				itemParams.put("Rate",round(rate,2));
			}
			// 描述
			itemParams.put("Description",item.get("description"));
			// 单位
			itemParams.put("Units",item.get("units"));
			itemParams.put("Units_Display",item.get("unitsDisplay"));
			// On Hand - 转为整数
			onHand = item.get("onHand");
			if(onHand != null)
			{
				itemParams.put("On_Hand",onHand);
			}
			// 位置
			locationObj2 = item.get("location");
			if(locationObj2 != null)
			{
				itemParams.put("Location",locationObj2.get("refName"));
			}
			// Order Line
			orderLine = item.get("orderLine");
			if(orderLine != null)
			{
				itemParams.put("Order_Line",orderLine.toLong());
			}
			// Bill Variance Status
			billVarianceStatus = item.get("billVarianceStatus");
			if(billVarianceStatus != null)
			{
				itemParams.put("Status",billVarianceStatus.get("refName"));
			}
			itemList.add(itemParams);
		}
	}
}
// 4. 检查是否存在并执行创建/更新
checkDetail = zoho.crm.searchRecords("ItemReceipt","(Netsuite_Id:equals:" + netSuiteId + ")");
if(checkDetail != null && checkDetail.size() > 0)
{
	// 更新
	existingId = checkDetail.get(0).get("id");
	// 获取完整记录
	fullRecord = zoho.crm.getRecordById("ItemReceipt",existingId);
	existingItems = fullRecord.get("Receipt_Items");
	itemsPayload = List();
	if(existingItems != null && existingItems.size() > 0)
	{
		for each  existingItem in existingItems
		{
			existingItemId = existingItem.get("id");
			if(existingItemId != null)
			{
				itemsPayload.add({"id":existingItemId,"_delete":true});
			}
		}
	}
	if(itemList.size() > 0)
	{
		itemsPayload.addAll(itemList);
	}
	if(itemsPayload.size() > 0)
	{
		params.put("Receipt_Items",itemsPayload);
	}
	resParams = Map();
	resList = List();
	resList.add(params);
	resParams.put("data",resList);
	updateResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/ItemReceipt/" + existingId
		type :PUT
		parameters:resParams.toString()
		connection:"crm"
	];
	result.put("res",updateResp);
}
else
{
	// 创建
	if(itemList.size() > 0)
	{
		params.put("Receipt_Items",itemList);
	}
	resParams = Map();
	resList = List();
	resList.add(params);
	resParams.put("data",resList);
	addResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/ItemReceipt"
		type :POST
		parameters:resParams.toString()
		connection:"crm"
	];
	result.put("res",addResp);
}
return result;
}