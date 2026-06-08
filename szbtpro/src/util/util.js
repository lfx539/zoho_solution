const ZOHO = window.ZOHO;
// const API_URL = 'https://www.zohoapis.com';

export async function getCrmRecordFromSql(sql) {
  let req_data = {
    parameters: {
      select_query: `${sql}`,
    },
    headers: {},
    method: "POST",
    url: `https://www.zohoapis.com/crm/v6/coql`,
    param_type: 2,
  };
  let contact = await ZOHO.CRM.CONNECTION.invoke("crm", req_data);
  // console.log(contact);
  return contact?.details?.statusMessage?.data || [];
}
export async function getglobal_picklists() {
  let req_data = {
    headers: {},
    method: "GET",
    url: `https://www.zohoapis.com/crm/v7/settings/global_picklists`,
    param_type: 2,
  };
  let contact = await ZOHO.CRM.CONNECTION.invoke("crm", req_data);
  console.log("contact", contact);
  return contact.details.statusMessage.data;
}
export async function getCrmRecordFromSqlReturnAll(sql) {
  let req_data = {
    parameters: {
      select_query: `${sql}`,
    },
    headers: {},
    method: "POST",
    url: `https://www.zohoapis.com/crm/v6/coql`,
    param_type: 2,
  };
  let contact = await ZOHO.CRM.CONNECTION.invoke("crm", req_data);
  return contact;
}

export async function getCrmvariables(variable_id) {
  let req_data = {
    headers: {},
    method: "GET",
    url: `https://www.zohoapis.com/crm/v6/settings/variables/${variable_id}`,
    param_type: 2,
  };
  let contact = await ZOHO.CRM.CONNECTION.invoke("crm", req_data);
  return contact;
}

export async function usersql(sql) {
  let config = {
    select_query: sql,
  };
  let result = await window.ZOHO.CRM.API.coql(config);

  if (Array.isArray(result.data)) {
    return result.data;
  } else {
    return [];
  }
}

export async function usersqlalldata(sql, maxLimit = 2000) {
  const allData = [];
  const pageSize = 100; // 每页查询条数
  let offset = 0;

  while (true) {
    try {
      // 构造带偏移量的查询
      const query = `${sql} LIMIT ${pageSize} OFFSET ${offset}`;
      const config = { select_query: query };
      const result = await window.ZOHO.CRM.API.coql(config);

      // console.log("Result:", result);

      // 验证结果有效性
      if (result && Array.isArray(result.data)) {
        allData.push(...result.data); // 合并数据

        // 检查是否超出最大限制
        if (allData.length >= maxLimit) {
          // console.log("达到数据上限，停止查询");
          break;
        }
      } else {
        // console.warn("无效的查询结果，停止查询");
        break;
      }

      // 检查分页终止条件
      if (
        result.data.length < pageSize || // 当前页数据不足
        !result.info.more_records // 没有更多记录
      ) {
        // console.log("数据查询完成");
        break;
      }

      // 更新偏移量，查询下一页
      offset += pageSize;
    } catch (error) {
      console.error("查询过程中发生错误:", error);
      break; // 如果发生异常，退出循环
    }
  }

  // 返回数据，限制在 maxLimit 条
  return allData;
}

export async function getCrmRecordFromSqlMoreLimit(sql) {
  let allRecords = []; // 存储所有记录的数组
  let start = 0; // 起始位置
  const limit = 2000; // 每次查询的数据量
  let moreRecords = true; // 是否还有更多记录的标志

  while (moreRecords) {
    // 构造请求数据
    let req_data = {
      parameters: {
        select_query: `${sql} LIMIT ${start}, ${limit}`,
      },
      headers: {},
      method: "POST",
      url: `https://www.zohoapis.com/crm/v6/coql`,
      param_type: 2,
    };
    // 调用 Zoho CRM API 获取数据
    let contact = await ZOHO.CRM.CONNECTION.invoke("crm", req_data);
    // console.log("contact", contact);
    // 检查是否成功获取到数据
    if (contact?.details?.statusMessage?.data) {
      // 将当前页的数据添加到 allRecords 数组中
      allRecords.push(...contact.details.statusMessage.data);

      // 检查是否有更多记录
      moreRecords = contact?.details?.statusMessage?.info.more_records;

      // 如果有更多记录，则更新起始位置继续查询下一批数据
      if (moreRecords) {
        start += limit;
      }
    } else {
      moreRecords = false; // 如果没有获取到数据，则停止查询
    }
  }

  return allRecords;
}

