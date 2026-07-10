string standalone.SyncSingleInvoice(String invoiceId)
{
result = Map();
// 1. 从NetSuite获取发票数据
invoiceUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/invoice/" + invoiceId;
auth = standalone.SetHeaders("GET",invoiceUrl,true);
response = invokeurl
[
	url :invoiceUrl + "?expandSubResources=true"
	type :GET
	headers:{"Content-Type":"application/json","Authorization":auth}
];
if(response == null)
{
	result.put("error","获取发票详情失败");
	return result;
}
invoiceDetail = response.getFileContent().toJSONList().get(0);
netsuiteId = invoiceDetail.get("id");
accountid = null;
// 2. 构建主表字段
invoiceParams = Map();
invoiceParams.put("Subject",netsuiteId);
invoiceParams.put("Invoice_No",invoiceDetail.get("tranId"));
// 处理地址字段（可能返回对象或字符串）
shippingAddress = invoiceDetail.get("shippingAddress");
if(shippingAddress != null)
{
	if(shippingAddress.toString().contains("addrText"))
	{
		invoiceParams.put("Shipping_Address",shippingAddress.get("addrText"));
	}
	else
	{
		invoiceParams.put("Shipping_Address",shippingAddress.toString());
	}
}
else
{
	invoiceParams.put("Shipping_Address",invoiceDetail.get("shipAddress"));
}
billingAddress = invoiceDetail.get("billingAddress");
if(billingAddress != null)
{
	if(billingAddress.toString().contains("addrText"))
	{
		invoiceParams.put("Billing_Address",billingAddress.get("addrText"));
	}
	else
	{
		invoiceParams.put("Billing_Address",billingAddress.toString());
	}
}
else
{
	invoiceParams.put("Billing_Address",invoiceDetail.get("billAddress"));
}
invoiceMemo = invoiceDetail.get("memo");
if(invoiceMemo != null && invoiceMemo.length() > 255)
{
	invoiceParams.put("Memo_Long",invoiceMemo);
}
else
{
	invoiceParams.put("Memo",invoiceMemo);
}
// 添加日期字段：Invoice_Date 对应 tranDate，Due_Date 对应 dueDate
invoiceParams.put("Invoice_Date",invoiceDetail.get("tranDate"));
invoiceParams.put("Due_Date",invoiceDetail.get("dueDate"));
invoiceParams.put("Shipping_Cost",invoiceDetail.get("shippingCost"));
invoiceParams.put("Discount_Total",invoiceDetail.get("discountTotal"));
// 添加 SalesRep 作为 Invoice Owner
invoiceOwner = invoiceDetail.get("salesRep");
if(invoiceOwner != null)
{
	invoiceOwnerName = invoiceOwner.get("refName");
	invoiceOwnerID = standalone.mapSalesRep(invoiceOwnerName);
	// 只有当返回有效ID时才设置，否则使用默认值
	if(invoiceOwnerID != null && invoiceOwnerID != "")
	{
		invoiceParams.put("Owner",invoiceOwnerID);
	}
	else
	{
		// 未匹配到用户，默认设为Sean Ren
		invoiceParams.put("Owner","102317000000370001");
	}
}
else
{
	// 没有salesRep时，默认设为Sean Ren
	invoiceParams.put("Owner","102317000000370001");
}
// 添加 Status 字段
invoiceStatus = invoiceDetail.get("status");
if(invoiceStatus != null)
{
	statusRefName = invoiceStatus.get("refName");
	if(statusRefName != null && statusRefName != "")
	{
		invoiceParams.put("Status",statusRefName);
	}
}
// 获取Account信息
entity = invoiceDetail.get("entity");
if(entity != null)
{
	accountid = entity.get("id");
	accountDetail = zoho.crm.searchRecords("Accounts","(Netsuite_ID:equals:" + accountid + ")");
	if(accountDetail != null && accountDetail.size() > 0)
	{
		invoiceParams.put("Account_Name",{"id":accountDetail.get(0).get("id")});
	}
}
// 获取Sales Order信息
createdFrom = invoiceDetail.get("createdFrom");
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
				invoiceParams.put("Sales_Order",{"id":salesDetail.get(0).get("id")});
			}
		}
	}
}
// 3. 构建子表数据
prodList = List();
invItems = invoiceDetail.get("item");
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
					if(itemRate == null)
					{
						itemRate = 0;
					}
					prodListParams.put("Rate",itemRate);
					prodListParams.put("Quantity",item.get("quantity"));
					prodListParams.put("Ordered",item.get("quantityOrdered"));
					// 处理 SAmount：两种情况同步 amount 到 SAmount
					// 1. surcharge 产品
					// 2. rate 为空但 amount 有值（老数据情况）
					itemName = itemObj.get("refName");
					itemAmount = item.get("amount");
					shouldSyncAmount = false;
					// 情况1：surcharge 产品
					if(itemName != null && itemName.toLowerCase().contains("surcharge"))
					{
						shouldSyncAmount = true;
					}
					// 情况2：rate 为空但 amount 有值
					if(item.get("rate") == null && itemAmount != null)
					{
						shouldSyncAmount = true;
					}
					if(shouldSyncAmount && itemAmount != null)
					{
						prodListParams.put("SAmount",round(itemAmount,2));
					}
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
// 4. 检查发票是否存在并执行创建/更新
existingInvoices = zoho.crm.searchRecords("Invoices","(Subject:equals:" + netsuiteId + ")");
if(existingInvoices != null && existingInvoices.size() > 0)
{
	// 更新发票：删除旧子表项 + 添加新子表项
	existingInvoiceId = existingInvoices.get(0).get("id");
	existingLineItems = existingInvoices.get(0).get("Product_Details");
	invoicedItemsPayload = List();
	// 标记删除旧行
	if(existingLineItems != null && existingLineItems.size() > 0)
	{
		for each  lineItem in existingLineItems
		{
			lineItemId = lineItem.get("id");
			if(lineItemId != null)
			{
				invoicedItemsPayload.add({"id":lineItemId,"_delete":true});
			}
		}
	}
	// 添加新行（如果有）
	if(prodList.size() > 0)
	{
		invoicedItemsPayload.addAll(prodList);
	}
	invoiceParams.put("Invoiced_Items",invoicedItemsPayload);
	// 构建请求参数
	invoiceList = List();
	invoiceList.add(invoiceParams);
	parameters = Map();
	parameters.put("data",invoiceList);
	updateResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/Invoices/" + existingInvoiceId
		type :PUT
		parameters:parameters.toString()
		connection:"crm"
	];
	if(updateResp == null)
	{
		result.put("error","同步发票失败");
		return result;
	}
	result.put("res",updateResp);
}
else
{
	// 创建新发票
	if(prodList.size() > 0)
	{
		invoiceParams.put("Invoiced_Items",prodList);
	}
	// 构建请求参数
	invoiceList = List();
	invoiceList.add(invoiceParams);
	parameters = Map();
	parameters.put("data",invoiceList);
	addResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/Invoices"
		type :POST
		parameters:parameters.toString()
		connection:"crm"
	];
	if(addResp == null)
	{
		result.put("error","同步发票失败");
		return result;
	}
	result.put("res",addResp);
}
return result;
}