string standalone.SyncSingleSalesOrder(String orderId)
{
result = Map();
// 1. 从NetSuite获取订单数据
soListUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/salesOrder/" + orderId;
auth = standalone.SetHeaders("GET",soListUrl,true);
response = invokeurl
[
	url :soListUrl + "?expandSubResources=true"
	type :GET
	headers:{"Content-Type":"application/json","Authorization":auth}
];
if(response == null)
{
	result.put("error","获取订单详情失败");
	return result;
}
soDetail = response.getFileContent().toJSONList().get(0);
netsuiteId = soDetail.get("id");
accountid = null;
// 2. 构建主表字段
soParams = Map();
soParams.put("Subject",netsuiteId);
soParams.put("Order_Number",soDetail.get("tranId"));
soParams.put("Customer_Name",soDetail.get("email"));
// 处理地址字段（可能返回对象或字符串）
shippingAddress = soDetail.get("shippingAddress");
if(shippingAddress != null)
{
	if(shippingAddress.toString().contains("addrText"))
	{
		soParams.put("Shipping_Address",shippingAddress.get("addrText"));
	}
	else
	{
		soParams.put("Shipping_Address",shippingAddress.toString());
	}
}
else
{
	soParams.put("Shipping_Address",soDetail.get("shipAddress"));
}
billingAddress = soDetail.get("billingAddress");
if(billingAddress != null)
{
	if(billingAddress.toString().contains("addrText"))
	{
		soParams.put("Billing_Address",billingAddress.get("addrText"));
	}
	else
	{
		soParams.put("Billing_Address",billingAddress.toString());
	}
}
else
{
	soParams.put("Billing_Address",soDetail.get("billAddress"));
}
soMemo = soDetail.get("memo");
if(soMemo != null && soMemo.length() > 255)
{
	soParams.put("Memo_Long",soMemo);
}
else
{
	soParams.put("Memo",soMemo);
}
soParams.put("Date",soDetail.get("tranDate"));
soParams.put("Shipping_Cost",soDetail.get("shippingCost"));
soParams.put("Discount",soDetail.get("discountTotal"));
// 获取Account信息
entity = soDetail.get("entity");
if(entity != null)
{
	accountid = entity.get("id");
	soParams.put("Customer_No",accountid);
	accountDetail = zoho.crm.searchRecords("Accounts","(Netsuite_ID:equals:" + accountid + ")");
	if(accountDetail != null && accountDetail.size() > 0)
	{
		soParams.put("Account_Name",{"id":accountDetail.get(0).get("id")});
	}
}
// 获取Shipping Method
shipMethod = soDetail.get("shipMethod");
if(shipMethod != null)
{
	if(shipMethod.toString().contains("refName"))
	{
		soParams.put("Shipping_Method",shipMethod.get("refName"));
	}
	else
	{
		soParams.put("Shipping_Method",shipMethod.toString());
	}
}
soOwner = soDetail.get("salesRep");
if(soOwner != null)
{
	soOwnerName = soOwner.get("refName");
	soOwnerID = standalone.mapSalesRep(soOwnerName);
	info soOwnerID;
	soParams.put("Owner",soOwnerID);
}
else
{
	// 没有salesRep时，默认设为Sean Ren
	soParams.put("Owner","102317000000370001");
}
// 3. 构建子表数据
prodList = List();
soItems = soDetail.get("item");
if(soItems != null)
{
	itemsList = soItems.get("items");
	if(itemsList != null && itemsList.size() > 0)
	{
		for each  item in itemsList
		{
			itemObj = item.get("item");
			if(itemObj != null)
			{
				itemId = itemObj.get("id");
				info itemId;
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
					// 检查是否为 surcharge 产品，同步 amount 到 Total
					itemName = itemObj.get("refName");
					if(itemName != null && itemName.toLowerCase().contains("surcharge"))
					{
						itemAmount = item.get("amount");
						if(itemAmount != null)
						{
							prodListParams.put("Total",round(itemAmount,2));
						}
					}
					prodListParams.put("On_hand",item.get("quantityOnHand"));
					prodListParams.put("Fulfilled",item.get("quantityFulfilled"));
					prodListParams.put("Invoiced",item.get("quantityBilled"));
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
// 4. 检查订单是否存在并执行创建/更新
existingOrders = zoho.crm.searchRecords("Sales_Orders","(Subject:equals:" + netsuiteId + ")");
if(existingOrders != null && existingOrders.size() > 0)
{
	// 更新订单：删除旧子表项 + 添加新子表项
	existingOrderId = existingOrders.get(0).get("id");
	existingLineItems = existingOrders.get(0).get("Product_Details");
	orderedItemsPayload = List();
	// 标记删除旧行
	if(existingLineItems != null && existingLineItems.size() > 0)
	{
		for each  lineItem in existingLineItems
		{
			lineItemId = lineItem.get("id");
			if(lineItemId != null)
			{
				orderedItemsPayload.add({"id":lineItemId,"_delete":true});
			}
		}
	}
	// 添加新行（如果有）
	if(prodList.size() > 0)
	{
		orderedItemsPayload.addAll(prodList);
	}
	soParams.put("Ordered_Items",orderedItemsPayload);
	// 构建请求参数
	soList = List();
	soList.add(soParams);
	parameters = Map();
	parameters.put("data",soList);
	updateResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/Sales_Orders/" + existingOrderId
		type :PUT
		parameters:parameters.toString()
		connection:"crm"
	];
	if(updateResp == null)
	{
		result.put("error","同步SO失败");
		return result;
	}
	result.put("res",updateResp);
}
else
{
	// 创建新订单
	if(prodList.size() > 0)
	{
		soParams.put("Ordered_Items",prodList);
	}
	// 构建请求参数
	soList = List();
	soList.add(soParams);
	parameters = Map();
	parameters.put("data",soList);
	addResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/Sales_Orders"
		type :POST
		parameters:parameters.toString()
		connection:"crm"
	];
	if(addResp == null)
	{
		result.put("error","同步SO失败");
		return result;
	}
	result.put("res",addResp);
}
return result;
}
