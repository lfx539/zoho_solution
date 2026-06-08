<%{%>
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
<%}%>

<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>选择采购产品</title>
<style>
* { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
body { background: #f5f7fa; padding: 20px; margin: 0; }
.container { max-width: 900px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 24px; }
h2 { color: #333; margin-bottom: 8px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
th { background: #f8f9fa; font-weight: 600; }
.checkbox-cell { width: 50px; text-align: center; }
.btn { padding: 10px 24px; border: none; border-radius: 4px; cursor: pointer; }
.btn-primary { background: #0066cc; color: #fff; }
.btn-secondary { background: #e0e0e0; color: #333; margin-right: 8px; }
</style>
</head>
<body>
<div class="container">
<h2>选择要采购的产品</h2>
<p>商机：<%= dealName %></p>

<%{%>
if(productInterestedList != null && productInterestedList.size() > 0)
{
<%}%>

<table>
<thead><tr>
<th class="checkbox-cell">选择</th>
<th>产品名称</th>
<th>数量</th>
<th>单价</th>
</tr></thead>
<tbody>

<%{%>
for each item in productInterestedList
{
	productId = item.get("id");
	productName = "";
	productField = item.get("field3");
	if(productField != null && productField.get("name") != null)
	{
		productName = productField.get("name");
	}
<%}%>

<tr>
<td class="checkbox-cell"><input type="checkbox" name="product" value="<%= productId %>"></td>
<td><%= productName %></td>
<td><%= ifnull(item.get("Quantity"), "") %></td>
<td><%= ifnull(item.get("Unit_Price"), "") %></td>
</tr>

<%{%>
}
<%}%>

</tbody>
</table>

<div style="text-align:right">
<button type="button" class="btn btn-secondary" onclick="window.close()">取消</button>
<button type="button" class="btn btn-primary" onclick="submitSelection()">确认采购</button>
</div>

<script>
function submitSelection() {
	var checkboxes = document.querySelectorAll('input[name="product"]:checked');
	if (checkboxes.length === 0) { alert('请至少选择一个产品'); return; }
	var selectedIds = [];
	checkboxes.forEach(function(cb) { selectedIds.push(cb.value); });
	alert('选中了: ' + selectedIds.join(','));
}
</script>

<%{%>
}
else
{
<%}%>

<p>该商机暂无感兴趣的产品信息</p>

<%{%>
}
<%}%>

</div>
</body>
</html>
