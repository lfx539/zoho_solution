string standalone.SyncSingleInventory(String productId)
{
result = Map();
// 1. 从NetSuite获取产品数据
prdListUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/inventoryitem/" + productId;
auth = standalone.SetHeaders("GET",prdListUrl,true);
headers = {"Content-Type":"application/json","Authorization":auth};
response = invokeurl
[
	url :prdListUrl + "?expandSubResources=true"
	type :GET
	headers:headers
];
if(response == null)
{
	result.put("error","获取产品详情失败");
	return result;
}
prdDetail = response.getFileContent().toJSONList().get(0);
if(prdDetail == null)
{
	result.put("error","产品详情为空");
	return result;
}
netSuiteId = prdDetail.get("id");
// 2. 构建产品字段
params = Map();
params.put("Internal_ID",netSuiteId);
params.put("Product_Code",prdDetail.get("itemId"));
params.put("Product_Name",prdDetail.get("itemId"));
params.put("Product_Description",prdDetail.get("salesDescription"));
// 处理 Class
classObj = prdDetail.get("class");
if(classObj != null)
{
	params.put("Class",classObj.get("refName"));
}
// 处理尺寸和重量
params.put("Weight",prdDetail.get("custitem_tbs_tem_weight_kg"));
params.put("Width",prdDetail.get("custitem_tbs_item_width_cm"));
params.put("Height",prdDetail.get("custitem_tbs_item_height_cm"));
params.put("Length",prdDetail.get("custitem_tbs_item_length_cm"));
// 处理成本
avgcost = prdDetail.get("averageCost");
if(avgcost != null)
{
	params.put("Average_Cost",round(avgcost,2));
}
else
{
	params.put("Average_Cost","");
}
// 处理价格列表
priceObj = prdDetail.get("price");
if(priceObj != null)
{
	priceList = priceObj.get("items");
	if(priceList != null && priceList.size() > 0)
	{
		for each  priceItem in priceList
		{
			priceLevelName = priceItem.get("priceLevelName");
			quantity = priceItem.get("quantity");
			if(quantity != null && quantity.get("value") == "0")
			{
				if(priceLevelName == "Default Price")
				{
					params.put("Default_Price",round(priceItem.get("price"),2));
				}
				if(priceLevelName == "Alternate Price 1")
				{
					params.put("Alternate_Price",round(priceItem.get("price"),2));
				}
			}
		}
	}
}
// 处理货币类型
currencyObj = prdDetail.get("currency");
if(currencyObj != null)
{
	params.put("Currency_Type",currencyObj.get("refName"));
}
// 处理销售单位
prdSaleUnit = prdDetail.get("saleUnit");
if(prdSaleUnit != null)
{
	params.put("Sales_Unit",standalone.ConvertSaleUnit(prdSaleUnit));
}
// 3. 检查产品是否存在并执行创建/更新
checkDetail = zoho.crm.searchRecords("Products","(Internal_ID:equals:" + netSuiteId + ")");
if(checkDetail != null && checkDetail.size() > 0)
{
	// 更新产品
	existingId = checkDetail.get(0).get("id");
	resParams = Map();
	resList = List();
	resList.add(params);
	resParams.put("data",resList);
	updateResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/Products/" + existingId
		type :PUT
		parameters:resParams.toString()
		connection:"crm"
	];
	result.put("res",updateResp);
}
else
{
	// 创建新产品
	resParams = Map();
	resList = List();
	resList.add(params);
	resParams.put("data",resList);
	addResp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/Products"
		type :POST
		parameters:resParams.toString()
		connection:"crm"
	];
	// 		info addResp;
	result.put("res",addResp);
}
return result;
}