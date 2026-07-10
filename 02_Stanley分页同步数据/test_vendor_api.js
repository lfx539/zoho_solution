void schedule.TestVendorAPI()
{
baseUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/vendor";
limit = 10;

// 测试：不使用 EncodeQForOAuth，直接构建查询字符串
info "=== 测试：直接使用查询字符串（不过度编码）===";
fromDate = "22/06/2026";
qStr = 'dateCreated ON_OR_AFTER "' + fromDate + '"';
info ("查询: " + qStr);

// 方案1: 使用空格（Postman 方式）
qUrl1 = "dateCreated ON_OR_AFTER \"" + fromDate + "\"";
info ("方案1 URL 参数: " + qUrl1);

auth = standalone.SetHeadersForNewest("GET",baseUrl,true,limit,0,qStr);
headers = {"Content-Type":"application/json","Authorization":auth};
resp = invokeurl
[
	url :baseUrl + "?limit=" + limit + "&offset=0&q=" + qUrl1
	type :GET
	headers:headers
];

if(resp != null)
{
	info "✅ HTTP 请求成功";
	listData = resp.getFileContent().toJSONList().get(0);
	items = listData.get("items");
	if(items != null)
	{
		info ("✅ 获取到 " + items.size() + " 条数据");
	}
	else
	{
		info "items 为空";
	}
}
else
{
	info "❌ HTTP 请求失败";
}
}
