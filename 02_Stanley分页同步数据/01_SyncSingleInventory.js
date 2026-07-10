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
// 固定Owner为Sean Ren
params.put("Owner","102317000000370001");
// 处理 Product_Active (isInactive需要反转)
isInactive = prdDetail.get("isInactive");
if(isInactive == true)
{
	params.put("Product_Active",false);
}
else if(isInactive == false)
{
	params.put("Product_Active",true);
}
else
{
	params.put("Product_Active",true);
}
// 直接同步 IsInactive 字段
params.put("IsInactive",prdDetail.get("isInactive"));
// 处理 Class
classObj = prdDetail.get("class");
if(classObj != null)
{
	params.put("Class",classObj.get("refName"));
}
// 处理 Subitem_Of (parent) - 直接存refName
parentObj = prdDetail.get("parent");
if(parentObj != null)
{
	params.put("Subitem_Of",parentObj.get("refName"));
}
// 处理尺寸和重量
params.put("Length",prdDetail.get("custitem_tbs_item_length_cm"));
params.put("Width",prdDetail.get("custitem_tbs_item_width_cm"));
params.put("Height",prdDetail.get("custitem_tbs_item_height_cm"));
params.put("Weight",prdDetail.get("custitem_tbs_tem_weight_kg"));
// 处理销售单位
prdSaleUnit = prdDetail.get("saleUnit");
if(prdSaleUnit != null)
{
	params.put("Sales_Unit",standalone.ConvertSaleUnit(prdSaleUnit));
}
// 处理库存单位 (stockUnit)
stockUnitObj = prdDetail.get("stockUnit");
if(stockUnitObj != null)
{
	params.put("Stock_Unit",standalone.ConvertSaleUnit(stockUnitObj));
}
// 处理采购单位 (purchaseUnit)
purchaseUnitObj = prdDetail.get("purchaseUnit");
if(purchaseUnitObj != null)
{
	params.put("Purchase_Unit",standalone.ConvertSaleUnit(purchaseUnitObj));
}
// 处理采购相关字段
params.put("Purchase_Description",prdDetail.get("purchaseDescription"));
purchasePrice = prdDetail.get("cost");
if(purchasePrice != null)
{
	params.put("Purchase_Price",round(purchasePrice,2));
}
lastPurchasePrice = prdDetail.get("lastPurchasePrice");
if(lastPurchasePrice != null)
{
	params.put("Last_Purchase_Price",round(lastPurchasePrice,2));
}
// 处理库存相关字段
params.put("Total_Quantity_On_Hand",prdDetail.get("totalquantityonhand"));
totalValue = prdDetail.get("totalValue");
if(totalValue != null)
{
	params.put("Total_Value",round(totalValue,2));
}
avgcost = prdDetail.get("averageCost");
if(avgcost != null)
{
	params.put("Average_Cost",round(avgcost,2));
}
params.put("Reorder_Multiple",prdDetail.get("reorderMultiple"));
params.put("Preferred_Stock_Level",prdDetail.get("preferredStockLevelDays"));
params.put("Purchase_Lead_Time",prdDetail.get("leadTime"));
params.put("Track_Landed_Cost",prdDetail.get("trackLandedCost"));
// 处理 Stocking_Indicator
stockingIndicatorObj = prdDetail.get("custitem_netstock_item_stock_indicator");
if(stockingIndicatorObj != null)
{
	if(stockingIndicatorObj.toString().contains("refName"))
	{
		params.put("Stocking_Indicator",stockingIndicatorObj.get("refName"));
	}
	else
	{
		params.put("Stocking_Indicator",stockingIndicatorObj.toString());
	}
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
// 处理 Vendors (itemVendor)
vendorList = List();
itemVendorObj = prdDetail.get("itemVendor");
if(itemVendorObj != null)
{
	itemVendorItems = itemVendorObj.get("items");
	if(itemVendorItems != null && itemVendorItems.size() > 0)
	{
		for each  vendorItem in itemVendorItems
		{
			vendorObj = vendorItem.get("vendor");
			if(vendorObj != null)
			{
				vendorId = vendorObj.get("id");
				// 查找CRM中对应的Vendor
				vendorRecord = zoho.crm.searchRecords("Vendors","(Netsuite_Id:equals:" + vendorId + ")");
				if(vendorRecord != null && vendorRecord.size() > 0)
				{
					vendorCrmId = vendorRecord.get(0).get("id");
					vendorParams = Map();
					vendorParams.put("Vendor_Name",{"id":vendorCrmId});
					// 处理preferredVendor，确保是布尔值
					preferredVal = vendorItem.get("preferredVendor");
					if(preferredVal == true || preferredVal == "true")
					{
						vendorParams.put("Preferred",true);
					}
					else
					{
						vendorParams.put("Preferred",false);
					}
					// 获取采购价格
					vendorPrice = vendorItem.get("purchasePrice");
					if(vendorPrice != null)
					{
						vendorParams.put("Purchase_Price",round(vendorPrice,2));
					}
					vendorList.add(vendorParams);
				}
			}
		}
	}
}
// 3. 检查产品是否存在并执行创建/更新
checkDetail = zoho.crm.searchRecords("Products","(Internal_ID:equals:" + netSuiteId + ")");
if(checkDetail != null && checkDetail.size() > 0)
{
	// 更新产品：删除旧子表项 + 添加新子表项
	existingId = checkDetail.get(0).get("id");
	// 用getRecordById获取完整数据（包含子表）
	fullRecord = zoho.crm.getRecordById("Products",existingId);
	existingSuppliers = fullRecord.get("Suppliers");
	suppliersPayload = List();
	// 标记删除旧行
	if(existingSuppliers != null && existingSuppliers.size() > 0)
	{
		for each  supplierItem in existingSuppliers
		{
			supplierItemId = supplierItem.get("id");
			if(supplierItemId != null)
			{
				suppliersPayload.add({"id":supplierItemId,"_delete":true});
			}
		}
	}
	// 添加新行（如果有）
	if(vendorList.size() > 0)
	{
		suppliersPayload.addAll(vendorList);
	}
	if(suppliersPayload.size() > 0)
	{
		params.put("Suppliers",suppliersPayload);
	}
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
	if(vendorList.size() > 0)
	{
		params.put("Suppliers",vendorList);
	}
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
	result.put("res",addResp);
}
return result;
}