export async function getCrmRecordFromSqlAllDataByIn(sqlstr, arrar) {
  const chunkArray = (arr, chunkSize) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
      chunks.push(arr.slice(i, i + chunkSize));
    }
    return chunks;
  };

  const chunks = chunkArray(arrar, 50);
  const results = [];

  for (const chunk of chunks) {
    const strs = chunk.map((item) => `'${item}'`).join(",");
    const sql = `${sqlstr} in (${strs})`;

    let req_data = {
      parameters: {
        select_query: `${sql} limit 2000`,
      },
      headers: {},
      method: "POST",
      url: `https://www.zohoapis.com/crm/v6/coql`,
      param_type: 2,
    };

    try {
      let contact = await ZOHO.CRM.CONNECTION.invoke("crm", req_data);
      console.log("contact", contact);

      if (
        contact.details.status === "success" &&
        contact.details.statusMessage &&
        contact.details.statusMessage.data
      ) {
        results.push(...contact.details.statusMessage.data);
      } else {
        console.warn(`No data returned for chunk: ${JSON.stringify(chunk)}`);
      }
    } catch (error) {
      console.error(
        `Error fetching data for chunk: ${JSON.stringify(chunk)}`,
        error
      );
    }
  }

  return results;
}

export async function getfields(moduleName) {
  let req_data = {
    parameters: {},
    headers: {},
    method: "GET",
    url: `https://www.zohoapis.com/crm/v7/settings/fields?module=${moduleName}`,
    param_type: 2,
  };
  let contact = await ZOHO.CRM.CONNECTION.invoke("crm", req_data);
  return contact;
}

export async function putdata(moduleName, jsondata) {
  let req_data = {
    parameters: jsondata,
    headers: {},
    method: "PUT",
    url: `https://www.zohoapis.com/crm/v6/${moduleName}`,
    param_type: 2,
  };
  let contact = await ZOHO.CRM.CONNECTION.invoke("crm", req_data);
  return contact;
}
export async function upsertdata(moduleName, jsondata) {
  let req_data = {
    parameters: jsondata,
    headers: {},
    method: "POST",
    url: `https://www.zohoapis.com/crm/v7/${moduleName}`,
    param_type: 2,
  };
  let contact = await ZOHO.CRM.CONNECTION.invoke("crm", req_data);
  return contact;
}
export async function getCrmRecordById(moduleName, id) {
  let req_data = {
    parameters: {},
    headers: {},
    method: "GET",
    url: `https://www.zohoapis.com/crm/v6/${moduleName}/${id}`,
    param_type: 2,
  };
  let contact = await ZOHO.CRM.CONNECTION.invoke("crm", req_data);
  // console.log("contact", contact);
  return contact.details.statusMessage.data[0];
}
//https://crm.zoho.com.cn/crm/v2.2/settings/global_picklists?
export async function getCrmSettingsRecordById(moduleName, id) {
  let req_data = {
    parameters: {},
    headers: {},
    method: "GET",
    url: `https://www.zohoapis.com/crm/v6/settings/${moduleName}/${id}?include=used_in_modules&include_inner_details=used_in_modules.plural_label`,
    param_type: 2,
  };
  console.log(req_data);
  let contact = await ZOHO.CRM.CONNECTION.invoke("crm", req_data);
  console.log("contact", contact);
  return contact;
}

export async function getCrmMailmergeById(moduleName, dataid, templateid) {
  let req_data = {
    method: "GET",
    headers: { "Content-Type": "application/pdf; charset=utf-8" },
    url: `https://zohoapis.com.cn/crm/v2/${moduleName}/${dataid}/actions/print_preview?type=mailmerge&template_id=${templateid}`,
    param_type: 1,
  };
  let response = await ZOHO.CRM.CONNECTION.invoke("crm", req_data);
  return response;
}


