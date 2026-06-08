/**
 * Books Workflow - Auto Set Quote Expiry Date
 *
 * Trigger: Zoho Books Workflow on Quote (Estimate) creation
 *
 * Function: Set Expiry Date to today + 60 days
 *
 * Parameters:
 *   - estimate: Estimate data from Workflow
 *   - organization: Organization info from Workflow
 *   - user: User info from Workflow
 */

void workflow.setQuoteExpiryDate(Map estimate, Map organization, Map user)
{
    info "========== Start setting Quote Expiry Date ==========";

    // Get estimate_id from estimate Map
    estimateId = estimate.get("estimate_id");
    info "Estimate ID: " + estimateId;

    // Get organization_id from organization Map
    organizationId = organization.get("organization_id");
    info "Organization ID: " + organizationId;

    // Get creation date from estimate
    creationDateStr = estimate.get("date");
    info "Creation Date: " + creationDateStr;

    // Calculate expiry date (creation date + 60 days)
    if(creationDateStr != null && creationDateStr != "")
    {
        creationDate = creationDateStr.toDate("yyyy-MM-dd");
        expiryDate = creationDate.addDay(60);
    }
    else
    {
        // Fallback to today if creation date not found
        expiryDate = zoho.currentdate.addDay(60);
    }
    expiryDateStr = expiryDate.toString("yyyy-MM-dd");

    info "Expiry Date: " + expiryDateStr;

    // Update Estimate with expiry date
    updateData = Map();
    updateData.put("expiry_date", expiryDateStr);

    updateUrl = "https://www.zohoapis.com/books/v3/estimates/" + estimateId + "?organization_id=" + organizationId;

    updateResp = invokeurl
    [
        url: updateUrl
        type: PUT
        parameters: updateData.toString()
        connection: "books"
    ];

    info "Update Response: " + updateResp;

    if(updateResp != null && updateResp.get("code") == 0)
    {
        info "Successfully set Expiry Date to " + expiryDateStr;
    }
    else
    {
        errorMsg = "Failed to set Expiry Date";
        if(updateResp != null && updateResp.get("message") != null)
        {
            errorMsg = errorMsg + " - " + updateResp.get("message");
        }
        info errorMsg;
    }

    info "========== End setting Quote Expiry Date ==========";
}
