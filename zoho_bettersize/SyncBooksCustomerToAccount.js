/**
 * 从 Zoho Books Customer 同步地址信息到 CRM Accounts
 *
 * 同步字段：
 * - billing_address.country -> Billing_Country_Name
 * - billing_address.state -> Billing_USA_State_Province
 * - shipping_address.country -> Shipping_Country_Name
 * - shipping_address.state -> Shipping_USA_State_Province
 *
 * 触发方式：Books Customer 编辑时触发（Workflow 或 Button）
 */

void SyncCustomerAddress(Map customer, Map organization, Map user)
{
    info "========== 同步 Books Customer 到 CRM Account ==========";

    organizationId = organization.get("organization_id");

    booksCustomerId = customer.get("contact_id");
    customerName = customer.get("contact_name");
    zcrmAccountId = customer.get("zcrm_account_id");

    info "Customer: " + customerName;
    info "CRM Account ID: " + zcrmAccountId;

    // 跳过没有关联 CRM Account 的 Customer
    if(zcrmAccountId == null || zcrmAccountId == "")
    {
        info "跳过：无关联的 CRM Account";
        return;
    }

    // 获取地址信息
    billingAddress = customer.get("billing_address");
    shippingAddress = customer.get("shipping_address");

    billingCountry = "";
    billingState = "";
    shippingCountry = "";
    shippingState = "";

    if(billingAddress != null)
    {
        billingCountry = ifnull(billingAddress.get("country"), "");
        billingState = ifnull(billingAddress.get("state"), "");
    }

    if(shippingAddress != null)
    {
        shippingCountry = ifnull(shippingAddress.get("country"), "");
        shippingState = ifnull(shippingAddress.get("state"), "");
    }

    info "Billing: " + billingCountry + "/" + billingState;
    info "Shipping: " + shippingCountry + "/" + shippingState;

    // 跳过没有任何地址信息的 Customer
    if(billingCountry == "" && billingState == "" && shippingCountry == "" && shippingState == "")
    {
        info "跳过：无地址信息";
        return;
    }

    // ========== 查找 CRM Lookup ID ==========
    billingCountryId = null;
    shippingCountryId = null;
    billingStateId = null;
    shippingStateId = null;

    // 查找 Billing Country
    if(billingCountry != "")
    {
        countrySearch = zoho.crm.searchRecords("CountryFilters", "(Name:equals:" + billingCountry + ")");
        if(countrySearch != null && countrySearch.size() > 0)
        {
            billingCountryId = countrySearch.get(0).get("id");
        }
    }

    // 查找 Shipping Country
    if(shippingCountry != "")
    {
        countrySearch = zoho.crm.searchRecords("CountryFilters", "(Name:equals:" + shippingCountry + ")");
        if(countrySearch != null && countrySearch.size() > 0)
        {
            shippingCountryId = countrySearch.get(0).get("id");
        }
    }

    // 查找 Billing State
    if(billingState != "")
    {
        stateSearch = zoho.crm.searchRecords("State", "(Name:equals:" + billingState + ")");
        if(stateSearch != null && stateSearch.size() > 0)
        {
            billingStateId = stateSearch.get(0).get("id");
        }
    }

    // 查找 Shipping State
    if(shippingState != "")
    {
        stateSearch = zoho.crm.searchRecords("State", "(Name:equals:" + shippingState + ")");
        if(stateSearch != null && stateSearch.size() > 0)
        {
            shippingStateId = stateSearch.get(0).get("id");
        }
    }

    // 构建更新数据
    updateData = Map();

    if(billingCountryId != null)
    {
        updateData.put("Billing_Country_Name", billingCountryId);
    }

    if(shippingCountryId != null)
    {
        updateData.put("Shipping_Country_Name", shippingCountryId);
    }

    if(billingStateId != null)
    {
        updateData.put("Billing_USA_State_Province", billingStateId);
    }

    if(shippingStateId != null)
    {
        updateData.put("Shipping_USA_State_Province", shippingStateId);
    }

    if(updateData.size() == 0)
    {
        info "跳过：未找到匹配的 Lookup 值";
        return;
    }

    // 更新 CRM Account
    updateResult = zoho.crm.updateRecord("Accounts", zcrmAccountId, updateData);

    info "更新结果: " + updateResult;

    if(updateResult != null && updateResult.get("code") == "SUCCESS")
    {
        info "更新成功：CRM Account 已同步";
    }
    else
    {
        info "更新失败：" + updateResult;
    }
}
