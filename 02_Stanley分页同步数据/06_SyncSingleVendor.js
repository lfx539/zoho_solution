string standalone.SyncSingleVendor(String vendorId)
{
result = Map();
// 1. 从NetSuite获取vendor数据
vendorUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/vendor/" + vendorId;
auth = standalone.SetHeaders("GET",vendorUrl,true);
headers = {"Content-Type":"application/json","Authorization":auth};
response = invokeurl
[
	url :vendorUrl + "?expandSubResources=true"
	type :GET
	headers:headers
];
if(response == null)
{
	result.put("error","获取vendor详情失败");
	return result;
}
vendorDetail = response.getFileContent().toJSONList().get(0);
if(vendorDetail == null)
{
	result.put("error","vendor详情为空");
	return result;
}
netSuiteId = vendorDetail.get("id");
// 2. 构建vendor字段
vendorParams = Map();
vendorParams.put("Netsuite_Id",netSuiteId);
vendorParams.put("Vendor_Name",vendorDetail.get("entityId"));
vendorParams.put("Company_Name",vendorDetail.get("companyName"));
vendorParams.put("Email",vendorDetail.get("email"));
vendorParams.put("Comments",vendorDetail.get("comments"));
vendorParams.put("Alt_Email",vendorDetail.get("custentity_tbs_alt_email"));
// 处理 defaultAddress，清理<br>标签
defaultAddress = vendorDetail.get("defaultAddress");
if(defaultAddress != null && defaultAddress != "")
{
	cleanAddress = defaultAddress.replaceAll("<br>","\n").replaceAll("<br/>","\n").replaceAll("<br />","\n");
	vendorParams.put("Address",cleanAddress);
}
// 处理 isActive (NetSuite的isInactive需要反转)
isInactive = vendorDetail.get("isInactive");
if(isInactive == true)
{
	vendorParams.put("isActive",false);
}
else if(isInactive == false)
{
	vendorParams.put("isActive",true);
}
else
{
	vendorParams.put("isActive",true);
}
// 处理 Type (isPerson)
vendorType = "";
isPerson = vendorDetail.get("isPerson");
if(isPerson == true)
{
	vendorType = "Individual";
}
else if(isPerson == false)
{
	vendorType = "Company";
}
else
{
	vendorType = "";
}
vendorParams.put("Type",vendorType);
// 处理 category (可能是对象)
categoryObj = vendorDetail.get("category");
if(categoryObj != null)
{
	vendorParams.put("Category",categoryObj.get("refName"));
}
// 处理 terms (可能是对象)
termsObj = vendorDetail.get("terms");
if(termsObj != null)
{
	vendorParams.put("Term",termsObj.get("refName"));
}
// 处理其他字段
vendorParams.put("Account",vendorDetail.get("accountNumber"));
vendorParams.put("Credit_Limit",vendorDetail.get("creditLimit"));
vendorParams.put("ABN",vendorDetail.get("custentity_tax_reg_no"));
vendorParams.put("Balance",vendorDetail.get("balance"));
vendorParams.put("Unbilled_Orders",vendorDetail.get("unbilledOrders"));
// 固定Owner为Sean Ren
vendorParams.put("Owner","102317000000370001");
// 3. 从addressBook获取详细地址信息
addressBookObj = vendorDetail.get("addressBook");
if(addressBookObj != null)
{
	addressItems = addressBookObj.get("items");
	if(addressItems != null && addressItems.size() > 0)
	{
		for each  addressItem in addressItems
		{
			isDefaultShipping = addressItem.get("defaultShipping");
			isDefaultBilling = addressItem.get("defaultBilling");
			if(isDefaultShipping == true || isDefaultBilling == true)
			{
				addressBookAddress = addressItem.get("addressBookAddress");
				if(addressBookAddress != null)
				{
					countryObj2 = addressBookAddress.get("country");
					if(countryObj2 != null)
					{
						vendorParams.put("Country",countryObj2.get("refName"));
					}
					vendorParams.put("State",addressBookAddress.get("state"));
					vendorParams.put("City",addressBookAddress.get("city"));
					vendorParams.put("Zip_Code",addressBookAddress.get("zip"));
						vendorParams.put("DefaultBilling",isDefaultBilling);
						vendorParams.put("DefaultShipping",isDefaultShipping);
				}
				break;
			}
		}
	}
}
// 4. 同步vendor到 Vendors
vendorParameters = Map();
vendorList = List();
vendorList.add(vendorParams);
vendorParameters.put("data",vendorList);
addVendorResp = invokeurl
[
	url :"https://www.zohoapis.com.au/crm/v8/Vendors/upsert"
	type :POST
	parameters:vendorParameters.toString()
	connection:"crm"
];
info addVendorResp;
if(addVendorResp == null)
{
	result.put("error","同步vendor到Vendors失败");
	return result;
}
result.put("res",addVendorResp);
return result;
}
