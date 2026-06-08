/**
 * Deal Button - Open Related Quotes in Zoho Books
 *
 * 功能：在 Zoho Books 中打开所有关联当前 Deal 的 Quotes
 *
 * 原理：
 * - Books Quote 有 cf_related_deal 字段关联 CRM Deal
 * - 通过 Books URL 搜索参数过滤显示相关 Quotes
 *
 * 使用方式：
 * - 在 Deal 模块添加按钮，调用此函数
 *
 * Parameter: dealId - Deal ID
 */

string button.OpenRelatedQuotes(string dealId)
{
    info "========== Open Related Quotes ==========";
    info "Deal ID: " + dealId;

    organizationId = "920286948";  // bettersize Books organization_id

    // 获取 Deal Name 用于搜索
    dealRecord = zoho.crm.getRecordById("Deals", dealId);
    dealName = "";
    if(dealRecord != null)
    {
        dealName = ifnull(dealRecord.get("Deal_Name"), "");
    }

    info "Deal Name: " + dealName;

    if(dealName == null || dealName == "")
    {
        return "Cannot find Deal Name";
    }

    // 构建 Books 搜索 URL
    // search_criteria 格式: {"search_text":"Deal Name"}
    searchCriteria = "{\"search_text\":\"" + dealName + "\"}";
    encodedSearchCriteria = encodeUrl(searchCriteria);

    booksSearchUrl = "https://books.zoho.com/app/" + organizationId + "#/quotes?filter_by=Status.All&per_page=25&search_criteria=" + encodedSearchCriteria + "&sort_column=created_time&sort_order=D";

    info "Opening Books URL: " + booksSearchUrl;

    // 打开 Books Quotes 页面
    openUrl(booksSearchUrl, "new window");

    return "Opening related quotes for: " + dealName;
}
