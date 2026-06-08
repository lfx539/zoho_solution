/**
 * 解析地址字符串（辅助函数）
 *
 * 输入：Address_Info 单行文本（空格分隔）
 * 输出：JSON 字符串，包含 street, city, state, code, country
 *
 * 地址格式示例：
 * "Vijaykumar Vara Mausmi Vara Photography 49 Marlborough Road BERWICK VIC 3806 Australia"
 */

string standalone.parseAddress(String addressInfo)
{
    street = "";
    city = "";
    state = "";
    code = "";
    country = "";

    if(addressInfo != null && addressInfo != "")
    {
        // 按空格分割
        parts = addressInfo.toList(" ");

        if(parts != null && parts.size() >= 4)
        {
            totalParts = parts.size();

            // 最后一个 = 国家
            country = parts.get(totalParts - 1);

            // 倒数第二个 = 邮编（4位数字）
            codeCandidate = parts.get(totalParts - 2);
            // 用更简单的方式检查是否是4位数字
            codeLen = codeCandidate.length();
            if(codeLen == 4)
            {
                isAllDigit = true;
                for each c in codeCandidate.toList("")
                {
                    if(c != "" && c != "0" && c != "1" && c != "2" && c != "3" && c != "4" && c != "5" && c != "6" && c != "7" && c != "8" && c != "9")
                    {
                        isAllDigit = false;
                    }
                }
                if(isAllDigit)
                {
                    code = codeCandidate;
                }
            }

            // 倒数第三个 = 州
            stateCandidate = parts.get(totalParts - 3);
            if(stateCandidate == "VIC" || stateCandidate == "NSW" || stateCandidate == "QLD" || stateCandidate == "WA" || stateCandidate == "SA" || stateCandidate == "TAS" || stateCandidate == "ACT" || stateCandidate == "NT")
            {
                state = stateCandidate;
            }

            // 倒数第四个 = 城市
            if(totalParts >= 4 && state != "")
            {
                city = parts.get(totalParts - 4);
            }

            // 前面部分 = 街道地址
            // 策略：从第一个包含数字的部分开始，收集所有内容作为街道
            if(totalParts >= 5 && state != "" && code != "")
            {
                streetParts = List();
                foundNumber = false;
                idx = 0;

                for each part in parts
                {
                    // 跳过最后4个部分（城市、州、邮编、国家）
                    if(idx >= totalParts - 4)
                    {
                        break;
                    }

                    // 检查是否包含数字
                    hasDigit = part.contains("0") || part.contains("1") || part.contains("2") || part.contains("3") || part.contains("4") || part.contains("5") || part.contains("6") || part.contains("7") || part.contains("8") || part.contains("9");

                    if(hasDigit)
                    {
                        foundNumber = true;
                    }

                    // 从第一个包含数字的部分开始收集
                    if(foundNumber)
                    {
                        streetParts.add(part);
                    }

                    idx = idx + 1;
                }

                if(streetParts.size() > 0)
                {
                    street = streetParts.toString(" ");
                }
            }
        }
    }

    // 构建 JSON 字符串
    jsonStr = "{\"street\":\"" + street + "\",\"city\":\"" + city + "\",\"state\":\"" + state + "\",\"code\":\"" + code + "\",\"country\":\"" + country + "\"}";

    return jsonStr;
}
