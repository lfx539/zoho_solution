string standalone.SyncSingleCheck(String checkId)
{
result = Map();
// 1. 从NetSuite获取Check数据
checkUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/check/" + checkId;
auth = standalone.SetHeaders("GET",checkUrl,true);
headers = {"Content-Type":"application/json","Authorization":auth};
response = invokeurl
[
	url :checkUrl + "?expandSubResources=true"
	type :GET
	headers:headers
];
if(response == null)
{
	result.put("error","获取Check详情失败");
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
	checkDetail = responseList.get(0);
	// 检查是否有错误信息
	if(checkDetail.containsKey("error"))
	{
		errorMsg = checkDetail.get("error");
		if(errorMsg != null)
		{
			result.put("error","NetSuite API错误: " + errorMsg);
			return result;
		}
	}
	// 检查是否有 status 字段（可能是错误响应）
	if(checkDetail.containsKey("status") && checkDetail.get("status") != "success")
	{
		statusMsg = checkDetail.get("message");
		if(statusMsg != null)
		{
			result.put("error","NetSuite错误: " + statusMsg);
			return result;
		}
	}
}
catch (parseError)
{
	result.put("error","解析Check详情失败: " + parseError);
	return result;
}
if(checkDetail == null)
{
	result.put("error","Check详情为空");
	return result;
}
netSuiteId = checkDetail.get("id");
if(netSuiteId == null)
{
	result.put("error","无法获取NetSuite ID");
	return result;
}
// 2. 构建Check主表字段
params = Map();
params.put("Netsuite_Id",netSuiteId);
// Name (tranId)
params.put("Name",checkDetail.get("tranId"));
// Transaction_Number
params.put("Transaction_Number",checkDetail.get("transactionNumber"));
// Ref_Number
params.put("Ref_Number",checkDetail.get("tranId"));
// Check_Date
params.put("Check_Date",checkDetail.get("tranDate"));
// Date_Received
params.put("Date_Received",checkDetail.get("custbody_anz_date_received"));
// Balance (NS返回负数，原样存储)
balance = checkDetail.get("balance");
if(balance != null)
{
	params.put("Balance",round(balance,2));
}
// Total
total = checkDetail.get("total");
if(total != null)
{
	params.put("Total",round(total,2));
}
// Tax
taxTotal = checkDetail.get("taxTotal");
if(taxTotal != null)
{
	params.put("Tax",round(taxTotal,2));
}
// Bank (银行账户，纯文本)
accountObj = checkDetail.get("account");
if(accountObj != null)
{
	params.put("Bank",accountObj.get("refName"));
}
// Location
locationObj = checkDetail.get("location");
if(locationObj != null)
{
	params.put("Location",locationObj.get("refName"));
}
// Posting_Period
postingPeriodObj = checkDetail.get("postingPeriod");
if(postingPeriodObj != null)
{
	params.put("Posting_Period",postingPeriodObj.get("refName"));
}
// ExchangeRate
exchangeRate = checkDetail.get("exchangeRate");
if(exchangeRate != null)
{
	params.put("ExchangeRate",round(exchangeRate,4));
}
// Currency_Type
currencyObj = checkDetail.get("currency");
if(currencyObj != null)
{
	params.put("Currency_Type",currencyObj.get("refName"));
}
// Cleared
cleared = checkDetail.get("cleared");
if(cleared == true)
{
	params.put("Cleared",true);
}
else
{
	params.put("Cleared",false);
}
// Cleared_Date
params.put("Cleared_Date",checkDetail.get("clearedDate"));
// To_Be_Printed
toBePrinted = checkDetail.get("toBePrinted");
if(toBePrinted == true)
{
	params.put("To_Be_Printed",true);
}
else
{
	params.put("To_Be_Printed",false);
}
// Payee Address (Check的payeeAddress结构不同于VendorPayment，只有addrText和country可靠)
payeeAddressObj = checkDetail.get("payeeAddress");
if(payeeAddressObj != null)
{
	// addrText 是可靠字段
	payeeAddrText = payeeAddressObj.get("addrText");
	if(payeeAddrText != null)
	{
		params.put("Payee_Address",payeeAddrText);
	}
	// country.refName 是可靠字段
	payeeCountryObj = payeeAddressObj.get("country");
	if(payeeCountryObj != null)
	{
		params.put("Payee_Country",payeeCountryObj.get("refName"));
	}
	// 以下字段在Check的payeeAddress中通常不存在，但做安全检查
	payeeCity = payeeAddressObj.get("city");
	if(payeeCity != null)
	{
		params.put("Payee_City",payeeCity);
	}
	payeeState = payeeAddressObj.get("state");
	if(payeeState != null)
	{
		params.put("Payee_State",payeeState);
	}
	payeeZip = payeeAddressObj.get("zip");
	if(payeeZip != null)
	{
		params.put("Payee_Zip",payeeZip);
	}
}
// Subsidiary
subsidiaryObj = checkDetail.get("subsidiary");
if(subsidiaryObj != null)
{
	params.put("Subsidiary",subsidiaryObj.get("refName"));
}
// Vendor (Lookup)
entityObj = checkDetail.get("entity");
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
// Owner - 固定为Sean Ren
params.put("Owner","102317000000370001");
// 3. 处理 item 子表 (Check_Items)
itemList = List();
itemObj = checkDetail.get("item");
if(itemObj != null)
{
	items = itemObj.get("items");
	if(items != null && items.size() > 0)
	{
		for each  item in items
		{
			itemRecord = item.get("item");
			if(itemRecord != null)
			{
				itemId = itemRecord.get("id");
				// 查找CRM中对应的产品
				productRecord = zoho.crm.searchRecords("Products","(Internal_ID:equals:" + itemId + ")");
				if(productRecord != null && productRecord.size() > 0)
				{
					itemParams = Map();
					itemParams.put("Product_Name",{"id":productRecord.get(0).get("id")});
					// Product_Description - 判断长度
					description = item.get("description");
					if(description != null)
					{
						if(description.length() > 255)
						{
							itemParams.put("Product_Description_Long",description);
						}
						else
						{
							itemParams.put("Product_Description",description);
						}
					}
					// Quantity 转为整数
					itemQuantity = item.get("quantity");
					if(itemQuantity != null)
					{
						itemParams.put("Quantity",itemQuantity.toLong());
					}
					itemRate = item.get("rate");
					if(itemRate != null)
					{
						itemParams.put("Rate",round(itemRate,7));
					}
					itemAmount = item.get("amount");
					if(itemAmount != null)
					{
						itemParams.put("Amount",itemAmount);
						itemParams.put("STotal",itemAmount);
						itemParams.put("Total",itemAmount);
					}
					itemTax = item.get("tax1Amt");
					if(itemTax != null)
					{
						itemParams.put("GST",itemTax);
					}
					// GST Code
					taxCodeObj = item.get("taxCode");
					if(taxCodeObj != null)
					{
						itemParams.put("GST_Code",taxCodeObj.get("refName"));
					}
					// Units
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
// 4. 处理 expense 子表 (Check_Expenses)
expenseList = List();
expenseObj = checkDetail.get("expense");
if(expenseObj != null)
{
	expenses = expenseObj.get("items");
	if(expenses != null && expenses.size() > 0)
	{
		for each  expense in expenses
		{
			expenseParams = Map();
			// Account (纯文本，与VendorBill一致)
			accountObj = expense.get("account");
			if(accountObj != null)
			{
				expenseParams.put("Account",accountObj.get("refName"));
			}
			// Memo - 判断长度
			memo = expense.get("memo");
			if(memo != null)
			{
				if(memo.length() > 255)
				{
					expenseParams.put("Memo_Long",memo);
				}
				else
				{
					expenseParams.put("Memo",memo);
				}
			}
			// Amount
			expenseAmount = expense.get("amount");
			if(expenseAmount != null)
			{
				expenseParams.put("Amount",expenseAmount);
			}
			// Gross_Amount (含税金额，Check独有)
			grossAmt = expense.get("grossAmt");
			if(grossAmt != null)
			{
				expenseParams.put("Gross_Amount",grossAmt);
			}
			// GST
			expenseTax = expense.get("tax1Amt");
			if(expenseTax != null)
			{
				expenseParams.put("GST",expenseTax);
			}
			// GST Code
			taxCodeObj = expense.get("taxCode");
			if(taxCodeObj != null)
			{
				expenseParams.put("GST_Code",taxCodeObj.get("refName"));
			}
			// Tax_Rate (税率，为未来Books Expense同步预留)
			taxRate1 = expense.get("taxRate1");
			if(taxRate1 != null)
			{
				expenseParams.put("Tax_Rate",taxRate1);
			}
			// Location
			expenseLocationObj = expense.get("location");
			if(expenseLocationObj != null)
			{
				expenseParams.put("Location",expenseLocationObj.get("refName"));
			}
			// isBillable
			isBillable = expense.get("isBillable");
			if(isBillable == true)
			{
				expenseParams.put("isBillable",true);
			}
			else
			{
				expenseParams.put("isBillable",false);
			}
			expenseList.add(expenseParams);
		}
	}
}
// 5. 检查Check是否存在并执行创建/更新
existingCheck = zoho.crm.searchRecords("Check","(Netsuite_Id:equals:" + netSuiteId + ")");
if(existingCheck != null && existingCheck.size() > 0)
{
	// 更新Check：删除旧子表项 + 添加新子表项
	existingId = existingCheck.get(0).get("id");
	// GET请求获取完整记录（包含子表信息）
	getResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/Check/" + existingId
		type :GET
		connection:"crm"
	];
	existingCheckDetail = null;
	if(getResp != null && getResp.get("data") != null && getResp.get("data").size() > 0)
	{
		existingCheckDetail = getResp.get("data").get(0);
	}
	// 处理 Check_Items 子表
	itemsPayload = List();
	if(existingCheckDetail != null)
	{
		existingItems = existingCheckDetail.get("Check_Items");
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
	if(itemList.size() > 0)
	{
		itemsPayload.addAll(itemList);
	}
	if(itemsPayload.size() > 0)
	{
		params.put("Check_Items",itemsPayload);
	}
	// 处理 Check_Expenses 子表
	expensesPayload = List();
	if(existingCheckDetail != null)
	{
		existingExpenses = existingCheckDetail.get("Check_Expenses");
		if(existingExpenses != null && existingExpenses.size() > 0)
		{
			for each  existingExpense in existingExpenses
			{
				existingExpenseId = existingExpense.get("id");
				if(existingExpenseId != null)
				{
					expensesPayload.add({"id":existingExpenseId,"_delete":true});
				}
			}
		}
	}
	if(expenseList.size() > 0)
	{
		expensesPayload.addAll(expenseList);
	}
	if(expensesPayload.size() > 0)
	{
		params.put("Check_Expenses",expensesPayload);
	}
	resParams = Map();
	resList = List();
	resList.add(params);
	resParams.put("data",resList);
	updateResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/Check/" + existingId
		type :PUT
		parameters:resParams.toString()
		connection:"crm"
	];
	result.put("res",updateResp);
}
else
{
	// 创建新Check
	if(itemList.size() > 0)
	{
		params.put("Check_Items",itemList);
	}
	if(expenseList.size() > 0)
	{
		params.put("Check_Expenses",expenseList);
	}
	resParams = Map();
	resList = List();
	resList.add(params);
	resParams.put("data",resList);
	addResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/Check"
		type :POST
		parameters:resParams.toString()
		connection:"crm"
	];
	result.put("res",addResp);
}
return result;
}
