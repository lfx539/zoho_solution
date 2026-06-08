import React, { useCallback, useEffect, useState } from "react";
import { Select, MenuItem, InputLabel, Rating, TextField, Checkbox, FormControl, FormControlLabel, Button, Typography, Box, Stack, CircularProgress, OutlinedInput, InputAdornment } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { getCrmRecordFromSql, putdata, getfields } from '../util/util.js';
import Swal from 'sweetalert2'


const App = (props) => {
    const [isLoading, setIsLoading] = useState(false);
    const [ids, setIds] = useState([]);
    const [count, setCount] = useState(0);  //线索数量
    const [currentProgress, setCurrentProgress] = useState(0); // 当前进度




    // 获取当前时间
    const currentDate = new Date();
    // 获取时区偏移（单位是分钟）
    const timeZoneOffset = currentDate.getTimezoneOffset();
    // 计算时区偏移的小时和分钟
    const offsetHours = String(Math.floor(Math.abs(timeZoneOffset) / 60)).padStart(2, '0');
    const offsetMinutes = String(Math.abs(timeZoneOffset) % 60).padStart(2, '0');
    // 获取当前时间的 ISO 格式（去掉毫秒部分）
    const isoDateTimeWithoutMillis = currentDate.toISOString().split('.')[0]; // 去掉毫秒
    // 替换掉 UTC 的 'Z' 为时区偏移
    const isocurrentTime = isoDateTimeWithoutMillis.replace('Z', `+${offsetHours}:${offsetMinutes}`);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            // console.log(props);
            let entityIds = props?.data?.EntityId;
            let entity = props?.data?.Entity;

            setCount(entityIds?.length || 0);
            setIds(entityIds || []);


        } catch (error) {
            console.log(`fetchData发生错误：${error}`);
        } finally {
            setIsLoading(false);
        }
    }, [props])


    useEffect(() => {
        fetchData();
    }, [fetchData])



    const handleSave = async () => {
        setIsLoading(true);
        try {
            if (ids.length > 0) {


                for (let i = 0; i < ids.length; i++) {
                    setCurrentProgress(i + 1); // 进度从 1 开始

                    let leadid = ids[i];
                    let leadresult = await window.ZOHO.CRM.API.getRecord({ Entity: "Leads", approved: "both", RecordID: leadid });
                    let leaddata = leadresult.data[0];

                    //查询是否转为客户
                    let accid = '';
                    let sql1 = `select id,Account_Name,Lead.id as leadid from Accounts where ((Lead = ${leadid} or Email = '${leaddata?.Email}') or Account_Name = '${leaddata?.Company}')`;
                    // console.log(sql1);
                    let result1 = await getCrmRecordFromSql(sql1);
                    // console.log("result1", result1);
                    if (result1.length > 0) {
                        accid = result1[0]?.id; //如果查询到客户，则直接使用客户ID
                        //查询客户是否绑定了线索
                        if (!result1[0]?.leadid) {
                            //如果没有绑定线索，则需要更新线索字段
                            if (!account_leaid) {
                                let datain = {
                                    "data": [{
                                        id: accid,
                                        Lead: leaddata.id,
                                    }],
                                    "trigger": []
                                }
                                let res = await putdata("Accounts", datain);
                                console.log(res);
                            }
                        }
                    } else {
                        //如果没有查询到客户，则创建客户

                        let accountinfo = {
                            Account_Name: leaddata?.Company,
                            Country_Territory: leaddata?.Country_Territory,
                            Lead: { id: leaddata.id },
                            Owner: leaddata?.Owner,
                            Billing_City: leaddata?.City,
                            Converted_Date: isocurrentTime, // 转化日期
                            Industry: leaddata?.Company_Industry,
                            Company_Website: leaddata?.Company_Website,
                            Website: leaddata?.Website,
                            Competitor: leaddata?.Competitor,
                            Shipping_Country_Name: leaddata?.Basic_Information_Country_Code,
                            Email: leaddata?.Email,
                            Global_Sale_Region_New: leaddata?.Sales_Region || "",   //Single Line
                            field4: leaddata?.Global_Sales_Region_for_Lead_conversion || "",  //Pick List	
                            Billing_Country_Name: leaddata?.Basic_Information_Country_Code || null,  //Lookup
                            Shipping_USA_State_Province: leaddata?.North_America_State_Province,
                            USA_Canada_Territory_of_the_State: leaddata?.Territory_of_the_State,
                            Phone: leaddata?.Phone,
                            Shipping_City1: leaddata?.Shipping_City,
                            Shipping_Street1: leaddata?.Shipping_Street,
                            Shipping_Zip: leaddata?.Street_Zip,
                            Converted_Source: leaddata?.Source,
                            Contact: leaddata?.Address,  //Address
                            Subscription_Status: leaddata?.Subscription_Status,
                            Trade_show: leaddata?.Trade_Show,
                            Webinar_Topic: leaddata?.Webiner_Topic,
                            Billing_Code: leaddata?.Zip_Code,

                        };
                        let accountresult = await window.ZOHO.CRM.API.insertRecord({ Entity: "Accounts", APIData: accountinfo, Trigger: ["workflow", "approval", "blueprint"] })
                        if (!accountresult?.data?.[0]?.message === "record added") {

                            Swal.fire({
                                position: "top-end",
                                icon: "error",
                                title: "Conversion failure! And failed to create customer.",
                                showConfirmButton: false,
                                timer: 1500
                            });
                            console.log(`Create AccountInfo False ${accountresult}`);
                            return;

                        } else {
                            accid = accountresult?.data?.[0]?.details?.id;//获取客户id
                        }

                    }

                    //查询是否转为联系人
                    let contactid = '';

                    //获取转换后的联系人信息
                    let sql2 = `select id,Last_Name,LeadName.id as leadid from Contacts where (Email = '${leaddata?.Email}' or Phone = '${leaddata?.Phone}')`;

                    let result2 = await getCrmRecordFromSql(sql2);

                    if (result2.length > 0) {
                        contactid = result2[0]?.id;
                        //如果查询到联系人，但是联系人上的LeadName为空，则需要更新LeadName字段
                        if (!result2[0]?.leadid) {
                            let contactinfo = {
                                id: contactid,
                                LeadName: leaddata.id,
                            }
                            let contactresult = await window.ZOHO.CRM.API.updateRecord({ Entity: "Contacts", APIData: contactinfo, Trigger: ["workflow", "approval", "blueprint"] });
                            console.log(contactresult);
                        }


                    } else {
                        let contactinfo = {
                            Last_Name: leaddata?.Last_Name,
                            First_Name: leaddata?.First_Name,
                            Owner: leaddata?.Owner,
                            Account_Name: accid ? { id: accid } : null,
                            Converted_Date: isocurrentTime, // 转化日期
                            LeadName: { id: leaddata.id },
                            Industry: leaddata?.Company_Industry,
                            Linkedin: leaddata?.Note,  //Linkedin
                            Mailing_City: leaddata?.City,
                            Competitor: leaddata?.Competitor,
                            Other_Country_Name: leaddata?.Basic_Information_Country_Code || null,
                            Email: leaddata?.Email,
                            Global_Sale_Region_New: leaddata?.Sales_Region || "",   //Global Sales Region
                            field4: leaddata?.Global_Sales_Region_for_Lead_conversion || "",   //Global Sales Region  //Pick List	
                            Mailing_Street: leaddata?.Street || "",   //Mailing Street
                            Mailing_State_Name: leaddata?.North_America_State_Province || null,   //Mailing State/Province
                            Milling_Country: leaddata?.Basic_Information_Country_Code || null,
                            Mobile: leaddata?.Mobile,
                            Shipping_State_Name: leaddata?.North_America_State_Province || null,
                            USA_Canada_Territory_of_the_State: leaddata?.Territory_of_the_State,  //NAm Territory
                            Phone: leaddata?.Phone,
                            Shipping_City: leaddata?.Shipping_City,
                            Shipping_Street1: leaddata?.Shipping_Street1,
                            Shipping_Zip: leaddata?.Street_Zip || "",
                            Source: leaddata?.Source,
                            Shipping_Street: leaddata?.Shipping_Street,
                            Subscription_Status: leaddata?.Subscription_Status,
                            Trade_Show: leaddata?.Trade_Show,
                            Webinar_Topic: leaddata?.Webinar_Topic,
                            Mailing_Zip: leaddata?.Mailing_Zip,


                        };
                        let contactresult = await window.ZOHO.CRM.API.insertRecord({ Entity: "Contacts", APIData: contactinfo, Trigger: ["workflow", "approval", "blueprint"] })
                        console.log(contactresult);
                        if (!contactresult?.data?.[0]?.message === "record added") {

                            Swal.fire({
                                position: "top-end",
                                icon: "error",
                                title: "Conversion failure! And failed to create Contact.",
                                showConfirmButton: false,
                                timer: 1500
                            });
                            console.log(`Create Contact False ${contactresult}`);
                            return;

                        } else {
                            contactid = contactresult?.data?.[0]?.details?.id;//获取客户id
                        }
                    }


                    //回写状态到线索

                    const leadjson = {
                        "data": [{
                            id: leaddata.id,
                            IsConvertAccount: accid ? true : false,
                            IsConvertContact: contactid ? true : false,
                        }]
                    }
                    let leadupresult = await putdata("Leads", leadjson);
                    console.log(leadupresult);

                }
            }
        } catch (error) {
            console.log(`转换线索时发生错误${error}`);
            Swal.fire({
                icon: 'error',
                title: 'Conversion failed!',
                text: `${error}`,
            })
        } finally {
            setIsLoading(false);
            Swal.fire("success");//成功提示

            setTimeout(() => {
                window.ZOHO.CRM.UI.Popup.close(); //关闭弹窗
            }, 3000);
        }
    }

    return (
        <>
            {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                    {/* 添加进度条 */}
                    <div>
                        <span variant="h6">{`Converting ${currentProgress} of ${count} leads`}</span>
                        <CircularProgress variant="determinate" value={(currentProgress / count) * 100} />
                    </div>
                </Box>
            ) : (
                <Box sx={{ position: 'relative', margin: 'auto', padding: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Grid container direction="column" spacing={2}>
                            <Grid item='true'>
                                <Typography variant="h6">There are currently {count} leads available for selection</Typography>
                            </Grid>
                            <Grid item='true'>
                                <span style={{ marginRight: '8px' }} >Convert Lead To:</span>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            disabled
                                            checked
                                        />
                                    }
                                    label="Account"
                                />
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            disabled
                                            checked
                                        />
                                    }
                                    label="Contact"
                                />
                            </Grid>

                        </Grid>


                    </Box>
                    <Box mt={2}>
                        <Stack spacing={2} direction="row">
                            <Button variant="contained" color="primary" onClick={handleSave}>
                                CONVERT
                            </Button>
                            <Button variant="outlined" color="secondary" onClick={() => window.ZOHO.CRM.UI.Popup.close()}>
                                CANCEL
                            </Button>
                        </Stack>
                    </Box>
                </Box>
            )}
        </>
    );

}


export default App;