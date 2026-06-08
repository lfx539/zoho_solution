string standalone.SyncSingleCashSale(String cashSaleId)
{
result = Map();
// 1. 从NetSuite获取Cash Sale数据
cashSaleUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/CashSale/" + cashSaleId;
auth = standalone.SetHeaders("GET",cashSaleUrl,true);
response = invokeurl
[
	url :cashSaleUrl + "?expandSubResources=true"
	type :GET
	headers:{"Content-Type":"application/json","Authorization":auth}
];
if(response == null)
{
	result.put("error","获取Cash Sale详情失败");
	return result;
}
cashSaleDetail = response.getFileContent().toJSONList().get(0);
netsuiteId = cashSaleDetail.get("id");
accountid = null;
// 2. 构建主表字段
cashSaleParams = Map();
cashSaleParams.put("Subject",netsuiteId);
cashSaleParams.put("Name",cashSaleDetail.get("tranId"));
// 处理地址字段（可能返回对象或字符串）
shippingAddress = cashSaleDetail.get("shippingAddress");
if(shippingAddress != null)
{
	if(shippingAddress.toString().contains("addrText"))
	{
		cashSaleParams.put("Shipping_Address",shippingAddress.get("addrText"));
	}
	else
	{
		cashSaleParams.put("Shipping_Address",shippingAddress.toString());
	}
}
else
{
	cashSaleParams.put("Shipping_Address",cashSaleDetail.get("shipAddress"));
}
billingAddress = cashSaleDetail.get("billingAddress");
if(billingAddress != null)
{
	if(billingAddress.toString().contains("addrText"))
	{
		cashSaleParams.put("Billing_Address",billingAddress.get("addrText"));
	}
	else
	{
		cashSaleParams.put("Billing_Address",billingAddress.toString());
	}
}
else
{
	cashSaleParams.put("Billing_Address",cashSaleDetail.get("billAddress"));
}
cashSaleMemo = cashSaleDetail.get("memo");
if(cashSaleMemo != null && cashSaleMemo.length() > 255)
{
	cashSaleParams.put("Memo_Long",cashSaleMemo);
}
else
{
	cashSaleParams.put("Memo",cashSaleMemo);
}
cashSaleParams.put("Date",cashSaleDetail.get("dueDate"));
cashSaleParams.put("Shipping_Cost",cashSaleDetail.get("shippingCost"));
cashSaleParams.put("Discount",cashSaleDetail.get("discountTotal"));
// 获取Discount Item
discountItem = cashSaleDetail.get("discountItem");
if(discountItem != null)
{
	if(discountItem.toString().contains("refName"))
	{
		cashSaleParams.put("Discount_Item",discountItem.get("refName"));
	}
	else
	{
		cashSaleParams.put("Discount_Item",discountItem.toString());
	}
}
// 获取Account信息
entity = cashSaleDetail.get("entity");
if(entity != null)
{
	accountid = entity.get("id");
	accountDetail = zoho.crm.searchRecords("Accounts","(Netsuite_ID:equals:" + accountid + ")");
	if(accountDetail != null && accountDetail.size() > 0)
	{
		cashSaleParams.put("Account",{"id":accountDetail.get(0).get("id")});
	}
}
// 获取Sales Order信息
createdFrom = cashSaleDetail.get("createdFrom");
if(createdFrom != null)
{
	if(createdFrom.toString().contains("id"))
	{
		createdFromId = createdFrom.get("id");
		if(createdFromId != null)
		{
			salesDetail = zoho.crm.searchRecords("Sales_Orders","(Subject:equals:" + createdFromId + ")");
			if(salesDetail != null && salesDetail.size() > 0)
			{
				cashSaleParams.put("Sales_Order",{"id":salesDetail.get(0).get("id")});
			}
		}
	}
}
// 3. 构建子表数据
prodList = List();
invItems = cashSaleDetail.get("item");
if(invItems != null)
{
	itemsList = invItems.get("items");
	if(itemsList != null && itemsList.size() > 0)
	{
		for each  item in itemsList
		{
			itemObj = item.get("item");
			if(itemObj != null)
			{
				itemId = itemObj.get("id");
				itemRecord = zoho.crm.searchRecords("Products","(Internal_ID:equals:" + itemId + ")");
				if(itemRecord != null && itemRecord.size() > 0)
				{
					recordDetail = itemRecord.get(0);
					prodListParams = Map();
					prodListParams.put("Product_Name",{"id":recordDetail.get("id")});
					itemRate = item.get("rate");
					if(itemRate != null)
					{
						itemRate = round(itemRate,2);
					}
					else
					{
						itemRate = 0;
					}
					prodListParams.put("Rate",itemRate);
					prodListParams.put("Quantity",item.get("quantity"));
					prodListParams.put("Item_Description",item.get("description"));
					// 处理Price Level
					price = item.get("price");
					if(price != null)
					{
						if(price.toString().contains("refName"))
						{
							prodListParams.put("Price_Level",price.get("refName"));
						}
					}
					// 处理Units
					units = item.get("units");
					if(units != null)
					{
						prodListParams.put("Units",standalone.ConvertSaleUnit(units));
					}
					prodList.add(prodListParams);
				}
			}
		}
	}
}
// 4. 检查Cash Sale是否存在并执行创建/更新
existingCashSales = zoho.crm.searchRecords("Cash_Sale","(Subject:equals:" + netsuiteId + ")");
if(existingCashSales != null && existingCashSales.size() > 0)
{
	// 更新Cash Sale：删除旧子表项 + 添加新子表项
	existingCashSaleId = existingCashSales.get(0).get("id");
	// GET请求获取完整记录（包含子表信息）
	getResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/Cash_Sale/" + existingCashSaleId
		type :GET
		connection:"crm"
	];
	existingCashSaleDetail = null;
	if(getResp != null && getResp.get("data") != null && getResp.get("data").size() > 0)
	{
		existingCashSaleDetail = getResp.get("data").get(0);
	}
	itemsPayload = List();
	// 标记删除旧行
	if(existingCashSaleDetail != null)
	{
		existingLineItems = existingCashSaleDetail.get("Items");
		if(existingLineItems != null && existingLineItems.size() > 0)
		{
			for each  lineItem in existingLineItems
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
	if(prodList.size() > 0)
	{
		itemsPayload.addAll(prodList);
	}
	cashSaleParams.put("Items",itemsPayload);
	// 构建请求参数
	cashSaleList = List();
	cashSaleList.add(cashSaleParams);
	parameters = Map();
	parameters.put("data",cashSaleList);
	updateResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/Cash_Sale/" + existingCashSaleId
		type :PUT
		parameters:parameters.toString()
		connection:"crm"
	];
	if(updateResp == null)
	{
		result.put("error","同步Cash Sale失败");
		return result;
	}
	result.put("res",updateResp);
}
else
{
	// 创建新Cash Sale
	if(prodList.size() > 0)
	{
		cashSaleParams.put("Items",prodList);
	}
	// 构建请求参数
	cashSaleList = List();
	cashSaleList.add(cashSaleParams);
	parameters = Map();
	parameters.put("data",cashSaleList);
	addResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/Cash_Sale"
		type :POST
		parameters:parameters.toString()
		connection:"crm"
	];
	if(addResp == null)
	{
		result.put("error","同步Cash Sale失败");
		return result;
	}
	result.put("res",addResp);
}
return result;
}