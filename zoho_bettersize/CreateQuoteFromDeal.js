/**
 * Deal Button - Create Quote in Zoho Books
 *
 * Trigger: Button on Deals module
 *
 * Function:
 * 1. Check if Stage is not "Closed Won" and not converted to product purchased
 * 2. Get Deal's Product_Interested_deal subform
 * 3. Find Customer in Books
 * 4. Create Quote (Estimate) with product info
 *
 * Parameter: dealId - Deal ID
 */

string button.CreateQuoteFromDeal(string dealId)
{
    info "========== Start creating Quote from Deal ==========";
    info "Deal ID: " + dealId;

    organizationId = "920286948";  // bettersize Books organization_id

    // ==================== 1. Get Deal Info ====================
    dealRecord = zoho.crm.getRecordById("Deals", dealId);
    info "Deal Record: " + dealRecord;

    if(dealRecord == null)
    {
        return "Failed to get Deal record";
    }

    dealName = ifnull(dealRecord.get("Deal_Name"), "");
    stage = ifnull(dealRecord.get("Stage"), "");
    isConvertedToProductPurchased = dealRecord.get("IsConvertedToProductPurchased");

    // Get Account info
    accountName = "";
    accountId = "";
    accountField = dealRecord.get("Account_Name");
    if(accountField != null)
    {
        accountName = ifnull(accountField.get("name"), "");
        if(accountField.contains("id"))
        {
            accountId = accountField.get("id");
        }
    }

    info "Deal Name: " + dealName;
    info "Account Name: " + accountName;
    info "Stage: " + stage;
    info "IsConvertedToProductPurchased: " + isConvertedToProductPurchased;

    // ==================== 2. Check if can create Quote ====================
    if(stage == "Closed Won")
    {
        return "Cannot create Quote: Deal stage is 'Closed Won'";
    }

    if(isConvertedToProductPurchased == true || isConvertedToProductPurchased == "true")
    {
        return "Cannot create Quote: Products already converted to purchased";
    }

    // ==================== 3. Get Deal Full Data (with subform) ====================
    getResp = invokeurl
    [
        url: "https://www.zohoapis.com/crm/v8/Deals/" + dealId
        type: GET
        connection: "crm"
    ];

    info "Deal Full Data: " + getResp;

    // Parse subform data
    productInterestedDeal = List();
    if(getResp != null && getResp.get("data") != null && getResp.get("data").size() > 0)
    {
        dealData = getResp.get("data").get(0);
        productInterestedRaw = dealData.get("Product_Interested_deal");

        if(productInterestedRaw != null)
        {
            productInterestedDeal = productInterestedRaw;
        }
    }

    info "Product Interested Deal size: " + productInterestedDeal.size();

    if(productInterestedDeal.size() == 0)
    {
        return "No product information in this Deal, cannot create Quote";
    }

    // ==================== 4. Find Customer in Books ====================
    // Use Account Name to match Customer in Books
    if(accountName == null || accountName == "")
    {
        return "No Account information in this Deal, cannot create Quote";
    }

    // Search for existing Customer
    searchCustomerUrl = "https://www.zohoapis.com/books/v3/contacts?organization_id=" + organizationId + "&contact_name=" + encodeUrl(accountName);

    searchCustomerResp = invokeurl
    [
        url: searchCustomerUrl
        type: GET
        connection: "books"
    ];
    info "Search Customer Response: " + searchCustomerResp;

    customerId = null;
    contacts = searchCustomerResp.get("contacts");

    if(contacts != null && contacts.size() > 0)
    {
        // Iterate search results, exact match name
        for each contact in contacts
        {
            contactName = ifnull(contact.get("contact_name"), "");
            info "Checking contact: " + contactName + " vs " + accountName;
            if(contactName == accountName)
            {
                customerId = contact.get("contact_id");
                info "Found exact match Customer ID: " + customerId;
                break;
            }
        }
    }

    if(customerId == null)
    {
        // No exact match found, return error
        return "Customer '" + accountName + "' not found in Zoho Books. Please sync Customer first.";
    }

    // ==================== 5. Build Quote Line Items ====================
    lineItems = List();

    for each item in productInterestedDeal
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

        // Search product in Books
        booksItem = null;
        if(productName != null && productName != "")
        {
            searchItemUrl = "https://www.zohoapis.com/books/v3/items?organization_id=" + organizationId + "&name=" + encodeUrl(productName);

            searchItemResp = invokeurl
            [
                url: searchItemUrl
                type: GET
                connection: "books"
            ];
            info "Search Item Response for '" + productName + "': " + searchItemResp;

            items = searchItemResp.get("items");
            if(items != null && items.size() > 0)
            {
                booksItem = items.get(0);
            }
        }

        // Build line item
        lineItem = Map();

        if(booksItem != null && booksItem.get("item_id") != null)
        {
            // Use product found in Books
            lineItem.put("item_id", booksItem.get("item_id"));
            lineItem.put("name", productName);
        }
        else
        {
            // Product not found, use name only
            lineItem.put("name", productName);
            lineItem.put("rate", 0);
        }

        // Comments maps to cf_remarks
        if(comments != null && comments != "")
        {
            lineItem.put("cf_remarks", comments);
        }

        lineItems.add(lineItem);
    }

    info "Line Items count: " + lineItems.size();

    // ==================== 6. Create Quote (Estimate) ====================
    today = zoho.currentdate;
    todayStr = today.toString("yyyy-MM-dd");

    quoteData = Map();
    quoteData.put("customer_id", customerId);
    quoteData.put("date", todayStr);
    quoteData.put("line_items", lineItems);

    // Set cf_related_deal (External Lookup to CRM Deal)
    // Build custom_fields list
    customFieldsList = List();
    relatedDealMap = Map();
    relatedDealMap.put("label", "Related Deal");  // Custom field label in Zoho Books
    relatedDealMap.put("value", dealId);  // Deal ID from CRM
    relatedDealMap.put("value_formatted", dealName);  // Deal Name for display
    customFieldsList.add(relatedDealMap);
    quoteData.put("custom_fields", customFieldsList);

    createQuoteUrl = "https://www.zohoapis.com/books/v3/estimates?organization_id=" + organizationId;

    createQuoteResp = invokeurl
    [
        url: createQuoteUrl
        type: POST
        parameters: quoteData.toString()
        connection: "books"
    ];
    info "Create Quote Response: " + createQuoteResp;

    if(createQuoteResp != null && createQuoteResp.get("estimate") != null)
    {
        estimateId = createQuoteResp.get("estimate").get("estimate_id");
        estimateNumber = createQuoteResp.get("estimate").get("estimate_number");

        // Open Quote in Books
        booksUrl = "https://books.zoho.com/app/" + organizationId + "#/quotes/" + estimateId + "/edit";
        openUrl(booksUrl, "new window");

        return "Quote created: " + estimateNumber + ", " + lineItems.size() + " products";
    }
    else
    {
        // Check error message
        errorMsg = "Failed to create Quote";
        if(createQuoteResp != null && createQuoteResp.get("message") != null)
        {
            errorMsg = errorMsg + " - " + createQuoteResp.get("message");
        }
        return errorMsg;
    }
}