export async function getCrmMailmergeList(moduleName) {
  let req_data = {
    method: "GET",
    url: `https://www.zohoapis.com/crm/v2/settings/templates?type=mailmerge&module=${moduleName}`,
    param_type: 2,
  };
  let response = await ZOHO.CRM.CONNECTION.invoke("crm", req_data);
  return response;
}

export async function getCrmFile(fileid) {
  let req_data = {
    method: "GET",
    headers: { "Content-Type": "application/pdf; charset=utf-8" },
    url: `https://www.zohoapis.com/crm/v5/files?id=${fileid}`,
    param_type: 2,
  };
  let response = await ZOHO.CRM.CONNECTION.invoke("crm", req_data);
  console.log(typeof response);
  return response;
}
export function isBlank(str) {
  return str === undefined || str === null || str === "";
}

export function groupBy(array, keys, groupName) {
  return Object.entries(
    array.reduce((acc, item) => {
      const groupKey = keys
        .map((key) =>
          key.split(".").reduce((obj, prop) => obj && obj[prop], item)
        )
        .join("_");

      if (!acc[groupKey]) {
        acc[groupKey] = { [groupName]: [] };
      }
      acc[groupKey][groupName].push(item);
      return acc;
    }, {})
  ).map(([key, value]) => ({
    [groupName]: value[groupName],
  }));
}

export function groupByAndSum(data, groupByFields, sumFields) {
  return data.map((declaration) => {
    const grouped = declaration.DeclarationSubfrom.reduce((result, current) => {
      const groupKey = groupByFields.map((field) => current[field]).join("|");
      if (!result[groupKey]) {
        result[groupKey] = {};
        groupByFields.forEach((field) => {
          result[groupKey][field] = current[field];
        });


        result[groupKey]["DeclarationcontractNo"] = current?.DeclarationcontractNo;

        sumFields.forEach((field) => {
          result[groupKey][field] = current[field] || 0;
        });
      } else {
        sumFields.forEach((field) => {
          result[groupKey][field] += current[field] || 0;
          // result[groupKey][field] = parseFloat(result[groupKey][field].toFixed(3)); // 四舍五入到三位小数
        });
      }
      return result;
    }, {});

    const DeclarationSubfrom = Object.values(grouped);

    // 计算总和字段并四舍五入
    const totalSum = {};
    sumFields.forEach((field) => {
      totalSum[field + "_sum"] = DeclarationSubfrom.reduce(
        (sum, item) => sum + item[field],
        0
      );
      // 四舍五入到两位小数
      // totalSum[field + "_sum"] = totalSum[field + "_sum"]? totalSum[field + "_sum"].toFixed(3): 0;
    });

    return {
      DeclarationSubfrom,
      ...totalSum,
    };
  });
}

export function numberToEnglish(number) {
  const units = [
    "",
    "ONE",
    "TWO",
    "THREE",
    "FOUR",
    "FIVE",
    "SIX",
    "SEVEN",
    "EIGHT",
    "NINE",
  ];
  const teens = [
    "TEN",
    "ELEVEN",
    "TWELVE",
    "THIRTEEN",
    "FOURTEEN",
    "FIFTEEN",
    "SIXTEEN",
    "SEVENTEEN",
    "EIGHTEEN",
    "NINETEEN",
  ];
  const tens = [
    "",
    "",
    "TWENTY",
    "THIRTY",
    "FORTY",
    "FIFTY",
    "SIXTY",
    "SEVENTY",
    "EIGHTY",
    "NINETY",
  ];

  function convertHundreds(num) {
    if (num === 0) return "";

    if (num < 10) return units[num];

    if (num < 20) return teens[num - 10];

    if (num < 100) {
      const tenDigit = Math.floor(num / 10);
      const unitDigit = num % 10;

      if (unitDigit === 0) return tens[tenDigit];

      return tens[tenDigit] + " " + units[unitDigit];
    }

    const hundredDigit = Math.floor(num / 100);
    const remainder = num % 100;

    if (remainder === 0) return units[hundredDigit] + " HUNDRED";

    return units[hundredDigit] + " HUNDRED AND " + convertHundreds(remainder);
  }

  function convertWholeNumber(num) {
    if (num === 0) return "ZERO";

    const billions = Math.floor(num / 1000000000);
    const millions = Math.floor((num % 1000000000) / 1000000);
    const thousands = Math.floor((num % 1000000) / 1000);
    const remainder = num % 1000;

    let result = "";

    if (billions) result += convertHundreds(billions) + " BILLION ";
    if (millions) result += convertHundreds(millions) + " MILLION ";
    if (thousands) result += convertHundreds(thousands) + " THOUSAND ";
    if (remainder) result += convertHundreds(remainder);

    return result.trim();
  }

  
  // 处理金额转换
  const amount = parseFloat(number).toFixed(2);
  const [dollars, cents] = amount.split(".");

  let result = convertWholeNumber(parseInt(dollars));

  if (parseInt(cents) > 0) {
    result += " AND " + convertHundreds(parseInt(cents)) + " CENTS";
  }

  return result.trim().toUpperCase() + " ONLY"; // Return the final result
}

