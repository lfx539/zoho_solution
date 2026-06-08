/**
 * Lead Button - Create Quote in Zoho Books
 *
 * Features:
 * 1. Get Lead info and Product_Interested_lead subform
 * 2. Find or create Customer in Books
 * 3. Create Quote (Estimate) with product info
 *
 * Parameter: leadId - Lead ID
 */

string button.CreateQuoteFromLead(string leadId)
{
    info "========== Start creating Quote from Lead ==========";
    info "Lead ID: " + leadId;

    organizationId = "920286948";  // bettersize Books organization_id

    // ==================== 1. Get Lead Info ====================
    leadRecord = zoho.crm.getRecordById("Leads", leadId);
    info "Lead Record: " + leadRecord;

    if(leadRecord == null)
    {
        return "Failed to get Lead record";
    }

    leadName = ifnull(leadRecord.get("Name"), "");
    leadCompany = ifnull(leadRecord.get("Company"), "");
    leadEmail = ifnull(leadRecord.get("Email"), "");
    leadPhone = ifnull(leadRecord.get("Phone"), "");

    info "Lead Name: " + leadName;
    info "Lead Company: " + leadCompany;

    // ==================== 2. Get Lead Full Data (with subform) ====================
    getResp = invokeurl
    [
        url: "https://www.zohoapis.com/crm/v8/Leads/" + leadId
        type: GET
        connection: "crm"
    ];

    info "Lead Full Data: " + getResp;

    // Parse subform data
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

    if(productInterestedLead.size() == 0)
    {
        return "No product information in this Lead, cannot create Quote";
    }

    // ==================== 3. Find or Create Customer in Books ====================
    // Use Company to match Customer in Books
    if(leadCompany == null || leadCompany == "")
    {
        return "No Company information in this Lead, cannot create Quote";
    }

    // Search for existing Customer
    searchCustomerUrl = "https://www.zohoapis.com/books/v3/contacts?organization_id=" + organizationId + "&contact_name=" + encodeUrl(leadCompany);

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
            info "Checking contact: " + contactName + " vs " + leadCompany;
            if(contactName == leadCompany)
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
        return "Customer '" + leadCompany + "' not found in Zoho Books. Please sync Customer first.";
    }

    // ==================== 4. Build Quote Line Items ====================
    lineItems = List();

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

    // ==================== 5. Create Quote (Estimate) ====================
    today = zoho.currentdate;
    todayStr = today.toString("yyyy-MM-dd");

    quoteData = Map();
    quoteData.put("customer_id", customerId);
    quoteData.put("date", todayStr);
    quoteData.put("line_items", lineItems);

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
