string standalone.EncodeQForOAuth(String qStr)
{
if(qStr == null || qStr == "")
{
	return "";
}
// 空格 -> %20，双引号 -> %22，/ -> %2F（与 Postman/NetSuite 一致，不用 encodeURL 的 + 空格）
encoded = qStr.replaceAll(" ","%20").replaceAll("\"","%22").replaceAll("/","%2F");
return encoded;
}