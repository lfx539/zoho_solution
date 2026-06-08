/*
 * Zoho Books - 获取采购订单详情（用于查找字段 API 名）
 */

Map getPurchaseOrderDetail()
{
    organizationId = "907988884";
    purchaseOrderId = "7849667000000140529";

    apiUrl = "https://www.zohoapis.com/books/v3/purchaseorders/" + purchaseOrderId + "?organization_id=" + organizationId;

    apiResponse = invokeurl
    [
        url : apiUrl
        type : GET
        connection : "books"
    ];

    return apiResponse;
}