export async function  getAllOtherApprovalsData() {
  let allData = [];
  let page = 1;

  // 创建一个循环，直到没有更多记录
  while (true) {
    let req_data = {
      "parameters": {},
      "headers": {},
      "method": "GET",
      "url": `https://crm.zoho.com.cn/crm/v2/Approvals?type=others_awaiting&page=${page}`,
      "param_type": 2,
    };

    // 获取当前页面数据
    let result = await window.ZOHO.CRM.CONNECTION.invoke("crm", req_data);

    if (result?.code === "SUCCESS" && Array.isArray(result?.details?.statusMessage?.data) && result.details.statusMessage.data.length > 0) {
      const data = result.details.statusMessage.data;
      allData = [...allData, ...data];  // 合并数据

      // 检查是否有更多数据
      const moreRecords = result?.details?.statusMessage?.info?.more_records || false;
      if (!moreRecords) {
        break; // 如果没有更多数据，则跳出循环
      }

      // 如果有更多数据，继续获取下一页
      page++;
    } else {
      // console.error("Failed to fetch data", result);
      break;
    }
  }

  return allData; // 返回所有获取到的数据
}
export async function  getAllMyApprovalsData() {
  let allData = [];
  let page = 1;

  // 创建一个循环，直到没有更多记录
  while (true) {
    let req_data = {
      "parameters": {},
      "headers": {},
      "method": "GET",
      "url": `https://crm.zoho.com.cn/crm/v2/Approvals?type=awaiting&page=${page}`,
      "param_type": 2,
    };

    // 获取当前页面数据
    let result = await window.ZOHO.CRM.CONNECTION.invoke("crm", req_data);

    if (result?.code === "SUCCESS" && Array.isArray(result?.details?.statusMessage?.data) && result.details.statusMessage.data.length > 0) {
      const data = result.details.statusMessage.data;
      allData = [...allData, ...data];  // 合并数据

      // 检查是否有更多数据
      const moreRecords = result?.details?.statusMessage?.info?.more_records || false;
      if (!moreRecords) {
        break; // 如果没有更多数据，则跳出循环
      }

      // 如果有更多数据，继续获取下一页
      page++;
    } else {
      // console.error("Failed to fetch data", result);
      break;
    }
  }

  return allData; // 返回所有获取到的数据
}

export async function getCrmRecordFromSqlOfIn(sql, arrays) {
  const chunkSize = 50;  // 每次最多查询50条
  const results = [];  // 用于存放所有查询结果

  // 将数组分批处理，每批最多50个条件
  const chunkedArrays = [];
  for (let i = 0; i < arrays.length; i += chunkSize) {
    chunkedArrays.push(arrays.slice(i, i + chunkSize));
  }

  // 循环每一批数据，调用接口
  for (const chunk of chunkedArrays) {
    // 构建 SQL 查询语句，将条件数组部分替换为当前批次的条件
    const query = `${sql} in (${chunk.map(item => `'${item}'`).join(', ')})`;
    // console.log(query);
    let req_data = {
      parameters: {
        select_query: query,
      },
      headers: {},
      method: "POST",
      url: `https://www.zohoapis.com/crm/v6/coql`,
      param_type: 2,
    };

    // 调用 CRM 接口获取数据
    const contact = await ZOHO.CRM.CONNECTION.invoke("crm", req_data);
    // console.log("contact", contact);

    // 将返回的结果合并到 results 数组中
    if (contact && contact.details && contact.details.statusMessage) {
      results.push(...contact.details.statusMessage.data);
    }
  }

  // 返回合并后的所有结果
  return results;
}


