// 获取数据
dealIdStr = "6849105000001821017";
dealName = "Test0325";
dealId = dealIdStr.toLong();

getResp = invokeurl
[
	url: "https://www.zohoapis.com/crm/v8/Deals/" + dealId
	type: GET
	connection: "crm"
];

productInterestedList = List();
if(getResp != null && getResp.get("data") != null && getResp.get("data").size() > 0)
{
	dealData = getResp.get("data").get(0);
	productInterestedRaw = dealData.get("Product_Interested");

	if(productInterestedRaw != null)
	{
		try
		{
			testItem = productInterestedRaw.get(0);
			productInterestedList = productInterestedRaw;
		}
		catch (e)
		{
			tempList = List();
			tempList.add(productInterestedRaw);
			productInterestedList = tempList;
		}
	}
}

// 构建 HTML
html = "<html><head><meta charset='UTF-8'>";
html = html + "<title>选择采购产品</title>";
html = html + "<style>";
html = html + "body { font-family: sans-serif; padding: 20px; }";
html = html + "table { border-collapse: collapse; width: 100%; }";
html = html + "th, td { border: 1px solid #ddd; padding: 8px; }";
html = html + "th { background: #f5f5f5; }";
html = html + "</style></head><body>";
html = html + "<h2>选择要采购的产品</h2>";
html = html + "<p>商机：" + dealName + "</p>";

if(productInterestedList != null && productInterestedList.size() > 0)
{
	html = html + "<table>";
	html = html + "<tr><th>选择</th><th>产品名称</th></tr>";

	for each item in productInterestedList
	{
		productId = item.get("id");
		productName = "";
		productField = item.get("field3");
		if(productField != null && productField.get("name") != null)
		{
			productName = productField.get("name");
		}
		html = html + "<tr>";
		html = html + "<td><input type='checkbox' name='product' value='" + productId + "'></td>";
		html = html + "<td>" + productName + "</td>";
		html = html + "</tr>";
	}

	html = html + "</table>";
	html = html + "<button onclick='alert(\"选中产品\")'>确认采购</button>";
}
else
{
	html = html + "<p>该商机暂无感兴趣的产品信息</p>";
}

html = html + "</body></html>";

// 直接输出
html
