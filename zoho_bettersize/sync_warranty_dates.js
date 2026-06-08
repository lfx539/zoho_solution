/**
 * 同步 Case 子表数据
 *
 * 触发时机：Cases 编辑时（Workflow 触发）
 * 触发条件：Every time the record is edited
 *
 * 功能：
 * 1. 如果 Case 有 Product_Purchased_Case 子表数据：
 *    - 更新 Products_Purchased 模块的 Serial_Number, Warranty_Start_Date, Warranty_End_Date
 *    - 更新关联 Deal 的 Product_Purchased_deal 子表
 *    - 更新同一个 Deal 关联的其他 Cases 的 Product_Purchased_Case 子表
 *
 * 2. 如果 Case 有 Product_Interest_Case 子表数据：
 *    - 判断 Case 关联的是 Lead 还是 Deal
 *    - 如果关联 Lead：更新 Lead 的 Product_Interested_lead 子表，以及其他 Case 的 Product_Interest_Case 子表
 *    - 如果关联 Deal：更新 Deal 的 Product_Interested_deal 子表，以及其他 Case 的 Product_Interest_Case 子表
 *
 * 注意：只有数据有变化时才执行更新，避免循环触发
 */

void automation.syncCaseSubform(String caseId)
{
    info "========== 开始同步 Case 子表数据 ==========";
    info "Case ID: " + caseId;

    // 获取 Case 记录详情
    caseDetails = zoho.crm.getRecordById("Cases", caseId);
    info "Case Details: " + caseDetails;

    // 获取关联的 Lead 和 Deal
    leadId = "";
    dealId = "";

    leadField = caseDetails.get("Lead");
    if(leadField != null && leadField.containsKey("id"))
    {
        leadId = leadField.get("id");
    }

    dealField = caseDetails.get("Deal");
    if(dealField != null && dealField.containsKey("id"))
    {
        dealId = dealField.get("id");
    }

    info "Lead ID: " + leadId + ", Deal ID: " + dealId;

    // ========== 检查 Product_Purchased_Case 子表 ==========
    productPurchasedList = caseDetails.get("Product_Purchased_Case");
    info "Product_Purchased_Case: " + productPurchasedList;

    if(productPurchasedList != null && productPurchasedList.size() > 0)
    {
        info "处理 Product_Purchased_Case 子表";

        // 遍历子表记录
        for each productItem in productPurchasedList
        {
            // 获取 Product_Name
            productNameId = productItem.get("Product_Name");
            if(productNameId == null)
            {
                continue;
            }

            productId = "";
            productName = "";
            try
            {
                if(productNameId.containsKey("id"))
                {
                    productId = productNameId.get("id");
                    productName = ifnull(productNameId.get("name"), "");
                }
                else
                {
                    productId = productNameId.toString();
                }
            }
            catch (e)
            {
                productId = productNameId.toString();
            }

            info "Product_ID: " + productId;

            // 获取需要同步的字段值
            serialNumber = productItem.get("Serial_Number");
            warrantyStartDate = productItem.get("Warranty_Start_Date");
            warrantyEndDate = productItem.get("Warranty_End_Date");

            // ========== 1. 更新 Products_Purchased 模块 ==========
            if(dealId != null && dealId != "")
            {
                ppRecordId = null;
                searchCriteria = "Deal_Name:equals:" + dealId;
                productsPurchasedRecords = zoho.crm.searchRecords("Products_Purchased", searchCriteria, 1, 100);

                if(productsPurchasedRecords != null && productsPurchasedRecords.size() > 0)
                {
                    if(productId != null && productId != "")
                    {
                        for each ppRecord in productsPurchasedRecords
                        {
                            ppProductNameId = ppRecord.get("Product_Name");
                            ppProductId = "";
                            if(ppProductNameId != null)
                            {
                                try
                                {
                                    if(ppProductNameId.containsKey("id"))
                                    {
                                        ppProductId = ppProductNameId.get("id");
                                    }
                                    else
                                    {
                                        ppProductId = ppProductNameId.toString();
                                    }
                                }
                                catch (e)
                                {
                                    ppProductId = ppProductNameId.toString();
                                }
                            }

                            if(ppProductId == productId)
                            {
                                ppRecordId = ppRecord.get("id");
                                break;
                            }
                        }
                    }
                }

                if(ppRecordId != null)
                {
                    // 获取当前记录，对比是否有变化
                    currentPPRecord = zoho.crm.getRecordById("Products_Purchased", ppRecordId);
                    currentSerial = ifnull(currentPPRecord.get("Serial_Number"), "");
                    currentWarrantyStart = ifnull(currentPPRecord.get("Warranty_Start_Date"), "");
                    currentWarrantyEnd = ifnull(currentPPRecord.get("Warranty_End_Date"), "");

                    serialNumberStr = ifnull(serialNumber, "");
                    warrantyStartDateStr = ifnull(warrantyStartDate, "");
                    warrantyEndDateStr = ifnull(warrantyEndDate, "");

                    // 判断是否有变化
                    hasChange = false;
                    if(serialNumberStr != currentSerial)
                    {
                        hasChange = true;
                    }
                    if(warrantyStartDateStr != currentWarrantyStart)
                    {
                        hasChange = true;
                    }
                    if(warrantyEndDateStr != currentWarrantyEnd)
                    {
                        hasChange = true;
                    }

                    if(hasChange)
                    {
                        updateData = Map();
                        if(serialNumber != null && serialNumber != "")
                        {
                            updateData.put("Serial_Number", serialNumber);
                        }
                        if(warrantyStartDate != null)
                        {
                            updateData.put("Warranty_Start_Date", warrantyStartDate);
                        }
                        if(warrantyEndDate != null)
                        {
                            updateData.put("Warranty_End_Date", warrantyEndDate);
                        }

                        updateResult = zoho.crm.updateRecord("Products_Purchased", ppRecordId, updateData);
                        info "Updated Products_Purchased: " + updateResult;
                    }
                    else
                    {
                        info "Products_Purchased 数据无变化，跳过更新";
                    }
                }
            }

            // ========== 2. 更新 Deal 的 Product_Purchased_deal 子表 ==========
            if(dealId != null && dealId != "")
            {
                dealDetails = zoho.crm.getRecordById("Deals", dealId);
                dealProductList = dealDetails.get("Product_Purchased_deal");

                if(dealProductList != null && dealProductList.size() > 0)
                {
                    updatedDealProductList = List();
                    isUpdated = false;

                    for each dealProduct in dealProductList
                    {
                        dealProductNameId = dealProduct.get("Product_Name");
                        dealProductId = "";
                        if(dealProductNameId != null)
                        {
                            try
                            {
                                if(dealProductNameId.containsKey("id"))
                                {
                                    dealProductId = dealProductNameId.get("id");
                                }
                                else
                                {
                                    dealProductId = dealProductNameId.toString();
                                }
                            }
                            catch (e)
                            {
                                dealProductId = dealProductNameId.toString();
                            }
                        }

                        if(productId != null && productId != "" && dealProductId == productId)
                        {
                            // 对比是否有变化
                            dealCurrentSerial = ifnull(dealProduct.get("Serial_Number"), "");
                            dealCurrentWarrantyStart = ifnull(dealProduct.get("Warranty_Start_Date"), "");
                            dealCurrentWarrantyEnd = ifnull(dealProduct.get("Warranty_End_Date"), "");

                            serialNumberStr = ifnull(serialNumber, "");
                            warrantyStartDateStr = ifnull(warrantyStartDate, "");
                            warrantyEndDateStr = ifnull(warrantyEndDate, "");

                            hasDealChange = false;
                            if(serialNumberStr != dealCurrentSerial)
                            {
                                hasDealChange = true;
                            }
                            if(warrantyStartDateStr != dealCurrentWarrantyStart)
                            {
                                hasDealChange = true;
                            }
                            if(warrantyEndDateStr != dealCurrentWarrantyEnd)
                            {
                                hasDealChange = true;
                            }

                            if(hasDealChange)
                            {
                                if(serialNumber != null && serialNumber != "")
                                {
                                    dealProduct.put("Serial_Number", serialNumber);
                                }
                                if(warrantyStartDate != null)
                                {
                                    dealProduct.put("Warranty_Start_Date", warrantyStartDate);
                                }
                                if(warrantyEndDate != null)
                                {
                                    dealProduct.put("Warranty_End_Date", warrantyEndDate);
                                }
                                isUpdated = true;
                            }
                        }

                        updatedDealProductList.add(dealProduct);
                    }

                    if(isUpdated)
                    {
                        dealUpdateData = Map();
                        dealUpdateData.put("Product_Purchased_deal", updatedDealProductList);
                        dealUpdateResult = zoho.crm.updateRecord("Deals", dealId, dealUpdateData);
                        info "Updated Deal subform: " + dealUpdateResult;
                    }
                    else
                    {
                        info "Deal 子表数据无变化，跳过更新";
                    }
                }

                // ========== 3. 更新同一个 Deal 关联的其他 Cases ==========
                otherCasesList = zoho.crm.searchRecords("Cases", "Deal:equals:" + dealId, 1, 200);

                if(otherCasesList != null && otherCasesList.size() > 0)
                {
                    for each otherCase in otherCasesList
                    {
                        otherCaseId = otherCase.get("id");
                        if(otherCaseId == caseId)
                        {
                            continue;
                        }

                        otherCaseDetails = zoho.crm.getRecordById("Cases", otherCaseId);
                        otherCaseProductList = otherCaseDetails.get("Product_Purchased_Case");

                        if(otherCaseProductList != null && otherCaseProductList.size() > 0)
                        {
                            updatedOtherCaseProductList = List();
                            otherCaseUpdated = false;

                            for each otherProductItem in otherCaseProductList
                            {
                                otherProductNameId = otherProductItem.get("Product_Name");
                                otherProductId = "";
                                if(otherProductNameId != null)
                                {
                                    try
                                    {
                                        if(otherProductNameId.containsKey("id"))
                                        {
                                            otherProductId = otherProductNameId.get("id");
                                        }
                                        else
                                        {
                                            otherProductId = otherProductNameId.toString();
                                        }
                                    }
                                    catch (e)
                                    {
                                        otherProductId = otherProductNameId.toString();
                                    }
                                }

                                if(productId != null && productId != "" && otherProductId == productId)
                                {
                                    // 对比是否有变化
                                    otherCurrentSerial = ifnull(otherProductItem.get("Serial_Number"), "");
                                    otherCurrentWarrantyStart = ifnull(otherProductItem.get("Warranty_Start_Date"), "");
                                    otherCurrentWarrantyEnd = ifnull(otherProductItem.get("Warranty_End_Date"), "");

                                    serialNumberStr = ifnull(serialNumber, "");
                                    warrantyStartDateStr = ifnull(warrantyStartDate, "");
                                    warrantyEndDateStr = ifnull(warrantyEndDate, "");

                                    hasOtherCaseChange = false;
                                    if(serialNumberStr != otherCurrentSerial)
                                    {
                                        hasOtherCaseChange = true;
                                    }
                                    if(warrantyStartDateStr != otherCurrentWarrantyStart)
                                    {
                                        hasOtherCaseChange = true;
                                    }
                                    if(warrantyEndDateStr != otherCurrentWarrantyEnd)
                                    {
                                        hasOtherCaseChange = true;
                                    }

                                    if(hasOtherCaseChange)
                                    {
                                        if(serialNumber != null && serialNumber != "")
                                        {
                                            otherProductItem.put("Serial_Number", serialNumber);
                                        }
                                        if(warrantyStartDate != null)
                                        {
                                            otherProductItem.put("Warranty_Start_Date", warrantyStartDate);
                                        }
                                        if(warrantyEndDate != null)
                                        {
                                            otherProductItem.put("Warranty_End_Date", warrantyEndDate);
                                        }
                                        otherCaseUpdated = true;
                                    }
                                }

                                updatedOtherCaseProductList.add(otherProductItem);
                            }

                            if(otherCaseUpdated)
                            {
                                otherCaseUpdateData = Map();
                                otherCaseUpdateData.put("Product_Purchased_Case", updatedOtherCaseProductList);
                                otherCaseUpdateResult = zoho.crm.updateRecord("Cases", otherCaseId, otherCaseUpdateData);
                                info "Updated other Case: " + otherCaseUpdateResult;
                            }
                        }
                    }
                }
            }
        }

        info "Product_Purchased_Case 同步完成";
        return;
    }

    // ========== 检查 Product_Interest_Case 子表 ==========
    productInterestList = caseDetails.get("Product_Interest_Case");
    info "Product_Interest_Case: " + productInterestList;

    if(productInterestList != null && productInterestList.size() > 0)
    {
        info "处理 Product_Interest_Case 子表";

        // 提取 Case 的 Product ID 和 Comments 组合列表（用于对比）
        caseProductDataList = List();
        for each productItem in productInterestList
        {
            productInfo = productItem.get("Product_Name");
            productId = "";
            if(productInfo != null)
            {
                try
                {
                    if(productInfo.containsKey("id"))
                    {
                        productId = productInfo.get("id");
                    }
                    else
                    {
                        productId = productInfo.toString();
                    }
                }
                catch (e)
                {
                    productId = productInfo.toString();
                }
            }
            comments = ifnull(productItem.get("Comments"), "");

            if(productId != null && productId != "")
            {
                // 组合格式: "productId|comments"
                caseProductDataList.add(productId + "|" + comments);
            }
        }

        // 构建新的子表数据列表
        newProductList = List();
        for each productItem in productInterestList
        {
            productInfo = productItem.get("Product_Name");
            productId = "";
            if(productInfo != null)
            {
                try
                {
                    if(productInfo.containsKey("id"))
                    {
                        productId = productInfo.get("id");
                    }
                    else
                    {
                        productId = productInfo.toString();
                    }
                }
                catch (e)
                {
                    productId = productInfo.toString();
                }
            }

            comments = ifnull(productItem.get("Comments"), "");

            newItem = Map();
            if(productId != null && productId != "")
            {
                newItem.put("Product_Name", {"id": productId});
            }
            if(comments != "")
            {
                newItem.put("Comments", comments);
            }

            newProductList.add(newItem);
        }

        // ========== 如果关联 Lead ==========
        if(leadId != null && leadId != "")
        {
            info "关联 Lead: " + leadId;

            // 获取 Lead 现有子表数据
            leadDetails = zoho.crm.getRecordById("Leads", leadId);
            existingLeadProductList = leadDetails.get("Product_Interested_lead");

            // 提取 Lead 的 Product ID 和 Comments 组合列表（用于对比）
            leadProductDataList = List();
            if(existingLeadProductList != null && existingLeadProductList.size() > 0)
            {
                for each leadItem in existingLeadProductList
                {
                    leadProductInfo = leadItem.get("Product_Name");
                    leadProductId = "";
                    if(leadProductInfo != null)
                    {
                        try
                        {
                            if(leadProductInfo.containsKey("id"))
                            {
                                leadProductId = leadProductInfo.get("id");
                            }
                            else
                            {
                                leadProductId = leadProductInfo.toString();
                            }
                        }
                        catch (e)
                        {
                            leadProductId = leadProductInfo.toString();
                        }
                    }
                    leadComments = ifnull(leadItem.get("Comments"), "");

                    if(leadProductId != null && leadProductId != "")
                    {
                        leadProductDataList.add(leadProductId + "|" + leadComments);
                    }
                }
            }

            // 对比两个列表是否相同
            hasLeadChange = false;
            if(caseProductDataList.size() != leadProductDataList.size())
            {
                hasLeadChange = true;
            }
            else
            {
                // 数量相同，检查每个组合是否都存在
                for each caseDataItem in caseProductDataList
                {
                    if(!leadProductDataList.contains(caseDataItem))
                    {
                        hasLeadChange = true;
                        break;
                    }
                }
            }

            if(hasLeadChange)
            {
                info "Lead 子表数据有变化，执行更新";

                // 构建删除旧数据 + 添加新数据的 payload
                leadProductPayload = List();
                if(existingLeadProductList != null && existingLeadProductList.size() > 0)
                {
                    info "Lead 子表现在有 " + existingLeadProductList.size() + " 条数据，准备删除";
                    for each oldItem in existingLeadProductList
                    {
                        oldItemId = oldItem.get("id");
                        info "Lead 子表行 id: " + oldItemId;
                        if(oldItemId != null)
                        {
                            // 转换为字符串格式
                            oldItemIdStr = oldItemId.toString();
                            deleteItem = Map();
                            deleteItem.put("id", oldItemIdStr);
                            deleteItem.put("_delete", true);
                            leadProductPayload.add(deleteItem);
                        }
                    }
                }
                info "准备删除 " + leadProductPayload.size() + " 条旧数据";
                info "准备添加 " + newProductList.size() + " 条新数据";

                leadProductPayload.addAll(newProductList);

                // 使用 invokeurl 调用 API
                leadUpdateData = Map();
                leadUpdateData.put("Product_Interested_lead", leadProductPayload);

                leadDataList = List();
                leadDataList.add(leadUpdateData);

                leadRequestParams = Map();
                leadRequestParams.put("data", leadDataList);

                info "Lead Update Request: " + leadRequestParams;

                leadUpdateResp = invokeurl
                [
                    url: "https://www.zohoapis.com/crm/v8/Leads/" + leadId
                    type: PUT
                    parameters: leadRequestParams.toString()
                    connection: "crm"
                ];

                info "Updated Lead subform: " + leadUpdateResp;
            }
            else
            {
                info "Lead 子表数据无变化，跳过更新";
            }

            // 更新该 Lead 关联的其他 Case
            otherCasesList = zoho.crm.searchRecords("Cases", "Lead:equals:" + leadId, 1, 200);

            if(otherCasesList != null && otherCasesList.size() > 0)
            {
                for each otherCase in otherCasesList
                {
                    otherCaseId = otherCase.get("id");
                    if(otherCaseId == caseId)
                    {
                        continue;
                    }

                    otherCaseDetails = zoho.crm.getRecordById("Cases", otherCaseId);
                    existingOtherProductList = otherCaseDetails.get("Product_Interest_Case");

                    // 提取其他 Case 的 Product ID 和 Comments 组合列表
                    otherCaseProductDataList = List();
                    if(existingOtherProductList != null && existingOtherProductList.size() > 0)
                    {
                        for each otherItem in existingOtherProductList
                        {
                            otherProductInfo = otherItem.get("Product_Name");
                            otherProductId = "";
                            if(otherProductInfo != null)
                            {
                                try
                                {
                                    if(otherProductInfo.containsKey("id"))
                                    {
                                        otherProductId = otherProductInfo.get("id");
                                    }
                                    else
                                    {
                                        otherProductId = otherProductInfo.toString();
                                    }
                                }
                                catch (e)
                                {
                                    otherProductId = otherProductInfo.toString();
                                }
                            }
                            otherComments = ifnull(otherItem.get("Comments"), "");

                            if(otherProductId != null && otherProductId != "")
                            {
                                otherCaseProductDataList.add(otherProductId + "|" + otherComments);
                            }
                        }
                    }

                    // 对比是否相同
                    hasOtherCaseChange = false;
                    if(caseProductDataList.size() != otherCaseProductDataList.size())
                    {
                        hasOtherCaseChange = true;
                    }
                    else
                    {
                        for each caseDataItem in caseProductDataList
                        {
                            if(!otherCaseProductDataList.contains(caseDataItem))
                            {
                                hasOtherCaseChange = true;
                                break;
                            }
                        }
                    }

                    if(hasOtherCaseChange)
                    {
                        info "其他 Case 子表数据有变化，执行更新: " + otherCaseId;

                        otherProductPayload = List();
                        if(existingOtherProductList != null && existingOtherProductList.size() > 0)
                        {
                            for each oldItem in existingOtherProductList
                            {
                                oldItemId = oldItem.get("id");
                                if(oldItemId != null)
                                {
                                    oldItemIdStr = oldItemId.toString();
                                    deleteItem = Map();
                                    deleteItem.put("id", oldItemIdStr);
                                    deleteItem.put("_delete", true);
                                    otherProductPayload.add(deleteItem);
                                }
                            }
                        }
                        otherProductPayload.addAll(newProductList);

                        otherCaseUpdateData = Map();
                        otherCaseUpdateData.put("Product_Interest_Case", otherProductPayload);

                        otherCaseDataList = List();
                        otherCaseDataList.add(otherCaseUpdateData);

                        otherCaseRequestParams = Map();
                        otherCaseRequestParams.put("data", otherCaseDataList);

                        otherCaseUpdateResp = invokeurl
                        [
                            url: "https://www.zohoapis.com/crm/v8/Cases/" + otherCaseId
                            type: PUT
                            parameters: otherCaseRequestParams.toString()
                            connection: "crm"
                        ];

                        info "Updated other Case: " + otherCaseUpdateResp;
                    }
                    else
                    {
                        info "其他 Case 子表数据无变化，跳过更新: " + otherCaseId;
                    }
                }
            }
        }

        // ========== 如果关联 Deal ==========
        if(dealId != null && dealId != "")
        {
            info "关联 Deal: " + dealId;

            // 获取 Deal 现有子表数据
            dealDetails = zoho.crm.getRecordById("Deals", dealId);
            existingDealProductList = dealDetails.get("Product_Interested_deal");

            // 提取 Deal 的 Product ID 和 Comments 组合列表（用于对比）
            dealProductDataList = List();
            if(existingDealProductList != null && existingDealProductList.size() > 0)
            {
                for each dealItem in existingDealProductList
                {
                    dealProductInfo = dealItem.get("Product_Name");
                    dealProductId = "";
                    if(dealProductInfo != null)
                    {
                        try
                        {
                            if(dealProductInfo.containsKey("id"))
                            {
                                dealProductId = dealProductInfo.get("id");
                            }
                            else
                            {
                                dealProductId = dealProductInfo.toString();
                            }
                        }
                        catch (e)
                        {
                            dealProductId = dealProductInfo.toString();
                        }
                    }
                    dealComments = ifnull(dealItem.get("Comments"), "");

                    if(dealProductId != null && dealProductId != "")
                    {
                        dealProductDataList.add(dealProductId + "|" + dealComments);
                    }
                }
            }

            // 对比两个列表是否相同
            hasDealChange = false;
            if(caseProductDataList.size() != dealProductDataList.size())
            {
                hasDealChange = true;
            }
            else
            {
                for each caseDataItem in caseProductDataList
                {
                    if(!dealProductDataList.contains(caseDataItem))
                    {
                        hasDealChange = true;
                        break;
                    }
                }
            }

            if(hasDealChange)
            {
                info "Deal 子表数据有变化，执行更新";

                // 构建删除旧数据 + 添加新数据的 payload
                dealProductPayload = List();
                if(existingDealProductList != null && existingDealProductList.size() > 0)
                {
                    for each oldItem in existingDealProductList
                    {
                        oldItemId = oldItem.get("id");
                        if(oldItemId != null)
                        {
                            oldItemIdStr = oldItemId.toString();
                            deleteItem = Map();
                            deleteItem.put("id", oldItemIdStr);
                            deleteItem.put("_delete", true);
                            dealProductPayload.add(deleteItem);
                        }
                    }
                }
                dealProductPayload.addAll(newProductList);

                dealUpdateData = Map();
                dealUpdateData.put("Product_Interested_deal", dealProductPayload);

                dealDataList = List();
                dealDataList.add(dealUpdateData);

                dealRequestParams = Map();
                dealRequestParams.put("data", dealDataList);

                dealUpdateResp = invokeurl
                [
                    url: "https://www.zohoapis.com/crm/v8/Deals/" + dealId
                    type: PUT
                    parameters: dealRequestParams.toString()
                    connection: "crm"
                ];

                info "Updated Deal subform: " + dealUpdateResp;
            }
            else
            {
                info "Deal 子表数据无变化，跳过更新";
            }

            // 更新该 Deal 关联的其他 Case
            otherCasesList = zoho.crm.searchRecords("Cases", "Deal:equals:" + dealId, 1, 200);

            if(otherCasesList != null && otherCasesList.size() > 0)
            {
                for each otherCase in otherCasesList
                {
                    otherCaseId = otherCase.get("id");
                    if(otherCaseId == caseId)
                    {
                        continue;
                    }

                    otherCaseDetails = zoho.crm.getRecordById("Cases", otherCaseId);
                    existingOtherProductList = otherCaseDetails.get("Product_Interest_Case");

                    // 提取其他 Case 的 Product ID 和 Comments 组合列表
                    otherCaseProductDataList = List();
                    if(existingOtherProductList != null && existingOtherProductList.size() > 0)
                    {
                        for each otherItem in existingOtherProductList
                        {
                            otherProductInfo = otherItem.get("Product_Name");
                            otherProductId = "";
                            if(otherProductInfo != null)
                            {
                                try
                                {
                                    if(otherProductInfo.containsKey("id"))
                                    {
                                        otherProductId = otherProductInfo.get("id");
                                    }
                                    else
                                    {
                                        otherProductId = otherProductInfo.toString();
                                    }
                                }
                                catch (e)
                                {
                                    otherProductId = otherProductInfo.toString();
                                }
                            }
                            otherComments = ifnull(otherItem.get("Comments"), "");

                            if(otherProductId != null && otherProductId != "")
                            {
                                otherCaseProductDataList.add(otherProductId + "|" + otherComments);
                            }
                        }
                    }

                    // 对比是否相同
                    hasOtherCaseChange = false;
                    if(caseProductDataList.size() != otherCaseProductDataList.size())
                    {
                        hasOtherCaseChange = true;
                    }
                    else
                    {
                        for each caseDataItem in caseProductDataList
                        {
                            if(!otherCaseProductDataList.contains(caseDataItem))
                            {
                                hasOtherCaseChange = true;
                                break;
                            }
                        }
                    }

                    if(hasOtherCaseChange)
                    {
                        info "其他 Case 子表数据有变化，执行更新: " + otherCaseId;

                        otherProductPayload = List();
                        if(existingOtherProductList != null && existingOtherProductList.size() > 0)
                        {
                            for each oldItem in existingOtherProductList
                            {
                                oldItemId = oldItem.get("id");
                                if(oldItemId != null)
                                {
                                    oldItemIdStr = oldItemId.toString();
                                    deleteItem = Map();
                                    deleteItem.put("id", oldItemIdStr);
                                    deleteItem.put("_delete", true);
                                    otherProductPayload.add(deleteItem);
                                }
                            }
                        }
                        otherProductPayload.addAll(newProductList);

                        otherCaseUpdateData = Map();
                        otherCaseUpdateData.put("Product_Interest_Case", otherProductPayload);

                        otherCaseDataList = List();
                        otherCaseDataList.add(otherCaseUpdateData);

                        otherCaseRequestParams = Map();
                        otherCaseRequestParams.put("data", otherCaseDataList);

                        otherCaseUpdateResp = invokeurl
                        [
                            url: "https://www.zohoapis.com/crm/v8/Cases/" + otherCaseId
                            type: PUT
                            parameters: otherCaseRequestParams.toString()
                            connection: "crm"
                        ];

                        info "Updated other Case: " + otherCaseUpdateResp;
                    }
                    else
                    {
                        info "其他 Case 子表数据无变化，跳过更新: " + otherCaseId;
                    }
                }
            }
        }

        info "Product_Interest_Case 同步完成";
        return;
    }

    info "没有需要同步的子表数据";
}
