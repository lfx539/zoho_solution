string standalone.SyncSingleVendorCredit(String creditId)
{
result = Map();
// 1. 从NetSuite获取VendorCredit数据
creditUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/vendorcredit/" + creditId;
auth = standalone.SetHeaders("GET",creditUrl,true);
headers = {"Content-Type":"application/json","Authorization":auth};
response = invokeurl
[
	url :creditUrl + "?expandSubResources=true"
	type :GET
	headers:headers
];
if(response == null)
{
	result.put("error","获取VendorCredit详情失败");
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
	creditDetail = responseList.get(0);
	// 检查是否有错误信息
	if(creditDetail.containsKey("error"))
	{
		errorMsg = creditDetail.get("error");
		if(errorMsg != null)
		{
			result.put("error","NetSuite API错误: " + errorMsg);
			return result;
		}
	}
	// 检查是否有 status 字段（可能是错误响应）
	if(creditDetail.containsKey("status") && creditDetail.get("status") != "success")
	{
		statusMsg = creditDetail.get("message");
		if(statusMsg != null)
		{
			result.put("error","NetSuite错误: " + statusMsg);
			return result;
		}
	}
}
catch (parseError)
{
	result.put("error","解析VendorCredit详情失败: " + parseError);
	return result;
}
if(creditDetail == null)
{
	result.put("error","VendorCredit详情为空");
	return result;
}
netSuiteId = creditDetail.get("id");
if(netSuiteId == null)
{
	result.put("error","无法获取NetSuite ID");
	return result;
}
// 2. 构建主表字段
params = Map();
params.put("Netsuite_Id",netSuiteId);
params.put("Name",creditDetail.get("tranId"));
params.put("Transaction_Num",creditDetail.get("transactionNumber"));
// 处理日期
params.put("Credit_Date",creditDetail.get("tranDate"));
// 处理金额
total = creditDetail.get("total");
if(total != null)
{
	params.put("Total",round(total,2));
}
taxTotal = creditDetail.get("taxTotal");
if(taxTotal != null)
{
	params.put("Tax_total",round(taxTotal,2));
}
applied = creditDetail.get("applied");
if(applied != null)
{
	params.put("Applied",round(applied,2));
}
unapplied = creditDetail.get("unapplied");
if(unapplied != null)
{
	params.put("Unapplied",round(unapplied,2));
}
// 处理ExchangeRate
exchangeRate = creditDetail.get("exchangeRate");
if(exchangeRate != null)
{
	params.put("ExchangeRate",round(exchangeRate,4));
}
// 处理货币
currencyObj = creditDetail.get("currency");
if(currencyObj != null)
{
	params.put("Currency_Type",currencyObj.get("refName"));
}
// 处理Billing Address
billingAddress = creditDetail.get("billAddress");
if(billingAddress != null && billingAddress != "")
{
	cleanAddress = billingAddress.replaceAll("<br>","\n").replaceAll("<br/>","\n");
	params.put("Billing_Address",cleanAddress);
}
// 处理Billing Address详细信息
billingAddressObj = creditDetail.get("billingAddress");
if(billingAddressObj != null)
{
	params.put("Billing_City",billingAddressObj.get("city"));
	params.put("Billing_State",billingAddressObj.get("state"));
	params.put("Billing_Zip",billingAddressObj.get("zip"));
	countryObj = billingAddressObj.get("country");
	if(countryObj != null)
	{
		params.put("Billing_Country",countryObj.get("refName"));
	}
}
// 处理Posting Period
postingPeriodObj = creditDetail.get("postingPeriod");
if(postingPeriodObj != null)
{
	params.put("Posting_Period",postingPeriodObj.get("refName"));
}
// 处理Tran Date
params.put("Tran_Date",creditDetail.get("tranDate"));
// 处理VatRegNum
vatRegNum = creditDetail.get("vatRegNum");
if(vatRegNum != null)
{
	params.put("VatRegNum",vatRegNum);
}
// 处理Location
locationObj = creditDetail.get("location");
if(locationObj != null)
{
	params.put("Location",locationObj.get("refName"));
}
// 处理Vendor
entityObj = creditDetail.get("entity");
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
// 3. 处理item子表 (Vendor_Credit_Items)
itemObj = creditDetail.get("item");
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
				itemTypeObj = item.get("itemType");
				itemType = "";
				if(itemTypeObj != null)
				{
					itemType = itemTypeObj.get("refName");
					itemParams.put("Item_Type",itemType);
				}
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
					itemParams.put("Product_Description",itemRefName);
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
			itemParams.put("Product_Description",item.get("description"));
			// 单位
			itemParams.put("Units",item.get("units"));
			// 类别
			classObj = item.get("class");
			if(classObj != null)
			{
				itemParams.put("Class",classObj.get("refName"));
			}
			// 位置
			locationObj = item.get("location");
			if(locationObj != null)
			{
				itemParams.put("Location",locationObj.get("refName"));
			}
			// GST Code
			taxCodeObj = item.get("taxCode");
			if(taxCodeObj != null)
			{
				itemParams.put("GST_Code",taxCodeObj.get("refName"));
			}
			itemList.add(itemParams);
		}
	}
}
// 4. 处理expense数据（合并到Vendor_Credit_Items）
expenseObj = creditDetail.get("expense");
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
			locationObj = expense.get("location");
			if(locationObj != null)
			{
				expenseParams.put("Location",locationObj.get("refName"));
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
// 5. 处理apply子表 (Credit_Applications)
applyObj = creditDetail.get("apply");
applyList = List();
if(applyObj != null)
{
	applyItems = applyObj.get("items");
	if(applyItems != null && applyItems.size() > 0)
	{
		for each  applyItem in applyItems
		{
			applyParams = Map();
			// 类型
			applyType = applyItem.get("type");
			applyParams.put("Type",applyType);
			// 金额
			amount = applyItem.get("amount");
			if(amount != null)
			{
				applyParams.put("Amount",round(amount,2));
			}
			// 应用日期
			applyParams.put("Apply_Date",applyItem.get("applyDate"));
			// 参考号
			applyParams.put("Ref_Num",applyItem.get("refNum"));
			// 原始金额
			originalAmount = applyItem.get("total");
			if(originalAmount != null)
			{
				applyParams.put("Original_Amount",round(originalAmount,2));
			}
			// 到期金额
			amountDue = applyItem.get("due");
			if(amountDue != null)
			{
				applyParams.put("Amount_Due",round(amountDue,2));
			}
			// 根据类型关联Bill或Credit
			docObj = applyItem.get("doc");
			if(docObj != null)
			{
				docId = docObj.get("id");
				if(applyType == "Bill")
				{
					// 查找VendorBill
					billRecord = zoho.crm.searchRecords("VendorBill","(Netsuite_Id:equals:" + docId + ")");
					if(billRecord != null && billRecord.size() > 0)
					{
						applyParams.put("Bill",{"id":billRecord.get(0).get("id")});
					}
				}
				else if(applyType == "VendorCredit")
				{
					// 查找VendorCredit
					creditRecord = zoho.crm.searchRecords("VendorCredit","(Netsuite_Id:equals:" + docId + ")");
					if(creditRecord != null && creditRecord.size() > 0)
					{
						applyParams.put("Credit",{"id":creditRecord.get(0).get("id")});
					}
				}
			}
			applyList.add(applyParams);
		}
	}
}
// 6. 检查是否存在并执行创建/更新
checkDetail = zoho.crm.searchRecords("VendorCredit","(Netsuite_Id:equals:" + netSuiteId + ")");
if(checkDetail != null && checkDetail.size() > 0)
{
	// 更新
	existingId = checkDetail.get(0).get("id");
	// GET请求获取完整记录（包含子表信息）
	getResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/VendorCredit/" + existingId
		type :GET
		connection:"crm"
	];
	existingCreditDetail = null;
	if(getResp != null && getResp.get("data") != null && getResp.get("data").size() > 0)
	{
		existingCreditDetail = getResp.get("data").get(0);
	}
	// 处理item子表（包含item和expense）
	itemsPayload = List();
	if(existingCreditDetail != null)
	{
		existingItems = existingCreditDetail.get("Vendor_Credit_Items");
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
	}
	if(itemList.size() > 0)
	{
		itemsPayload.addAll(itemList);
	}
	if(itemsPayload.size() > 0)
	{
		params.put("Vendor_Credit_Items",itemsPayload);
	}
	// 处理apply子表
	appliesPayload = List();
	if(existingCreditDetail != null)
	{
		existingApplies = existingCreditDetail.get("Credit_Applications");
		if(existingApplies != null && existingApplies.size() > 0)
		{
			for each  existingApply in existingApplies
			{
				existingApplyId = existingApply.get("id");
				if(existingApplyId != null)
				{
					appliesPayload.add({"id":existingApplyId,"_delete":true});
				}
			}
		}
	}
	if(applyList.size() > 0)
	{
		appliesPayload.addAll(applyList);
	}
	if(appliesPayload.size() > 0)
	{
		params.put("Credit_Applications",appliesPayload);
	}
	resParams = Map();
	resList = List();
	resList.add(params);
	resParams.put("data",resList);
	updateResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/VendorCredit/" + existingId
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
		params.put("Vendor_Credit_Items",itemList);
	}
	if(applyList.size() > 0)
	{
		params.put("Credit_Applications",applyList);
	}
	resParams = Map();
	resList = List();
	resList.add(params);
	resParams.put("data",resList);
	addResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/VendorCredit"
		type :POST
		parameters:resParams.toString()
		connection:"crm"
	];
	result.put("res",addResp);
}
return result;
}
