string standalone.SyncSingleVendorBill(String vendorBillId)
{
result = Map();
// 1. 从NetSuite获取Vendor Bill数据
vbUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/vendorbill/" + vendorBillId;
auth = standalone.SetHeaders("GET",vbUrl,true);
headers = {"Content-Type":"application/json","Authorization":auth};
response = invokeurl
[
	url :vbUrl + "?expandSubResources=true"
	type :GET
	headers:headers
];
if(response == null)
{
	result.put("error","获取Vendor Bill详情失败");
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
	vbDetail = responseList.get(0);
	// 检查是否有错误信息
	if(vbDetail.containsKey("error"))
	{
		errorMsg = vbDetail.get("error");
		if(errorMsg != null)
		{
			result.put("error","NetSuite API错误: " + errorMsg);
			return result;
		}
	}
	// 检查是否有 status 字段（可能是错误响应）
	if(vbDetail.containsKey("status") && vbDetail.get("status") != "success")
	{
		statusMsg = vbDetail.get("message");
		if(statusMsg != null)
		{
			result.put("error","NetSuite错误: " + statusMsg);
			return result;
		}
	}
}
catch (parseError)
{
	result.put("error","解析Vendor Bill详情失败: " + parseError);
	return result;
}
if(vbDetail == null)
{
	result.put("error","Vendor Bill详情为空");
	return result;
}
netSuiteId = vbDetail.get("id");
if(netSuiteId == null)
{
	result.put("error","无法获取NetSuite ID");
	return result;
}
netSuiteId = vbDetail.get("id");
// 2. 构建Vendor Bill字段
params = Map();
params.put("Netsuite_Id",netSuiteId);
// Name
params.put("Name",vbDetail.get("tranId"));
// Transaction_Number
params.put("Transaction_Number",vbDetail.get("transactionNumber"));
// Ref_Number
params.put("Ref_Number",vbDetail.get("tranId"));
// Balance
balance = vbDetail.get("balance");
if(balance != null)
{
	params.put("Balance",round(balance,2));
}
// Bill_Total
// billTotal = vbDetail.get("total");
// if(billTotal != null)
// {
// 	params.put("Bill_Total",round(billTotal,2));
// }
// Due_Date
params.put("Due_Date",vbDetail.get("dueDate"));
// Memo
params.put("Memo",vbDetail.get("memo"));
// Date_Received
params.put("Date_Received",vbDetail.get("custbody_anz_date_received"));
// Location
locationObj = vbDetail.get("location");
if(locationObj != null)
{
	params.put("Location",locationObj.get("refName"));
}
// VatRegNum
vatRegNum = vbDetail.get("vatRegNum");
if(vatRegNum != null)
{
	params.put("vatRegNum",vatRegNum);
}
// Received
received = vbDetail.get("received");
if(received == true)
{
	params.put("Received",true);
}
else
{
	params.put("Received",false);
}
// Posting_Period
postingPeriodObj = vbDetail.get("postingPeriod");
if(postingPeriodObj != null)
{
	params.put("Posting_Period",postingPeriodObj.get("refName"));
}
// Approval_Status
approvalStatusObj = vbDetail.get("approvalStatus");
if(approvalStatusObj != null)
{
	params.put("Approval_Status",approvalStatusObj.get("refName"));
}
// Status
statusObj = vbDetail.get("status");
if(statusObj != null)
{
	params.put("Status",statusObj.get("refName"));
}
// Tax
taxTotal = vbDetail.get("taxTotal");
if(taxTotal != null)
{
	params.put("Tax",round(taxTotal,2));
}
// GST_Amt
gstAmt = vbDetail.get("custbody_stc_tax_after_discount");
if(gstAmt != null)
{
	params.put("GST_Amt",round(gstAmt,2));
}
// Vendor (Lookup)
entityObj = vbDetail.get("entity");
if(entityObj != null)
{
	vendorId = entityObj.get("id");
	// 查找CRM中对应的Vendor
	vendorRecord = zoho.crm.searchRecords("Vendors","(Netsuite_Id:equals:" + vendorId + ")");
	if(vendorRecord != null && vendorRecord.size() > 0)
	{
		params.put("Vendor",{"id":vendorRecord.get(0).get("id")});
	}
}
// Owner - 固定为Sean Ren
params.put("Owner","102317000000370001");
// 3. 处理地址信息
billingAddress = vbDetail.get("billingAddress");
if(billingAddress != null)
{
	params.put("Billing_Street",billingAddress.get("addr1"));
	params.put("Billing_City",billingAddress.get("city"));
	params.put("Billing_State",billingAddress.get("state"));
	params.put("Billing_Code",billingAddress.get("zip"));
	countryObj = billingAddress.get("country");
	if(countryObj != null)
	{
		params.put("Billing_Country",countryObj.get("refName"));
	}
}
// 4. 构建子表数据
// 处理 item 子表 (Purchase_Items_Bill)
itemList = List();
itemObj = vbDetail.get("item");
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
// 处理 expense 子表 (Expenses)
expenseList = List();
expenseObj = vbDetail.get("expense");
if(expenseObj != null)
{
	expenses = expenseObj.get("items");
	if(expenses != null && expenses.size() > 0)
	{
		for each  expense in expenses
		{
			expenseParams = Map();
			// Account
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
// 5. 检查Vendor Bill是否存在并执行创建/更新
checkDetail = zoho.crm.searchRecords("VendorBill","(Netsuite_Id:equals:" + netSuiteId + ")");
if(checkDetail != null && checkDetail.size() > 0)
{
	// 更新Vendor Bill：删除旧子表项 + 添加新子表项
	existingId = checkDetail.get(0).get("id");
	// GET请求获取完整记录（包含子表信息）
	getResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/VendorBill/" + existingId
		type :GET
		connection:"crm"
	];
	existingBillDetail = null;
	if(getResp != null && getResp.get("data") != null && getResp.get("data").size() > 0)
	{
		existingBillDetail = getResp.get("data").get(0);
	}
	// 处理 Purchase_Items_Bill 子表
	itemsPayload = List();
	if(existingBillDetail != null)
	{
		existingItems = existingBillDetail.get("Purchase_Items_Bill");
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
		params.put("Purchase_Items_Bill",itemsPayload);
	}
	// 处理 Expenses 子表
	expensesPayload = List();
	if(existingBillDetail != null)
	{
		existingExpenses = existingBillDetail.get("Expenses");
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
		params.put("Expenses",expensesPayload);
	}
	resParams = Map();
	resList = List();
	resList.add(params);
	resParams.put("data",resList);
	updateResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/VendorBill/" + existingId
		type :PUT
		parameters:resParams.toString()
		connection:"crm"
	];
	result.put("res",updateResp);
}
else
{
	// 创建新Vendor Bill
	if(itemList.size() > 0)
	{
		params.put("Purchase_Items_Bill",itemList);
	}
	if(expenseList.size() > 0)
	{
		params.put("Expenses",expenseList);
	}
	resParams = Map();
	resList = List();
	resList.add(params);
	resParams.put("data",resList);
	addResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/VendorBill"
		type :POST
		parameters:resParams.toString()
		connection:"crm"
	];
	result.put("res",addResp);
}
return result;
}