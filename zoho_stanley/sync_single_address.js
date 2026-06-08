/**
 * 同步单个 CustomerAddress 到 Account
 *
 * 触发时机：CustomerAddress 编辑时
 * 触发条件：Default_Shipping 或 Default_Billing 被勾选
 *
 * Workflow 配置：
 * - 模块：CustomerAddress
 * - 触发：Every time the record is edited
 * - 条件：Default_Shipping is true OR Default_Billing is true
 *
 * 字段映射：
 * CustomerAddress → Accounts
 * - Addr1 → Shipping_Street / Billing_Street
 * - City → Shipping_City / Billing_City
 * - State → Shipping_State / Billing_State
 * - Zip → Shipping_Code / Billing_Code
 * - Country → Shipping_Country / Billing_Country
 */

void automation.syncSingleCustomerAddress(String customerAddressId)
{
    addressRecord = zoho.crm.getRecordById("CustomerAddress", customerAddressId);
    info "CustomerAddress Record: " + addressRecord;

    // 获取关联的 Account
    accountField = addressRecord.get("Accounts");
    if(accountField == null)
    {
        info "No Account associated, skipping";
        return;
    }

    accountId = "";
    if(accountField.contains("id"))
    {
        accountId = accountField.get("id");
    }
    else
    {
        accountId = accountField;
    }

    if(accountId == null || accountId == "")
    {
        info "Account ID is null, skipping";
        return;
    }

    info "Account ID: " + accountId;

    // 获取地址字段
    addr1 = addressRecord.get("Addr1");
    city = addressRecord.get("City");
    state = addressRecord.get("State");
    zip = addressRecord.get("Zip");
    country = addressRecord.get("Country");

    defaultShipping = addressRecord.get("Default_Shipping");
    defaultBilling = addressRecord.get("Default_Billing");

    info "Addr1: " + addr1 + ", City: " + city + ", State: " + state + ", Zip: " + zip + ", Country: " + country;
    info "Default Shipping: " + defaultShipping;
    info "Default Billing: " + defaultBilling;

    // 更新 Account
    updateData = Map();

    if(defaultShipping == true || defaultShipping == "true")
    {
        if(addr1 != null)
        {
            updateData.put("Shipping_Street", addr1);
        }
        if(city != null)
        {
            updateData.put("Shipping_City", city);
        }
        if(state != null)
        {
            updateData.put("Shipping_State", state);
        }
        if(zip != null)
        {
            updateData.put("Shipping_Code", zip);
        }
        if(country != null)
        {
            updateData.put("Shipping_Country", country);
        }
        info "Will update Shipping address";
    }

    if(defaultBilling == true || defaultBilling == "true")
    {
        if(addr1 != null)
        {
            updateData.put("Billing_Street", addr1);
        }
        if(city != null)
        {
            updateData.put("Billing_City", city);
        }
        if(state != null)
        {
            updateData.put("Billing_State", state);
        }
        if(zip != null)
        {
            updateData.put("Billing_Code", zip);
        }
        if(country != null)
        {
            updateData.put("Billing_Country", country);
        }
        info "Will update Billing address";
    }

    if(updateData.size() > 0)
    {
        updateResult = zoho.crm.updateRecord("Accounts", accountId, updateData);
        info "Updated Account " + accountId + ": " + updateResult;
    }
    else
    {
        info "No default address selected, skipping update";
    }
}
