// ============================================================================
// Re-sync Vendor Bills for specific vendors with GST Adjustment logic
// Target vendors: RASLEY PTY LTD, Linkas Logistics Pty Ltd, CIMC Wetrans Australia
// Logic: If item GST_Code == "GST:NCT-AU", move GST to GST_Adjustment, Amount = net
// ============================================================================

string standalone.ResyncVendorBillWithGST(String vendorBillId)
{
    result = Map();

    // 1. Get data from NetSuite
    vbUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/vendorbill/" + vendorBillId;
    auth = standalone.SetHeaders("GET", vbUrl, true);
    response = invokeurl
    [
        url: vbUrl + "?expandSubResources=true"
        type: GET
        headers: {"Content-Type": "application/json", "Authorization": auth}
    ];

    if(response == null)
    {
        result.put("error", "Failed to get Vendor Bill");
        return result;
    }

    responseContent = response.getFileContent();
    if(responseContent == null)
    {
        result.put("error", "Empty response");
        return result;
    }

    responseList = responseContent.toJSONList();
    if(responseList == null || responseList.size() == 0)
    {
        result.put("error", "Cannot parse response");
        return result;
    }

    vbDetail = responseList.get(0);
    if(vbDetail.containsKey("error"))
    {
        result.put("error", "NetSuite error: " + vbDetail.get("error"));
        return result;
    }

    netSuiteId = vbDetail.get("id");
    if(netSuiteId == null)
    {
        result.put("error", "No NetSuite ID");
        return result;
    }

    info "========================================";
    info "Resync VendorBill: " + vbDetail.get("tranId");

    // 2. Build Vendor Bill data
    params = Map();
    params.put("Netsuite_Id", netSuiteId);
    params.put("Name", vbDetail.get("tranId"));
    params.put("Transaction_Number", vbDetail.get("transactionNumber"));
    params.put("Ref_Number", vbDetail.get("tranId"));

    balance = vbDetail.get("balance");
    if(balance != null)
    {
        params.put("Balance", round(balance, 2));
    }

    params.put("Due_Date", vbDetail.get("dueDate"));
    params.put("Memo", vbDetail.get("memo"));
    params.put("Date_Received", vbDetail.get("custbody_anz_date_received"));

    locationObj = vbDetail.get("location");
    if(locationObj != null)
    {
        params.put("Location", locationObj.get("refName"));
    }

    vatRegNum = vbDetail.get("vatRegNum");
    if(vatRegNum != null)
    {
        params.put("vatRegNum", vatRegNum);
    }

    received = vbDetail.get("received");
    if(received == true)
    {
        params.put("Received", true);
    }
    else
    {
        params.put("Received", false);
    }

    postingPeriodObj = vbDetail.get("postingPeriod");
    if(postingPeriodObj != null)
    {
        params.put("Posting_Period", postingPeriodObj.get("refName"));
    }

    approvalStatusObj = vbDetail.get("approvalStatus");
    if(approvalStatusObj != null)
    {
        params.put("Approval_Status", approvalStatusObj.get("refName"));
    }

    statusObj = vbDetail.get("status");
    if(statusObj != null)
    {
        params.put("Status", statusObj.get("refName"));
    }

    // Tax total - will be adjusted later for NCT items
    taxTotal = vbDetail.get("taxTotal");

    // GST_Amt
    gstAmt = vbDetail.get("custbody_stc_tax_after_discount");
    if(gstAmt != null)
    {
        params.put("GST_Amt", round(gstAmt, 2));
    }

    // Vendor lookup
    entityObj = vbDetail.get("entity");
    if(entityObj != null)
    {
        vendorId = entityObj.get("id");
        vendorRecord = zoho.crm.searchRecords("Vendors", "(Netsuite_Id:equals:" + vendorId + ")");
        if(vendorRecord != null && vendorRecord.size() > 0)
        {
            params.put("Vendor", {"id": vendorRecord.get(0).get("id")});
        }
    }

    params.put("Owner", "102317000000370001");

    // Billing Address
    billingAddress = vbDetail.get("billingAddress");
    if(billingAddress != null)
    {
        params.put("Billing_Street", billingAddress.get("addr1"));
        params.put("Billing_City", billingAddress.get("city"));
        params.put("Billing_State", billingAddress.get("state"));
        params.put("Billing_Code", billingAddress.get("zip"));
        countryObj = billingAddress.get("country");
        if(countryObj != null)
        {
            params.put("Billing_Country", countryObj.get("refName"));
        }
    }

    // 3. Build subform items (Purchase_Items_Bill)
    itemList = List();
    totalGSTAdjust = 0;  // accumulate GST from NCT items
    itemObj = vbDetail.get("item");
    if(itemObj != null)
    {
        items = itemObj.get("items");
        if(items != null && items.size() > 0)
        {
            for each item in items
            {
                itemRecord = item.get("item");
                if(itemRecord != null)
                {
                    itemId = itemRecord.get("id");
                    productRecord = zoho.crm.searchRecords("Products", "(Internal_ID:equals:" + itemId + ")");
                    if(productRecord != null && productRecord.size() > 0)
                    {
                        itemParams = Map();
                        itemParams.put("Product_Name", {"id": productRecord.get(0).get("id")});

                        description = item.get("description");
                        if(description != null)
                        {
                            if(description.length() > 255)
                            {
                                itemParams.put("Product_Description_Long", description);
                            }
                            else
                            {
                                itemParams.put("Product_Description", description);
                            }
                        }

                        itemQuantity = item.get("quantity");
                        if(itemQuantity != null)
                        {
                            itemParams.put("Quantity", itemQuantity.toLong());
                        }

                        itemRate = item.get("rate");
                        if(itemRate != null)
                        {
                            itemParams.put("Rate", round(itemRate, 7));
                        }

                        itemAmount = item.get("amount");
                        itemTax = item.get("tax1Amt");

                        // GST code
                        taxCodeObj = item.get("taxCode");
                        gstCode = "";
                        if(taxCodeObj != null)
                        {
                            gstCode = taxCodeObj.get("refName");
                            itemParams.put("GST_Code", gstCode);
                        }

                        // === GST:NCT-AU logic ===
                        if(gstCode == "GST:NCT-AU" && itemAmount != null && itemTax != null && itemTax > 0)
                        {
                            // Accumulate GST to main table total, zero out item GST
                            totalGSTAdjust = totalGSTAdjust + round(itemTax, 2);
                            itemParams.put("GST", 0);
                            // Amount = net (excl GST)
                            netAmount = round(itemAmount - itemTax, 2);
                            itemParams.put("Amount", netAmount);
                            itemParams.put("STotal", netAmount);
                            itemParams.put("Total", netAmount);
                            info "  -> GST:NCT-AU item, GST " + round(itemTax, 2) + " deducted, Amount=" + netAmount;
                        }
                        else
                        {
                            // Normal items
                            if(itemAmount != null)
                            {
                                itemParams.put("Amount", itemAmount);
                                itemParams.put("STotal", itemAmount);
                                itemParams.put("Total", itemAmount);
                            }
                            if(itemTax != null)
                            {
                                itemParams.put("GST", itemTax);
                            }
                        }

                        units = item.get("units");
                        if(units != null)
                        {
                            itemParams.put("Units", standalone.ConvertSaleUnit(units));
                        }

                        itemList.add(itemParams);
                    }
                }
            }
        }
    }

    // 4. Build expenses subform
    expenseList = List();
    expenseObj = vbDetail.get("expense");
    if(expenseObj != null)
    {
        expenses = expenseObj.get("items");
        if(expenses != null && expenses.size() > 0)
        {
            for each expense in expenses
            {
                expenseParams = Map();

                accountObj = expense.get("account");
                if(accountObj != null)
                {
                    expenseParams.put("Account", accountObj.get("refName"));
                }

                memo = expense.get("memo");
                if(memo != null)
                {
                    if(memo.length() > 255)
                    {
                        expenseParams.put("Memo_Long", memo);
                    }
                    else
                    {
                        expenseParams.put("Memo", memo);
                    }
                }

                expenseAmount = expense.get("amount");
                if(expenseAmount != null)
                {
                    expenseParams.put("Amount", expenseAmount);
                }

                expenseTax = expense.get("tax1Amt");
                if(expenseTax != null)
                {
                    expenseParams.put("GST", expenseTax);
                }

                taxCodeObj = expense.get("taxCode");
                if(taxCodeObj != null)
                {
                    expenseParams.put("GST_Code", taxCodeObj.get("refName"));
                }

                expenseLocationObj = expense.get("location");
                if(expenseLocationObj != null)
                {
                    expenseParams.put("Location", expenseLocationObj.get("refName"));
                }

                isBillable = expense.get("isBillable");
                if(isBillable == true)
                {
                    expenseParams.put("isBillable", true);
                }
                else
                {
                    expenseParams.put("isBillable", false);
                }

                expenseList.add(expenseParams);
            }
        }
    }

    // Put total GST Adjustment on main table, adjust Tax accordingly
    if(totalGSTAdjust > 0)
    {
        params.put("GST_Adjustment", round(totalGSTAdjust, 2));
        // Subtract NCT GST from total Tax
        if(taxTotal != null)
        {
            adjustedTax = round(taxTotal - totalGSTAdjust, 2);
            params.put("Tax", adjustedTax);
        }
        info "Total GST_Adjustment: " + round(totalGSTAdjust, 2) + " | Tax: " + adjustedTax;
    }
    else
    {
        if(taxTotal != null)
        {
            params.put("Tax", round(taxTotal, 2));
        }
    }

    // 5. Update CRM VendorBill
    checkDetail = zoho.crm.searchRecords("VendorBill", "(Netsuite_Id:equals:" + netSuiteId + ")");
    if(checkDetail != null && checkDetail.size() > 0)
    {
        existingId = checkDetail.get(0).get("id");

        // Get existing record for subform handling
        getResp = invokeurl
        [
            url: "https://www.zohoapis.com.au/crm/v8/VendorBill/" + existingId
            type: GET
            connection: "crm"
        ];

        existingBillDetail = null;
        if(getResp != null && getResp.get("data") != null && getResp.get("data").size() > 0)
        {
            existingBillDetail = getResp.get("data").get(0);
        }

        // Handle Purchase_Items_Bill
        itemsPayload = List();
        if(existingBillDetail != null)
        {
            existingItems = existingBillDetail.get("Purchase_Items_Bill");
            if(existingItems != null && existingItems.size() > 0)
            {
                for each lineItem in existingItems
                {
                    lineItemId = lineItem.get("id");
                    if(lineItemId != null)
                    {
                        itemsPayload.add({"id": lineItemId, "_delete": true});
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
            params.put("Purchase_Items_Bill", itemsPayload);
        }

        // Handle Expenses
        expensesPayload = List();
        if(existingBillDetail != null)
        {
            existingExpenses = existingBillDetail.get("Expenses");
            if(existingExpenses != null && existingExpenses.size() > 0)
            {
                for each existingExpense in existingExpenses
                {
                    existingExpenseId = existingExpense.get("id");
                    if(existingExpenseId != null)
                    {
                        expensesPayload.add({"id": existingExpenseId, "_delete": true});
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
            params.put("Expenses", expensesPayload);
        }

        resParams = Map();
        resList = List();
        resList.add(params);
        resParams.put("data", resList);

        updateResp = invokeurl
        [
            url: "https://www.zohoapis.com.au/crm/v8/VendorBill/" + existingId
            type: PUT
            parameters: resParams.toString()
            connection: "crm"
        ];
        result.put("res", updateResp);
        info "VendorBill updated: " + vbDetail.get("tranId");
    }
    else
    {
        // Create new
        if(itemList.size() > 0)
        {
            params.put("Purchase_Items_Bill", itemList);
        }
        if(expenseList.size() > 0)
        {
            params.put("Expenses", expenseList);
        }

        resParams = Map();
        resList = List();
        resList.add(params);
        resParams.put("data", resList);

        addResp = invokeurl
        [
            url: "https://www.zohoapis.com.au/crm/v8/VendorBill"
            type: POST
            parameters: resParams.toString()
            connection: "crm"
        ];
        result.put("res", addResp);
        info "VendorBill created: " + vbDetail.get("tranId");
    }

    return result;
}

// ============================================================================
// Batch re-sync for specific vendors
// ============================================================================
void test.ResyncGSTAdjustVendorBills()
{
    // Vendor NetSuite IDs (from CRM)
    targetVendors = {"RASLEY PTY LTD", "Linkas Logistics Pty Ltd", "CIMC Wetrans Australia"};

    totalSuccess = 0;
    totalFailed = 0;
    errorIds = List();

    // Step 1: Find VendorBills for these vendors in CRM
    for each vendorName in targetVendors
    {
        info "=== Searching VendorBills for vendor: " + vendorName;

        // Find vendor record
        vendorRecords = zoho.crm.searchRecords("Vendors", "(Vendor_Name:equals:" + vendorName + ")");
        if(vendorRecords == null || vendorRecords.size() == 0)
        {
            info "Vendor not found: " + vendorName;
            continue;
        }
        vendorId = vendorRecords.get(0).get("id");

        // Find all VendorBills for this vendor
        // Use COQL to find by vendor lookup field
        vendorBills = zoho.crm.searchRecords("VendorBill", "(Vendor:equals:" + vendorId + ")");

        if(vendorBills == null || vendorBills.size() == 0)
        {
            info "No VendorBills found for: " + vendorName;
            continue;
        }

        info "Found " + vendorBills.size() + " VendorBills for " + vendorName;

        for each vb in vendorBills
        {
            netsuiteId = vb.get("Netsuite_Id");
            if(netsuiteId == null || netsuiteId == "")
            {
                info "Skip VB without Netsuite_Id: " + vb.get("Name");
                continue;
            }

            info "Processing VendorBill: " + vb.get("Name") + " (NS ID: " + netsuiteId + ")";

            try
            {
                syncResult = standalone.ResyncVendorBillWithGST(netsuiteId);
                isSuccess = false;
                errorMsg = "";

                if(syncResult != null)
                {
                    res = syncResult.get("res");
                    if(res != null)
                    {
                        data = res.get("data");
                        if(data != null && data.size() > 0)
                        {
                            firstItem = data.get(0);
                            status = firstItem.get("status");
                            code = firstItem.get("code");
                            message = firstItem.get("message");

                            if((status != null && status == "success") || (code != null && code == "SUCCESS"))
                            {
                                isSuccess = true;
                            }
                            else if(message != null)
                            {
                                errorMsg = message;
                            }
                        }
                    }

                    errorFromResult = syncResult.get("error");
                    if(errorFromResult != null && errorFromResult != "")
                    {
                        errorMsg = errorFromResult;
                    }
                }

                if(isSuccess)
                {
                    totalSuccess = totalSuccess + 1;
                    info "SUCCESS: " + vb.get("Name");
                }
                else
                {
                    errorIds.add(netsuiteId);
                    totalFailed = totalFailed + 1;
                    info "FAILED: " + vb.get("Name") + " - " + errorMsg;
                }
            }
            catch (e)
            {
                errorIds.add(netsuiteId);
                totalFailed = totalFailed + 1;
                info "EXCEPTION: " + vb.get("Name") + " - " + e;
            }
        }
    }

    info "========================================";
    info "Re-sync complete. Success: " + totalSuccess + ", Failed: " + totalFailed;
    if(errorIds.size() > 0)
    {
        info "Failed IDs: " + errorIds;
    }
}