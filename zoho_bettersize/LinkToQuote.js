string button.LinkToQuote()
{
organizationId = "891257442";
// 直接打开 Zoho Books 新建报价单页面
booksUrl = "https://books.zoho.com/app/" + organizationId + "#/quotes/new";
openUrl(booksUrl,"new window");
return "";
}