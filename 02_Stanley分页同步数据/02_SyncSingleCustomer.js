string standalone.SyncSingleCustomer(String customerId)
{
result = Map();
// 1. 从NetSuite获取客户数据
customerUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/customer/" + customerId;
auth = standalone.SetHeaders("GET",customerUrl,true);
headers = {"Content-Type":"application/json","Authorization":auth};
response = invokeurl
[
	url :customerUrl + "?expandSubResources=true"
	type :GET
	headers:headers
];
if(response == null)
{
	result.put("error","获取客户详情失败");
	return result;
}
customerDetail = response.getFileContent().toJSONList().get(0);
if(customerDetail == null)
{
	result.put("error","客户详情为空");
	return result;
}
netSuiteId = customerDetail.get("id");
// 2. 构建客户字段
customerParams = Map();
customerParams.put("Netsuite_ID",netSuiteId);
customerParams.put("Account_Name",customerDetail.get("entityId"));
customerParams.put("Company_Name",customerDetail.get("companyName"));
customerParams.put("Email",customerDetail.get("email"));
customerParams.put("Phone",customerDetail.get("phone"));
// 处理 Status
entityStatusObj = customerDetail.get("entityStatus");
if(entityStatusObj != null)
{
	customerParams.put("Status",entityStatusObj.get("refName"));
}
// 处理 Type (isPerson)
personType = "";
isPerson = customerDetail.get("isPerson");
if(isPerson == true)
{
	personType = "Individual";
}
else if(isPerson == false)
{
	personType = "Company";
}
else
{
	personType = "";
}
customerParams.put("Type",personType);
acOwner = customerDetail.get("salesRep");
if(acOwner != null)
{
	acOwnerName = acOwner.get("refName");
	acOwnerID = standalone.mapSalesRep(acOwnerName);
	info acOwnerName;
	customerParams.put("Owner",acOwnerID);
}
// ========== 新增字段 ==========
// 2nd email
customerParams.put("Alt_Email", customerDetail.get("altEmail"));
// price level
priceLevelObj = customerDetail.get("priceLevel");
if(priceLevelObj != null)
{
	customerParams.put("Price_Level", priceLevelObj.get("refName"));
}
// payment term
termsObj = customerDetail.get("terms");
if(termsObj != null)
{
	customerParams.put("Payment_Terms", termsObj.get("refName"));
}
// comments
customerParams.put("Comments", customerDetail.get("comments"));
// abn
customerParams.put("ABN", customerDetail.get("custentity_anz_suitetax_abn"));
// credit limit
customerParams.put("Credit_Limit", customerDetail.get("creditLimit"));
// available credit
customerParams.put("Available_Credit", customerDetail.get("custentity_atlas_avail_credit"));
// start date
customerParams.put("Start_Date", customerDetail.get("startDate"));
// balance
customerParams.put("Balance", customerDetail.get("balance"));
// overdue balance
customerParams.put("Overdue_Balance", customerDetail.get("overdueBalance"));
// days overdue
customerParams.put("Days_Overdue", customerDetail.get("daysOverdue"));
// unbilled orders
customerParams.put("Unbilled_Order", customerDetail.get("unbilledOrders"));
// deposit balance
customerParams.put("Deposit_Balance", customerDetail.get("depositBalance"));
// 3. 同步客户到 Accounts
customerParameters = Map();
customerList = List();
customerList.add(customerParams);
customerParameters.put("data",customerList);
addAccountsResp = invokeurl
[
	url :"https://www.zohoapis.com.au/crm/v8/Accounts/upsert"
	type :POST
	parameters:customerParameters.toString()
	connection:"crm"
];
info addAccountsResp;
// 检查同步结果
if(addAccountsResp == null)
{
	result.put("error","同步客户到Accounts失败");
	return result;
}
result.put("res",addAccountsResp);
// 4. 获取Account的CRM ID（用于关联地址）
accountCrmid = null;
if(addAccountsResp.get("data") != null && addAccountsResp.get("data").size() > 0)
{
	firstDataItem = addAccountsResp.get("data").get(0);
	if(firstDataItem != null && firstDataItem.get("details") != null)
	{
		accountCrmid = firstDataItem.get("details").get("id");
	}
}
// 如果upsert没有返回ID，尝试通过Netsuite_ID查询
if(accountCrmid == null)
{
	checkAccountDetail = zoho.crm.searchRecords("Accounts","(Netsuite_ID:equals:" + netSuiteId + ")");
	if(checkAccountDetail != null && checkAccountDetail.size() > 0)
	{
		accountCrmid = checkAccountDetail.get(0).get("id");
	}
}
// 5. 处理地址簿（addressBook）
addressBookObj = customerDetail.get("addressBook");
if(addressBookObj != null && accountCrmid != null)
{
	addressItems = addressBookObj.get("items");
	if(addressItems != null && addressItems.size() > 0)
	{
		// 用于收集 defaultShipping 和 defaultBilling 的地址信息
		shippingAddr = Map();
		billingAddr = Map();
		for each  addressItem in addressItems
		{
			try
			{
				addressParams = Map();
				addressList = List();
				adParams = Map();
				netsuiteAddressId = addressItem.get("addressId");
				adParams.put("Name",netsuiteAddressId);
				adParams.put("Accounts",{"id":accountCrmid});
				adParams.put("Address_Label",addressItem.get("label"));
				adParams.put("Default_Billing",addressItem.get("defaultBilling"));
				adParams.put("Default_Shipping",addressItem.get("defaultShipping"));
				// 处理地址详细信息
				addressBookAddress = addressItem.get("addressBookAddress");
				if(addressBookAddress != null)
				{
					// 处理 Country
					countryObj = addressBookAddress.get("country");
					countryName = "";
					if(countryObj != null)
					{
						countryName = countryObj.get("refName");
						adParams.put("Country",countryName);
					}
					adParams.put("State",addressBookAddress.get("state"));
					adParams.put("City",addressBookAddress.get("city"));
					adParams.put("Zip",addressBookAddress.get("zip"));
					adParams.put("Address_Info",addressBookAddress.get("addrText"));
					adParams.put("Addressee",addressBookAddress.get("addressee"));
					adParams.put("Addr1",addressBookAddress.get("addr1"));
					adParams.put("Addr2",addressBookAddress.get("addr2"));
					adParams.put("AddrPhone",addressBookAddress.get("addrPhone"));
					// 收集 defaultShipping 地址信息
					isDefaultShipping = addressItem.get("defaultShipping");
					if(isDefaultShipping == true || isDefaultShipping == "true")
					{
						shippingAddr.put("Shipping_Street",addressBookAddress.get("addr1"));
						shippingAddr.put("Shipping_City",addressBookAddress.get("city"));
						shippingAddr.put("Shipping_State",addressBookAddress.get("state"));
						shippingAddr.put("Shipping_Code",addressBookAddress.get("zip"));
						if(countryName != "")
						{
							shippingAddr.put("Shipping_Country",countryName);
						}
					}
					// 收集 defaultBilling 地址信息
					isDefaultBilling = addressItem.get("defaultBilling");
					if(isDefaultBilling == true || isDefaultBilling == "true")
					{
						billingAddr.put("Billing_Street",addressBookAddress.get("addr1"));
						billingAddr.put("Billing_City",addressBookAddress.get("city"));
						billingAddr.put("Billing_State",addressBookAddress.get("state"));
						billingAddr.put("Billing_Code",addressBookAddress.get("zip"));
						if(countryName != "")
						{
							billingAddr.put("Billing_Country",countryName);
						}
					}
				}
				addressList.add(adParams);
				addressParams.put("data",addressList);
				// 检查地址是否存在
				checkAddressDetail = zoho.crm.searchRecords("CustomerAddress","(Name:equals:" + netsuiteAddressId + ")");
				if(checkAddressDetail != null && checkAddressDetail.size() > 0)
				{
					// 更新地址
					existingAddressId = checkAddressDetail.get(0).get("id");
					updateAddressResp = invokeurl
					[
						url :"https://www.zohoapis.com.au/crm/v8/CustomerAddress/" + existingAddressId
						type :PUT
						parameters:addressParams.toString()
						connection:"crm"
					];
				}
				else
				{
					// 创建新地址
					addAddressResp = invokeurl
					[
						url :"https://www.zohoapis.com.au/crm/v8/CustomerAddress"
						type :POST
						parameters:addressParams.toString()
						connection:"crm"
					];
				}
			}
			catch (e)
			{
				// 地址处理失败不影响客户同步结果，只记录日志
				info "处理客户 " + customerId + " 的地址时出错: " + e;
			}
		}
		// 6. 更新 Accounts 的 shipping/billing 地址
		accountUpdateData = Map();
		if(shippingAddr.size() > 0)
		{
			for each  key in shippingAddr.keys()
			{
				accountUpdateData.put(key,shippingAddr.get(key));
			}
		}
		if(billingAddr.size() > 0)
		{
			for each  key in billingAddr.keys()
			{
				accountUpdateData.put(key,billingAddr.get(key));
			}
		}
		if(accountUpdateData.size() > 0)
		{
			updateAccountResp = zoho.crm.updateRecord("Accounts",accountCrmid,accountUpdateData);
			info "更新 Account 地址: " + updateAccountResp;
		}
	}
}
return result;
}
