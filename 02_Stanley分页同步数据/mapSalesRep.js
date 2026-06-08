string standalone.mapSalesRep(String name)
{
info name;
if(name == null || name.trim() == "")
{
	return "";
}
// 从 NetSuite 名称提取关键部分（按空格拆分，用于模糊匹配）
nameTrim = name.trim();
parts = nameTrim.toList(" ");
keywords = List();
for each  p in parts
{
	if(p != null && p.trim() != "")
	{
		keywords.add(p.trim().toLowerCase());
	}
}
if(keywords.size() == 0)
{
	return "";
}
// 获取 CRM 用户列表
resp = invokeurl
[
	url :"https://www.zohoapis.com.au/crm/v8/users?type=AllUsers&per_page=200"
	type :GET
	connection:"crm"
];
if(resp == null)
{
	return "";
}
data = null;
users = resp.get("users");
if(users != null && users.size() > 0)
{
	data = resp;
}
else
{
	body = resp.get("responseText");
	if(body == null || body == "")
	{
		body = resp.get("body");
	}
	if(body != null && body != "")
	{
		data = body.toMap();
		if(data != null)
		{
			users = data.get("users");
		}
	}
}
if(users == null || users.size() == 0)
{
	return "";
}
if(users == null || users.size() == 0)
{
	return "";
}
// 模糊匹配：CRM 用户名称（忽略大小写）需包含 NetSuite 名称的所有关键部分
for each  user in users
{
	fullName = user.get("full_name");
	if(fullName == null || fullName == "")
	{
		continue;
	}
	fullNameLower = fullName.trim().toLowerCase();
	allMatch = true;
	for each  kw in keywords
	{
		if(fullNameLower.indexOf(kw) < 0)
		{
			allMatch = false;
			break;
		}
	}
	if(allMatch == true)
	{
		userId = user.get("id");
		if(userId != null && userId != "")
		{
			return userId;
		}
	}
}
return "";
}