string standalone.SetHeaders(String method,String url,Bool needDetail)
{
accountId = "6508945";
consumerKey = "7b410c1176fdfcc04725451411ae0d7f00c768c83df18f22d0ac79c8fce21e20";
consumerSecret = "66c61e88b098cff3c57b017941d95f7b0c960ce63b2bd87e8f4297450b6debe4";
tokenId = "1e9a14837a7f741de05bbe64dadb3582386a53f1308d8bfe303f5f6025315658";
tokenSecret = "acd66a2a65839cd907829252c7f846599e5be58c1d6a921cef272a87e4ade115";
time = (now.toString().unixEpoch() / 1000).toString();
//query有顺序，不要改
query = {"oauth_consumer_key":consumerKey,"oauth_nonce":"Z8QPaT0meqn","oauth_signature_method":"HMAC-SHA256","oauth_timestamp":time,"oauth_token":tokenId,"oauth_version":"1.0"};
if(needDetail)
{
	query.put("expandSubResources",true);
}
queryString = "";
keys = query.keys().sort();
for each  key in keys
{
	queryString = queryString + key + "=" + encodeURL(query.get(key)) + "&";
}
queryString = queryString.removeLastOccurence("&");
baseUrl = method + "&" + encodeURL(url) + "&" + encodeURL(queryString);
signatureKey = consumerSecret + "&" + tokenSecret;
signatrue = zoho.encryption.hmacsha256(signatureKey,baseUrl,"base64");
oauth_signature = encodeURL(signatrue);
Authorization = 'OAuth realm="' + accountId + '",oauth_consumer_key="' + consumerKey + '",oauth_token="' + tokenId + '",oauth_signature_method="HMAC-SHA256",oauth_timestamp="' + time + '",oauth_nonce="Z8QPaT0meqn",oauth_version="1.0",oauth_signature="' + oauth_signature + '"';
info Authorization;
return Authorization;
}