export function numberToEnglish1(number) {
  const units = [
    "",
    "ONE",
    "TWO",
    "THREE",
    "FOUR",
    "FIVE",
    "SIX",
    "SEVEN",
    "EIGHT",
    "NINE",
  ];
  const teens = [
    "TEN",
    "ELEVEN",
    "TWELVE",
    "THIRTEEN",
    "FOURTEEN",
    "FIFTEEN",
    "SIXTEEN",
    "SEVENTEEN",
    "EIGHTEEN",
    "NINETEEN",
  ];
  const tens = [
    "",
    "",
    "TWENTY",
    "THIRTY",
    "FORTY",
    "FIFTY",
    "SIXTY",
    "SEVENTY",
    "EIGHTY",
    "NINETY",
  ];

  function convertHundreds(num) {
    if (num === 0) return "";

    if (num < 10) return units[num];

    if (num < 20) return teens[num - 10];

    if (num < 100) {
      const tenDigit = Math.floor(num / 10);
      const unitDigit = num % 10;

      if (unitDigit === 0) return tens[tenDigit];

      return tens[tenDigit] + " " + units[unitDigit];
    }

    const hundredDigit = Math.floor(num / 100);
    const remainder = num % 100;

    if (remainder === 0) return units[hundredDigit] + " HUNDRED";

    return units[hundredDigit] + " HUNDRED AND " + convertHundreds(remainder);
  }

  function convertWholeNumber(num) {
    if (num === 0) return "ZERO";

    const billions = Math.floor(num / 1000000000);
    const millions = Math.floor((num % 1000000000) / 1000000);
    const thousands = Math.floor((num % 1000000) / 1000);
    const remainder = num % 1000;

    let result = "";

    if (billions) result += convertHundreds(billions) + " BILLION ";
    if (millions) result += convertHundreds(millions) + " MILLION ";
    if (thousands) result += convertHundreds(thousands) + " THOUSAND ";
    if (remainder) result += convertHundreds(remainder);

    return result.trim();
  }

  
  // 处理金额转换
  const amount = parseFloat(number).toFixed(2);
  const [dollars, cents] = amount.split(".");

  let result = convertWholeNumber(parseInt(dollars));

  if (parseInt(cents) > 0) {
    result += " AND " + convertHundreds(parseInt(cents));
  }

  return result.trim().toUpperCase(); // Return the final result
}


export function findMostFrequentValue(array, key) {
  const valueCount = array.reduce((acc, obj) => {
    const value = obj[key];
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});

  return Object.keys(valueCount).reduce((mostFrequent, current) => {
    return valueCount[current] > valueCount[mostFrequent]
      ? current
      : mostFrequent;
  });
}

export async function getFileContentAsString(dataid) {
  try {
    // 使用 getCrmRecordById 获取记录信息
    let changeallinfo = await getCrmRecordById("ChangeAll", dataid);
    console.log("changeallinfo", changeallinfo);

    // 提取 fileid

    if (changeallinfo && changeallinfo?.File.length > 0) {
      let fileid = changeallinfo?.File[0]?.File_Id__s;
      let lastrecorddataconfig = {
        id: fileid,
      };

      // 获取文件 Blob
      let lastrecordblob = await window.ZOHO.CRM.API.getFile(
        lastrecorddataconfig
      );

      // 创建一个 Promise 来处理 Blob 到字符串的转换
      let blobToString = new Promise((resolve, reject) => {
        let reader = new FileReader();

        reader.onloadend = function () {
          resolve(reader.result); // 成功时返回字符串
        };

        reader.onerror = function () {
          reject(reader.error); // 读取错误时触发
        };

        reader.readAsText(lastrecordblob); // 将 Blob 读取为文本
      });

      // 返回转换后的字符串
      return await blobToString;
    }
    return ""; // 如果 fileid 不存在，返回空字符串
  } catch (error) {
    console.error("Error fetching or reading file:", error);
    return ""; // 出错时返回空字符串
  }
}
