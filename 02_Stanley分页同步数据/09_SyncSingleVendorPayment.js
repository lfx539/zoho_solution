string standalone.SyncSingleVendorPayment(String paymentId)
{
result = Map();
// 1. 从NetSuite获取VendorPayment数据
paymentUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/vendorpayment/" + paymentId;
auth = standalone.SetHeaders("GET",paymentUrl,true);
headers = {"Content-Type":"application/json","Authorization":auth};
response = invokeurl
[
	url :paymentUrl + "?expandSubResources=true"
	type :GET
	headers:headers
];
if(response == null)
{
	result.put("error","获取VendorPayment详情失败");
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
	paymentDetail = responseList.get(0);
	// 检查是否有错误信息
	if(paymentDetail.containsKey("error"))
	{
		errorMsg = paymentDetail.get("error");
		if(errorMsg != null)
		{
			result.put("error","NetSuite API错误: " + errorMsg);
			return result;
		}
	}
	// 检查是否有 status 字段（可能是错误响应）
	if(paymentDetail.containsKey("status") && paymentDetail.get("status") != "success")
	{
		statusMsg = paymentDetail.get("message");
		if(statusMsg != null)
		{
			result.put("error","NetSuite错误: " + statusMsg);
			return result;
		}
	}
}
catch (parseError)
{
	result.put("error","解析VendorPayment详情失败: " + parseError);
	return result;
}
if(paymentDetail == null)
{
	result.put("error","VendorPayment详情为空");
	return result;
}
netSuiteId = paymentDetail.get("id");
if(netSuiteId == null)
{
	result.put("error","无法获取NetSuite ID");
	return result;
}
// 2. 构建主表字段
params = Map();
params.put("Netsuite_Id",netSuiteId);
params.put("Name","Payment-" + netSuiteId);
params.put("Transaction_Number",paymentDetail.get("transactionNumber"));
// 处理日期
params.put("Payment_Date",paymentDetail.get("tranDate"));
params.put("Date_Received",paymentDetail.get("custbody_anz_date_received"));
// 处理金额
params.put("Balance",paymentDetail.get("balance"));
total = paymentDetail.get("total");
if(total != null)
{
	params.put("Total",round(total,2));
}
// 处理Memo
params.put("Memo",paymentDetail.get("memo"));
// 处理Cleared
cleared = paymentDetail.get("cleared");
if(cleared == true)
{
	params.put("Cleared",true);
}
else
{
	params.put("Cleared",false);
}
params.put("Cleared_Date",paymentDetail.get("clearedDate"));
// 处理ExchangeRate
exchangeRate = paymentDetail.get("exchangeRate");
if(exchangeRate != null)
{
	params.put("ExchangeRate",round(exchangeRate,4));
}
// 处理货币
currencyObj = paymentDetail.get("currency");
if(currencyObj != null)
{
	params.put("Currency_Type",currencyObj.get("refName"));
}
// 处理Account (银行账户)
accountObj = paymentDetail.get("account");
if(accountObj != null)
{
	params.put("Bank",accountObj.get("refName"));
}
// 处理Posting Period
postingPeriodObj = paymentDetail.get("postingPeriod");
if(postingPeriodObj != null)
{
	params.put("Posting_Period",postingPeriodObj.get("refName"));
}
// 处理Payee Address
payeeAddressObj = paymentDetail.get("payeeAddress");
if(payeeAddressObj != null)
{
	params.put("Payee_Address",payeeAddressObj.get("addr1"));
	params.put("Payee_City",payeeAddressObj.get("city"));
	params.put("Payee_State",payeeAddressObj.get("state"));
	params.put("Payee_Zip",payeeAddressObj.get("zip"));
	countryObj = payeeAddressObj.get("country");
	if(countryObj != null)
	{
		params.put("Payee_Country",countryObj.get("refName"));
	}
}
// 处理Vendor
entityObj = paymentDetail.get("entity");
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
// 3. 处理apply子表
applyObj = paymentDetail.get("apply");
itemList = List();
if(applyObj != null)
{
	applyItems = applyObj.get("items");
	if(applyItems != null && applyItems.size() > 0)
	{
		for each  applyItem in applyItems
		{
			itemParams = Map();
			// 金额
			amount = applyItem.get("amount");
			if(amount != null)
			{
				itemParams.put("Amount",round(amount,2));
			}
			originalAmount = applyItem.get("total");
			if(originalAmount != null)
			{
				itemParams.put("Original_Amount",round(originalAmount,2));
			}
			amountDue = applyItem.get("due");
			if(amountDue != null)
			{
				itemParams.put("Amount_Due",round(amountDue,2));
			}
			// 日期
			itemParams.put("Apply_Date",applyItem.get("applyDate"));
			// 参考号
			itemParams.put("Ref_Num",applyItem.get("refNum"));
			// 类型
			applyType = applyItem.get("type");
			itemParams.put("Type",applyType);
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
						itemParams.put("Bill",{"id":billRecord.get(0).get("id")});
					}
				}
				else if(applyType == "VendorCredit")
				{
					// 查找VendorCredit
					creditRecord = zoho.crm.searchRecords("VendorCredit","(Netsuite_Id:equals:" + docId + ")");
					if(creditRecord != null && creditRecord.size() > 0)
					{
						itemParams.put("Credit",{"id":creditRecord.get(0).get("id")});
					}
				}
			}
			itemList.add(itemParams);
		}
	}
}
// 4. 检查是否存在并执行创建/更新
checkDetail = zoho.crm.searchRecords("VendorPayment","(Netsuite_Id:equals:" + netSuiteId + ")");
if(checkDetail != null && checkDetail.size() > 0)
{
	// 更新
	existingId = checkDetail.get(0).get("id");
	// 获取完整记录以获取子表ID
	fullRecord = zoho.crm.getRecordById("VendorPayment",existingId);
	existingItems = fullRecord.get("Payment_Applications");
	itemsPayload = List();
	// 标记删除旧行
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
	// 添加新行
	if(itemList.size() > 0)
	{
		itemsPayload.addAll(itemList);
	}
	if(itemsPayload.size() > 0)
	{
		params.put("Payment_Applications",itemsPayload);
	}
	resParams = Map();
	resList = List();
	resList.add(params);
	resParams.put("data",resList);
	updateResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/VendorPayment/" + existingId
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
		params.put("Payment_Applications",itemList);
	}
	resParams = Map();
	resList = List();
	resList.add(params);
	resParams.put("data",resList);
	addResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/VendorPayment"
		type :POST
		parameters:resParams.toString()
		connection:"crm"
	];
	result.put("res",addResp);
}
return result;
}
