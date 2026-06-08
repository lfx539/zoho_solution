string button.CaseLinktoDeal()
{
	// 函数：获取 Case 关联 Deal 下的所有 Product Purchased
	// 1. 获取 Case 关联的 Deal ID
	caseId = "5809562000077833147";
	caseRecord = zoho.crm.getRecordById("Case_Module",caseId);
	dealInfo = caseRecord.get("Deal");
	// 你的查找字段 API 名称
	dealId = "";
	if(dealInfo != null && dealInfo.contains("id"))
	{
		dealId = dealInfo.get("id");
	}
	info "Deal ID: " + dealId;
	// 2. 通过 Deal ID 查询关联的 Products Purchased
	if(dealId != null && dealId != "")
	{
		// 方法1：通过 CRM 搜索
		products = zoho.crm.searchRecords("Products_Purchased","(Deal:equals:" + dealId + ")");
		info products;
		// 3. 构建 Product_Info 子表数据
		productInfoList = List();
		for each  product in products
		{
			productInfoMap = Map();
			// Product_Purchased 查找字段关联 Products_Purchased 的 id
			productInfoMap.put("Product_Purchased",product.get("id"));
			// 可选：添加其他字段
			productInfoMap.put("Product_Name",{"id":product.get("Product_Name").get("id")});
			productInfoMap.put("Serial_Number",product.get("Serial_Number"));
			productInfoMap.put("Warranty_Start_Date",product.get("Warranty_Start_Date"));
			productInfoMap.put("Warranty_End_Date",product.get("Warranty_End_Date"));
			productInfoMap.put("Shipping_Date",product.get("Shipping_Date"));
			productInfoList.add(productInfoMap);
		}
		// 4. 更新 Case 记录：删除旧子表项 + 添加新子表项
		// GET请求获取完整记录（包含子表信息）
		getResp = invokeurl
		[
			url :"https://www.zohoapis.com/crm/v8/Case_Module/" + caseId
			type :GET
			connection:"crm"
		];
		existingCaseDetail = null;
		if(getResp != null && getResp.get("data") != null && getResp.get("data").size() > 0)
		{
			existingCaseDetail = getResp.get("data").get(0);
		}
		// 构建子表 payload：先删除旧项，再添加新项
		productInfoPayload = List();
		// 标记删除旧行
		if(existingCaseDetail != null)
		{
			existingProductInfo = existingCaseDetail.get("Product_Info");
			if(existingProductInfo != null && existingProductInfo.size() > 0)
			{
				for each lineItem in existingProductInfo
				{
					lineItemId = lineItem.get("id");
					if(lineItemId != null)
					{
						productInfoPayload.add({"id":lineItemId,"_delete":true});
					}
				}
			}
		}
		// 添加新行
		if(productInfoList.size() > 0)
		{
			productInfoPayload.addAll(productInfoList);
		}
		// 构建请求参数
		if(productInfoPayload.size() > 0)
		{
			recordData = Map();
			recordData.put("Product_Info",productInfoPayload);
			dataList = List();
			dataList.add(recordData);
			updateMap = Map();
			updateMap.put("data",dataList);
			updateResp = invokeurl
			[
				url :"https://www.zohoapis.com/crm/v8/Case_Module/" + caseId
				type :PUT
				parameters:updateMap.toString()
				connection:"crm"
			];
			info updateResp;
		}
	}
	return "";
}
