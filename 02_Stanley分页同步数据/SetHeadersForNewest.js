string standalone.SetHeadersForNewest(String method,String url,Bool needDetail,Int limit,Int offset,String qStr)
{
accountId = "6508945";
consumerKey = "7b410c1176fdfcc04725451411ae0d7f00c768c83df18f22d0ac79c8fce21e20";
consumerSecret = "66c61e88b098cff3c57b017941d95f7b0c960ce63b2bd87e8f4297450b6debe4";
tokenId = "7ea966b4d42b282a269b3eb56a8a6e030d14ca067831990a0b7b5817de1918c7";
tokenSecret = "90f716a0291e28c9bd24e4e46b548be95105113d4bf946b11531124683d4fc96";
time = (now.toString().unixEpoch() / 1000).toString();
// query有顺序，不要改（与 SetListHeaders 一致）
query = {"oauth_consumer_key":consumerKey,"oauth_nonce":"Z8QPaT0meqn","oauth_signature_method":"HMAC-SHA256","oauth_timestamp":time,"oauth_token":tokenId,"oauth_version":"1.0"};
if(needDetail)
{
	query.put({"limit":limit,"offset":offset,"q":qStr});
}
queryString = "";
keys = query.keys().sort();
for each  key in keys
{
	// q 用与 Postman 一致的百分号编码，避免 encodeURL 对空格/引号处理不同导致 401
	if(key == "q")
	{
		queryString = queryString + key + "=" + standalone.EncodeQForOAuth(query.get(key)) + "&";
	}
	else
	{
		queryString = queryString + key + "=" + encodeURL(query.get(key)) + "&";
	}
}
queryString = queryString.removeLastOccurence("&");
// info queryString;
baseUrl = method + "&" + encodeURL(url) + "&" + encodeURL(queryString);
signatureKey = consumerSecret + "&" + tokenSecret;
signatrue = zoho.encryption.hmacsha256(signatureKey,baseUrl,"base64");
oauth_signature = encodeURL(signatrue);
Authorization = 'OAuth realm="' + accountId + '",oauth_consumer_key="' + consumerKey + '",oauth_token="' + tokenId + '",oauth_signature_method="HMAC-SHA256",oauth_timestamp="' + time + '",oauth_nonce="Z8QPaT0meqn",oauth_version="1.0",oauth_signature="' + oauth_signature + '"';
info Authorization;
return Authorization;
}