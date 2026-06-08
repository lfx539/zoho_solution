/*
 * Workflow 自动同步 - 将 Lead 子表产品同步到 Case 子表
 * 触发方式：Workflow - Lead 编辑时触发
 * 说明：只更新已存在的 Case，不创建新 Case（由 widget 按钮创建）
 * 注意：只有数据有变化时才执行更新，避免循环触发
 */

void automation.LeadSyncCase(String leadId)
{
	info "Lead ID: " + leadId;

	// ==================== 获取 Lead 记录 ====================
	leadRecord = zoho.crm.getRecordById("Leads", leadId);
	info "Lead Record: " + leadRecord;

	if(leadRecord == null)
	{
		info "获取 Lead 记录失败";
		return;
	}

	leadName = ifnull(leadRecord.get("Name"), "");
	accountName = leadRecord.get("Account_Name");
	leadOwner = leadRecord.get("Owner");
	info "Lead Owner: " + leadOwner;

	// ==================== 获取 Lead 完整数据（包含子表） ====================
	getResp = invokeurl
	[
		url: "https://www.zohoapis.com/crm/v8/Leads/" + leadId
		type: GET
		connection: "crm"
	];

	info "Lead Full Data: " + getResp;

	// 解析子表数据
	productInterestedLead = List();
	if(getResp != null && getResp.get("data") != null && getResp.get("data").size() > 0)
	{
		leadData = getResp.get("data").get(0);
		productInterestedRaw = leadData.get("Product_Interested_lead");

		if(productInterestedRaw != null)
		{
			productInterestedLead = productInterestedRaw;
		}
	}

	info "Product Interested Lead size: " + productInterestedLead.size();

	// ==================== 构建 Lead 的数据列表（用于对比） ====================
	leadProductDataList = List();
	for each item in productInterestedLead
	{
		productInfo = item.get("Product_Name");
		productId = "";
		if(productInfo != null)
		{
			productId = productInfo.get("id");
		}
		comments = ifnull(item.get("Comments"), "");

		if(productId != null && productId != "")
		{
			// 组合格式: "productId|comments"
			leadProductDataList.add(productId + "|" + comments);
		}
	}

	// ==================== 构建新的子表数据列表 ====================
	productInterestedCaseList = List();
	for each item in productInterestedLead
	{
		productInfo = item.get("Product_Name");
		productId = "";
		if(productInfo != null)
		{
			productId = productInfo.get("id");
		}

		description = ifnull(item.get("Comments"), "");

		caseItem = Map();
		if(productId != null && productId != "")
		{
			caseItem.put("Product_Name", {"id": productId});
		}
		if(description != "")
		{
			caseItem.put("Comments", description);
		}

		productInterestedCaseList.add(caseItem);
	}

	// ==================== 检查是否有关联的 Case ====================
	if(productInterestedCaseList.size() == 0)
	{
		info "该 Lead 没有产品信息，无法同步";
		return;
	}

	existingCases = zoho.crm.searchRecords("Cases", "Lead:equals:" + leadId, 1, 200);
	info "Search existing cases: " + existingCases;

	// ==================== 遍历更新所有关联的 Case ====================
	if(existingCases != null && existingCases.size() > 0)
	{
		info "找到 " + existingCases.size() + " 个关联的 Case";

		for each existingCase in existingCases
		{
			existingCaseId = existingCase.get("id");
			info "处理 Case ID: " + existingCaseId;

			// 获取 Case 现有子表数据
			getCaseResp = invokeurl
			[
				url: "https://www.zohoapis.com/crm/v8/Cases/" + existingCaseId
				type: GET
				connection: "crm"
			];

			existingProductList = List();
			if(getCaseResp != null && getCaseResp.get("data") != null && getCaseResp.get("data").size() > 0)
			{
				caseData = getCaseResp.get("data").get(0);
				existingProductRaw = caseData.get("Product_Interest_Case");

				if(existingProductRaw != null)
				{
					existingProductList = existingProductRaw;
				}
			}

			// 提取 Case 的数据列表（用于对比）
			caseProductDataList = List();
			for each caseItem in existingProductList
			{
				caseProductInfo = caseItem.get("Product_Name");
				caseProductId = "";
				if(caseProductInfo != null)
				{
					try
					{
						if(caseProductInfo.containsKey("id"))
						{
							caseProductId = caseProductInfo.get("id");
						}
						else
						{
							caseProductId = caseProductInfo.toString();
						}
					}
					catch (e)
					{
						caseProductId = caseProductInfo.toString();
					}
				}
				caseComments = ifnull(caseItem.get("Comments"), "");

				if(caseProductId != null && caseProductId != "")
				{
					caseProductDataList.add(caseProductId + "|" + caseComments);
				}
			}

			// 对比两个列表是否相同
			hasChange = false;
			if(leadProductDataList.size() != caseProductDataList.size())
			{
				hasChange = true;
			}
			else
			{
				// 数量相同，检查每个组合是否都存在
				for each leadDataItem in leadProductDataList
				{
					if(!caseProductDataList.contains(leadDataItem))
					{
						hasChange = true;
						break;
					}
				}
			}

			if(hasChange)
			{
				info "Case 子表数据有变化，执行更新: " + existingCaseId;

				// 构建删除旧数据 + 添加新数据的 payload
				productPayload = List();
				for each oldItem in existingProductList
				{
					oldItemId = oldItem.get("id");
					if(oldItemId != null)
					{
						oldItemIdStr = oldItemId.toString();
						deleteItem = Map();
						deleteItem.put("id", oldItemIdStr);
						deleteItem.put("_delete", true);
						productPayload.add(deleteItem);
					}
				}
				productPayload.addAll(productInterestedCaseList);

				caseParams = Map();
				caseParams.put("Product_Interest_Case", productPayload);

				dataList = List();
				dataList.add(caseParams);
				requestParams = Map();
				requestParams.put("data", dataList);

				info "Update Case Request: " + requestParams;

				updateResp = invokeurl
				[
					url: "https://www.zohoapis.com/crm/v8/Cases/" + existingCaseId
					type: PUT
					parameters: requestParams.toString()
					connection: "crm"
				];

				info "Update Case Response: " + updateResp;
				info "已更新 Case，同步 " + productInterestedCaseList.size() + " 个产品。Case ID: " + existingCaseId;
			}
			else
			{
				info "Case 子表数据无变化，跳过更新: " + existingCaseId;
			}
		}

		info "所有 Case 更新完成，共更新 " + existingCases.size() + " 个 Case";
	}
	else
	{
		// ==================== 不创建新 Case ====================
		// 创建 Case 由 widget 按钮处理，这里只负责更新已存在的 Case
		info "没有找到关联的 Case，不创建新 Case（由 widget 按钮创建）";
	}
}
