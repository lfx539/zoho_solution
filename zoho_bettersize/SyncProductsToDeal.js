/**
 * Lead Button - Sync Products to Converted Deal
 *
 * Trigger: Button on Leads module
 *
 * Function: After Lead is converted to Deal, sync Product_Interested_lead to Deal's Product_Interested_deal
 * - Clear existing products in Deal
 * - Add all products from Lead
 *
 * Parameter: leadId - Lead ID
 */

string button.syncProductsToDeal(string leadId)
{
    info "========== Start syncing products to Deal ==========";
    info "Lead ID: " + leadId;

    // ==================== 1. Get Lead Full Data ====================
    getResp = invokeurl
    [
        url: "https://www.zohoapis.com/crm/v8/Leads/" + leadId
        type: GET
        connection: "crm"
    ];

    info "Lead Full Data: " + getResp;

    if(getResp == null || getResp.get("data") == null || getResp.get("data").size() == 0)
    {
        return "Failed to get Lead record";
    }

    leadData = getResp.get("data").get(0);

    // ==================== 2. Find converted Deal using COQL ====================
    // Query Deals where LeadName = leadId
    coqlQuery = "select id, Deal_Name from Deals where LeadName = '" + leadId + "'";

    coqlParams = Map();
    coqlParams.put("select_query", coqlQuery);

    coqlResp = invokeurl
    [
        url: "https://www.zohoapis.com/crm/v8/coql"
        type: POST
        parameters: coqlParams.toString()
        connection: "crm"
    ];

    info "COQL Response: " + coqlResp;

    dealId = null;
    if(coqlResp != null && coqlResp.get("data") != null && coqlResp.get("data").size() > 0)
    {
        dealId = coqlResp.get("data").get(0).get("id");
        dealName = coqlResp.get("data").get(0).get("Deal_Name");
        info "Found converted Deal ID: " + dealId + ", Name: " + dealName;
    }

    if(dealId == null || dealId == "")
    {
        return "This Lead has not been converted to Deal yet";
    }

    // ==================== 3. Get Product_Interested_lead ====================
    productInterestedLead = leadData.get("Product_Interested_lead");

    if(productInterestedLead == null || productInterestedLead.size() == 0)
    {
        return "No products to sync in this Lead";
    }

    info "Product count in Lead: " + productInterestedLead.size();

    // ==================== 4. Build Product_Interested_deal data ====================
    // Clear existing products by replacing with new list
    newProductList = List();

    for each item in productInterestedLead
    {
        productInfo = item.get("Product_Name");
        productName = "";
        productId = "";

        if(productInfo != null)
        {
            productName = ifnull(productInfo.get("name"), "");
            productId = ifnull(productInfo.get("id"), "");
        }

        comments = ifnull(item.get("Comments"), "");

        // Build new product item for Deal
        newItem = Map();

        // Product_Name: must include id for lookup
        if(productId != null && productId != "")
        {
            productMap = Map();
            productMap.put("id", productId);
            productMap.put("name", productName);
            newItem.put("Product_Name", productMap);
        }

        // Comments
        if(comments != null && comments != "")
        {
            newItem.put("Comments", comments);
        }

        newProductList.add(newItem);
    }

    info "New product list size: " + newProductList.size();

    // ==================== 5. Update Deal ====================
    updateData = Map();
    updateData.put("Product_Interested_deal", newProductList);

    updateResp = zoho.crm.updateRecord("Deals", dealId, updateData);
    info "Update Deal Response: " + updateResp;

    if(updateResp != null && updateResp.containsKey("code"))
    {
        if(updateResp.get("code") == "SUCCESS")
        {
            // Open Deal in new window
            dealUrl = "https://crm.zoho.com/crm/org920285242/tab/Potentials/" + dealId;
            openUrl(dealUrl, "new window");

            return "Successfully synced " + newProductList.size() + " products to Deal";
        }
        else
        {
            return "Failed to update Deal: " + updateResp.get("message");
        }
    }
    else
    {
        // Open Deal in new window
        dealUrl = "https://crm.zoho.com/crm/org920285242/tab/Potentials/" + dealId;
        openUrl(dealUrl, "new window");

        return "Successfully synced " + newProductList.size() + " products to Deal";
    }
}
