import React, { useCallback, useEffect, useState } from "react";
import { Select, MenuItem, InputLabel, Rating, TextField, Checkbox, FormControl, FormControlLabel, Button, Typography, Box, Stack, CircularProgress, OutlinedInput, InputAdornment, Autocomplete } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { getCrmRecordFromSql, putdata, getfields } from '../util/util.js';
import Swal from 'sweetalert2'
import dayjs from "dayjs";


const Scoringmap = {
    1: '1 Star',
    2: '2 Stars',
    3: '3 Stars',
    4: '4 Stars',
    5: '5 Stars',
}

const App = (props) => {
    const [isLoading, setIsLoading] = useState(false);
    const [leadinfo, setLeadinfo] = useState({});  //线索信息
    const [dealinfo, setDealinfo] = useState({});  //商机信息
    const [isconverted, setIsConverted] = useState(false);
    const [isCreDeal, setIsCreDeal] = useState(false); //是否创建商机
    const [salesregionlist, setSalesregionlist] = useState([]);  //一级区域信息
    const [ntlist, setNtlist] = useState([]);  //区域信息
    const [pipeline, setPipeline] = useState([]);  //区域信息
    const [leadsource, setLeadsource] = useState([]);  //线索来源
    // const [contactrole, setContactrole] = useState([]);  //联系人角色
    const [stage, setStage] = useState([]);  //商机阶段
    const [accountid, setAccountid] = useState("");  //crm客户id
    const [contactid, setContactid] = useState("");  //crm联系人id
    const [dealid, setDealid] = useState("");  //商机id
    const [isShownt, setIsShownt] = useState(false);  //是否显示二级区域
    const [account_leaid, setAccount_leaid] = useState("");  //crm客户线索id
    const [contact_leaid, setContact_leaid] = useState("");  //crm联系人线索id
    const [accountOptions, setAccountOptions] = useState([]);  // Account search results
    const [selectedAccount, setSelectedAccount] = useState(null);  // Selected account from dropdown
    const [accountSearchText, setAccountSearchText] = useState("");  // Account search text


    useEffect(() => {

        if (accountid && contactid && dealid) {
            setIsConverted(true);
        } else if (accountid && contactid && !dealid && !isCreDeal) {
            setIsConverted(true);
        }
        else {
            setIsConverted(false);
        }
    }, [accountid, contactid, dealid, isCreDeal]);


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
            let entityId = props?.data?.EntityId?.[0];
            let entity = props?.data?.Entity;


            //获取下拉菜单的值
            let response_fields = await getfields("Deals");
            let dealfields = response_fields?.details?.statusMessage?.fields;
            let ntlist = dealfields?.find(item => item.api_name === "NAm_Territory")?.pick_list_values;    //    NAm_Territory
            // console.log("ntlist",ntlist);
            setNtlist(ntlist || []);


            let salesregionresult = dealfields?.find(item => item.api_name === "GlobalSalesRegion")?.pick_list_values;    //    Sales_Region
            setSalesregionlist(salesregionresult || []);

            let pipeline = dealfields?.find(item => item.api_name === "Pipeline")?.pick_list_values;    //    Pipeline
            // console.log("pipeline",pipeline);
            setPipeline(pipeline || []);


            let leadsource = dealfields?.find(item => item.api_name === "Lead_Source")?.pick_list_values;    //    Lead_Sour
            // console.log("leadsource",leadsource);
            setLeadsource(leadsource || []);


            let dealstage = dealfields?.find(item => item.api_name === "Stage")?.pick_list_values;    //    Stage
            // console.log("dealstage",dealstage);
            setStage(dealstage);


            //获取全部的线索信息
            let leadresult = await window.ZOHO.CRM.API.getRecord({ Entity: entity, approved: "both", RecordID: entityId });
            // console.log(leadresult);
            if (Array.isArray(leadresult?.data) && leadresult?.data?.length > 0) {
                let leaddata = leadresult.data[0];
                setLeadinfo(leaddata);   //线索信息
                // console.log(leaddata);

                //获取转换后的客户信息
                let sql1 = `select id,Account_Name,Lead.id as leadid from Accounts where ((Lead = ${entityId} or Email = '${leaddata?.Email}') or Account_Name = '${leaddata?.Company}')`;
                // console.log(sql1);
                let result1 = await getCrmRecordFromSql(sql1);
                if (result1.length > 0) {
                    setAccountid(result1[0]?.id);
                    setAccount_leaid(result1[0]?.leadid || "");
                }

                //获取转换后的联系人信息
                let sql2 = `select id,Last_Name,LeadName.id as leadid from Contacts where (Email = '${leaddata?.Email}' or Phone = '${leaddata?.Phone}')`;
                // console.log(sql2);
                let result2 = await getCrmRecordFromSql(sql2);
                // console.log("result2", result2);
                if (result2.length > 0) {
                    setContactid(result2[0]?.id);
                    setContact_leaid(result2[0]?.leadid || "");
                }
                //获取转换后的商机信息
                let sql3 = `select id,Deal_Name from Deals where id is not null and LeadName = '${leaddata.id}'`;
                // console.log(sql2);
                let result3 = await getCrmRecordFromSql(sql3);
                // console.log("result3", result3);
                if (result3.length > 0) {
                    setDealid(result3[0]?.id);
                }
                // if (dealid) {
                //     setIsConverted(true);
                // }
                // 查找键对应的值
                const scortingnum = Object.keys(Scoringmap).find(key => Scoringmap[key] === (leaddata?.Scorting || "")) || "";
                //设置商机信息预览
                setDealinfo({
                    "Deal_Name": leaddata?.Full_Name,   //商机名称
                    "Account_Name": leaddata?.Company,  //客户名称
                    "Stage": "Qualification",   //商机阶段
                    "LeadSource": leaddata?.Source,
                    "Scoring": scortingnum,
                    // "Contact Role": "",  //
                    "Owner": leaddata?.Owner,  //所有者
                });
            }
        } catch (error) {
            console.log(`fetchData error: ${error}`);
        } finally {
            setIsLoading(false);
        }
    }, [props])

    // Load initial account list
    const loadInitialAccounts = async () => {
        try {
            let sql = `select id, Account_Name from Accounts where id is not null limit 50`;
            let config = { select_query: sql };
            let result = await window.ZOHO.CRM.API.coql(config);
            setAccountOptions(result?.data || []);
        } catch (error) {
            setAccountOptions([]);
        }
    };

    useEffect(() => {
        fetchData();
        loadInitialAccounts();
    }, [fetchData])

    // Search Accounts
    const handleAccountSearch = async (searchText) => {
        setAccountSearchText(searchText);
        try {
            let sql;
            if (searchText && searchText.length > 0) {
                sql = `select id, Account_Name from Accounts where Account_Name like '%${searchText}%' limit 50`;
            } else {
                sql = `select id, Account_Name from Accounts where id is not null limit 50`;
            }
            let config = { select_query: sql };
            let result = await window.ZOHO.CRM.API.coql(config);
            setAccountOptions(result?.data || []);
        } catch (error) {
            setAccountOptions([]);
        }
    };



    const handleSave = async () => {

        //获取当前时间
        // let currentTime = dayjs().format('YYYY-MM-DD HH:mm:ss');

        //如果创建商机，判断必填项是否为空
        if (isCreDeal) {
            let requiredFields = [
                "Deal_Name",
                "Account_Name",
                "Stage",
                "Pipeline",
                "Owner",
                "Expected_Close_Date",
                "Scoring",
            ];
            let requiredresult = [];
            for (let field of requiredFields) {
                // Scoring 为 0 时是有效值
                if (field === "Scoring") {
                    if (dealinfo[field] === null || dealinfo[field] === undefined || dealinfo[field] === "") {
                        requiredresult.push(field);
                    }
                } else if (!dealinfo[field]) {
                    requiredresult.push(field); // 如果字段为空，则将其添加到数组中
                }
            }
            if (requiredresult.length > 0) {
                Swal.fire({
                    text: `Required fields ${requiredresult.join(",")} cannot be empty`,
                    icon: "warning"
                });
                return;
            }
        }

        setIsLoading(true);
        try {
            let accid = accountid;
            let conid = contactid;
            let deal_id = dealid;

            //1、创建客户（查询客户是否存在）存在就跳过
            if (!accid) {

                let accountinfo = {
                    Account_Name: leadinfo?.Company,
                    Country_Territory: leadinfo?.Country_Territory,
                    Lead: { id: leadinfo.id },
                    Owner: leadinfo?.Owner,
                    Billing_City: leadinfo?.City,
                    Converted_Date: isocurrentTime, // 转化日期
                    Industry: leadinfo?.Company_Industry,
                    Company_Website: leadinfo?.Company_Website,
                    Website: leadinfo?.Website,
                    Competitor: leadinfo?.Competitor,
                    Shipping_Country_Name: leadinfo?.Basic_Information_Country_Code,
                    Email: leadinfo?.Email,
                    Global_Sale_Region_New: leadinfo?.Sales_Region || "",   //Single Line
                    field4: leadinfo?.Global_Sales_Region_for_Lead_conversion || "",  //Pick List	
                    Billing_Country_Name: leadinfo?.Basic_Information_Country_Code || null,  //Lookup
                    Shipping_USA_State_Province: leadinfo?.North_America_State_Province,
                    USA_Canada_Territory_of_the_State: leadinfo?.Territory_of_the_State,
                    Phone: leadinfo?.Phone,
                    Shipping_City1: leadinfo?.Shipping_City,
                    Shipping_Street1: leadinfo?.Shipping_Street,
                    Shipping_Zip: leadinfo?.Street_Zip,
                    Converted_Source: leadinfo?.Source,
                    Contact: leadinfo?.Address,  //Address
                    Subscription_Status: leadinfo?.Subscription_Status,
                    Trade_show: leadinfo?.Trade_Show,
                    Webinar_Topic: leadinfo?.Webiner_Topic,
                    Billing_Code: leadinfo?.Zip_Code,

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
                    return;

                } else {
                    accid = accountresult?.data?.[0]?.details?.id;//获取客户id
                    setAccountid(accid);//设置客户id
                }
            } else {
                //查询客户是否绑定了线索
                if (!account_leaid) {
                    let datain = {
                        "data": [{
                            id: accid,
                            Lead: leadinfo.id,
                        }],
                        "trigger": []
                    }
                    let res = await putdata("Accounts", datain);
                }

            }


            //2、创建联系人存在就跳过
            if (!conid) {    //如果客户id存在并且联系人id不存在

                let contactinfo = {
                    Last_Name: leadinfo?.Last_Name,
                    First_Name: leadinfo?.First_Name,
                    Owner: leadinfo?.Owner,
                    Account_Name: accid ? { id: accid } : null,
                    Converted_Date: isocurrentTime, // 转化日期
                    LeadName: { id: leadinfo.id },
                    Industry: leadinfo?.Company_Industry,
                    Linkedin: leadinfo?.Note,  //Linkedin
                    Mailing_City: leadinfo?.City,
                    Competitor: leadinfo?.Competitor,
                    Other_Country_Name: leadinfo?.Basic_Information_Country_Code || null,
                    Email: leadinfo?.Email,
                    Global_Sale_Region_New: leadinfo?.Sales_Region || "",   //Global Sales Region
                    field4: leadinfo?.Global_Sales_Region_for_Lead_conversion || "",   //Global Sales Region  //Pick List	
                    Mailing_Street: leadinfo?.Street || "",   //Mailing Street
                    Mailing_State_Name: leadinfo?.North_America_State_Province || null,   //Mailing State/Province
                    Milling_Country: leadinfo?.Basic_Information_Country_Code || null,
                    Mobile: leadinfo?.Mobile,
                    Shipping_State_Name: leadinfo?.North_America_State_Province || null,
                    USA_Canada_Territory_of_the_State: leadinfo?.Territory_of_the_State,  //NAm Territory
                    Phone: leadinfo?.Phone,
                    Shipping_City: leadinfo?.Shipping_City,
                    Shipping_Street1: leadinfo?.Shipping_Street1,
                    Shipping_Zip: leadinfo?.Street_Zip || "",
                    Source: leadinfo?.Source,
                    Shipping_Street: leadinfo?.Shipping_Street,
                    Subscription_Status: leadinfo?.Subscription_Status,
                    Trade_Show: leadinfo?.Trade_Show,
                    Webinar_Topic: leadinfo?.Webinar_Topic,
                    Mailing_Zip: leadinfo?.Mailing_Zip,


                };

                let contactresult = await window.ZOHO.CRM.API.insertRecord({ Entity: "Contacts", APIData: contactinfo, Trigger: ["workflow", "approval", "blueprint"] })
                if (!contactresult?.data?.[0]?.message === "record added") {

                    Swal.fire({
                        position: "top-end",
                        icon: "error",
                        title: "Conversion failure! And failed to create Contact.",
                        showConfirmButton: false,
                        timer: 1500
                    });
                    return;

                } else {
                    conid = contactresult?.data?.[0]?.details?.id;//获取客户id
                    setContactid(conid); //设置联系人id
                }

            } else {
                //查询联系人是否绑定了线索
                if (!contact_leaid) {

                    let datain = {
                        id: conid,
                        LeadName: leadinfo.id,
                    }
                    let res = await window.ZOHO.CRM.API.updateRecord({ Entity: "Contacts", APIData: datain, Trigger: [] });
                }
            }




                // 同步子表数据：Product_Interested_lead -> Product_Interested_deal
                let productInterestedDeal = [];
                if (leadinfo?.Product_Interested_lead && Array.isArray(leadinfo.Product_Interested_lead)) {
                    productInterestedDeal = leadinfo.Product_Interested_lead.map(item => ({
                        Product_Name: item.Product_Name ? { id: item.Product_Name.id } : null,
                        Comments: item.Comments || '',
                    }));
                }

            //3、创建商机
            if (!deal_id && accid && isCreDeal) {   //如果商机id不存在并且客户id存在
                let dealjson = {
                    Deal_Name: dealinfo?.Deal_Name,
                    Account_Name: { id: accid },
                    Contact_Name: { id: conid },
                    LeadName: { id: leadinfo.id },
                    leadIdCopy: leadinfo?.leadIdCopy || "",  // Lead.leadIdCopy -> Deal.leadIdCopy
                    Converted_Date: isocurrentTime,
                    Stage: dealinfo?.Stage,
                    Owner: leadinfo?.Owner,
                    Competitor: leadinfo?.Competitor,
                    field4: leadinfo?.field4,  //Global Sales Region
                    GlobalSalesRegion: dealinfo?.GlobalSalesRegion,
                    NAm_Territory: dealinfo?.Territory === '-None-' ? '' : dealinfo?.Territory,
                    Lead_Source: leadinfo?.Source,
                    Trade_Show: leadinfo?.Trade_Show,
                    Webinar_Topic: leadinfo?.Webinar_Topic,
                    Amount: dealinfo?.Amount,
                    Industry: leadinfo?.Company_Industry,  //行业  Pick List
                    Linkedin: leadinfo?.Note,  // Multi Line (Small)
                    Converted_Source: leadinfo?.Source,  //Pick List
                    Pipeline: dealinfo?.Pipeline,
                    // Converted_Source: dealinfo?.Source,
                    Closing_Date: dealinfo?.Expected_Close_Date,
                    Scorting: Scoringmap?.[dealinfo?.Scoring] || "",
                    Product_Interested_deal: productInterestedDeal,  // 子表数据同步
                }

                console.log("dealjson", JSON.stringify(dealjson));

                let dealresult = await window.ZOHO.CRM.API.insertRecord({ Entity: "Deals", APIData: dealjson, Trigger: ["workflow", "approval", "blueprint"] })
                if (!dealresult?.data?.[0]?.message === "record added") {

                    Swal.fire({
                        position: "top-end",
                        icon: "error",
                        title: "Conversion failure! And failed to create Deal.",
                        showConfirmButton: false,
                        timer: 1500
                    });
                    return;

                } else {
                    deal_id = dealresult?.data?.[0]?.details?.id;//获取客户id
                    setDealid(deal_id);
                }
            }
            //4、回写线索

            const leadjson = {
                "data": [{
                    id: leadinfo.id,
                    IsConvertAccount: accid ? true : false,
                    IsConvertContact: conid ? true : false,
                    IsConvertDeal: deal_id ? true : false,
                }]
            }


            let leadresult = await putdata("Leads", leadjson);
            if (leadresult?.details?.statusMessage?.data?.[0]?.details?.id) {
                setIsConverted(true); //设置已转换
                Swal.fire("success");

            } else {
                Swal.fire({
                    text: `Conversion failed!`,
                    icon: "error"
                });
            }

        } catch (error) {
            console.log(`转换线索时发生错误${error}`);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <>
            {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                    <CircularProgress />
                </Box>
            ) : (
                <Box sx={{ position: 'relative', margin: 'auto', padding: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="body1" sx={{ marginRight: 2 }}>
                            客户：<span style={{ color: accountid ? 'green' : 'red' }}>{accountid ? '已转换' : '未转换'}</span>
                        </Typography>
                        <Typography variant="body1" sx={{ marginRight: 2 }}>
                            联系人：<span style={{ color: contactid ? 'green' : 'red' }}>{contactid ? '已转换' : '未转换'}</span>
                        </Typography>
                        <Typography variant="body1">
                            商机：<span style={{ color: dealid ? 'green' : 'red' }}>{dealid ? '已转换' : '未转换'}</span>
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="h5" gutterBottom>
                            Convert Lead {leadinfo?.Full_Name}
                        </Typography>
                        <Typography variant="body1">
                            Create New Account: {leadinfo?.Company}
                            <br />
                            Create New Contact: {leadinfo?.Full_Name}
                        </Typography>

                        <FormControlLabel
                            control={<Checkbox checked={isCreDeal} onChange={() => setIsCreDeal(!isCreDeal)} name="createNewDeal" />}
                            label="Create a new Deal for this Account."
                        />

                        <Grid container direction="column"
                            spacing={1}
                        // sx={{
                        //     justifyContent: "flex-start",
                        //     alignItems: "flex-start",
                        // }}
                        >
                            {/* Deal Name */}
                            <Grid item='true' xs={12}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    error={!dealinfo?.Deal_Name}
                                    sx={{ m: 1 }}
                                    label="Deal Name*:"
                                    onChange={
                                        e => setDealinfo({ ...dealinfo, Deal_Name: e.target.value })
                                    }
                                    variant="outlined"
                                    name="Deal_Name"
                                    value={dealinfo?.Deal_Name}
                                />
                            </Grid>
                            {/* Account Name */}
                            <Grid item='true' xs={12}>
                                <Autocomplete
                                    size="small"
                                    sx={{ m: 1 }}
                                    fullWidth
                                    freeSolo
                                    openOnFocus
                                    options={accountOptions}
                                    getOptionLabel={(option) => typeof option === 'string' ? option : (option.Account_Name || '')}
                                    value={selectedAccount || null}
                                    inputValue={dealinfo?.Account_Name || ''}
                                    onOpen={() => {
                                        // Load accounts when dropdown opens
                                        loadInitialAccounts();
                                    }}
                                    onInputChange={(event, newInputValue) => {
                                        handleAccountSearch(newInputValue);
                                        // Also update dealinfo if typing custom value
                                        if (!accountOptions.find(opt => opt.Account_Name === newInputValue)) {
                                            setDealinfo({ ...dealinfo, Account_Name: newInputValue });
                                        }
                                    }}
                                    onChange={(event, newValue) => {
                                        if (typeof newValue === 'string') {
                                            // User typed a custom value
                                            setSelectedAccount(null);
                                            setAccountid("");
                                            setDealinfo({ ...dealinfo, Account_Name: newValue });
                                        } else if (newValue) {
                                            // User selected from dropdown
                                            setSelectedAccount(newValue);
                                            setAccountid(newValue.id);
                                            setDealinfo({ ...dealinfo, Account_Name: newValue.Account_Name });
                                        } else {
                                            // Cleared
                                            setSelectedAccount(null);
                                            setAccountid("");
                                            setDealinfo({ ...dealinfo, Account_Name: leadinfo?.Company || "" });
                                        }
                                    }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Account Name*:"
                                            placeholder="Search or enter account name..."
                                        />
                                    )}
                                    isOptionEqualToValue={(option, value) => {
                                        if (!value) return false;
                                        if (typeof value === 'string') return option.Account_Name === value;
                                        return option.id === value.id;
                                    }}
                                    noOptionsText="No accounts found"
                                />
                            </Grid>
                            {/* Amount */}
                            <Grid item='true' xs={12}>
                                <FormControl fullWidth sx={{ m: 1 }} size="small">
                                    <InputLabel>Amount</InputLabel>
                                    <OutlinedInput
                                        id="outlined-adornment-amount"
                                        startAdornment={<InputAdornment position="start">$</InputAdornment>}
                                        label="Amount:"
                                        type="number"
                                        variant="outlined"
                                        name="Amount"
                                        onChange={e => setDealinfo({ ...dealinfo, Amount: e.target.value })}
                                        value={dealinfo?.Amount}
                                    />
                                </FormControl>
                            </Grid>
                            <Grid item='true' xs={12}>
                                <FormControl fullWidth sx={{ minWidth: 300, m: 1 }} size="small">
                                    <InputLabel>Global Sales Region:</InputLabel>
                                    <Select
                                        label="Global Sales Region:"
                                        value={dealinfo?.GlobalSalesRegion || '-None-'}
                                        onChange={e => {
                                            if (e.target.value === 'The North America Region') {
                                                setIsShownt(true);
                                            } else {
                                                setIsShownt(false);
                                            }
                                            setDealinfo({ ...dealinfo, GlobalSalesRegion: e.target.value });
                                        }}
                                    >
                                        {salesregionlist.map(option => (
                                            <MenuItem key={option.display_value} value={option.display_value}>
                                                {option?.display_value}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            {/* NAm Territory (Select dropdown) */}
                            {isShownt &&
                                <Grid item='true' xs={12}>
                                    <FormControl fullWidth sx={{ minWidth: 300, m: 1 }} size="small">
                                        <InputLabel>NAm Territory:</InputLabel>
                                        <Select
                                            label="NAm Territory:"
                                            value={dealinfo?.Territory || '-None-'}
                                            onChange={e => setDealinfo({ ...dealinfo, Territory: e.target.value })}
                                        >
                                            {ntlist.map(option => (
                                                <MenuItem key={option.display_value} value={option.display_value}>
                                                    {option?.display_value}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                            }
                            {/* Stage (Select dropdown) */}
                            <Grid item='true' xs={12}>
                                <FormControl fullWidth sx={{ minWidth: 300, m: 1 }} size="small">
                                    <InputLabel>Stage*</InputLabel>
                                    <Select
                                        fullWidth
                                        disabled
                                        label="Stage:"
                                        // error={!dealinfo?.Stage}
                                        value={dealinfo?.Stage || ''}
                                        onChange={e => {
                                            setDealinfo({ ...dealinfo, Stage: e.target.value });
                                        }}
                                    >
                                        {stage.map(option => (
                                            <MenuItem key={option.display_value} value={option.display_value}>
                                                {option.display_value}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            {/* Pipeline (Select dropdown) */}
                            <Grid item='true' xs={12}>
                                <FormControl fullWidth sx={{ minWidth: 300, m: 1 }} size="small">
                                    <InputLabel>Pipeline*</InputLabel>
                                    <Select
                                        fullWidth
                                        label="Pipeline:"
                                        // error={!dealinfo?.Pipeline}
                                        value={dealinfo?.Pipeline || ''}
                                        onChange={e => setDealinfo({ ...dealinfo, Pipeline: e.target.value })}
                                    >
                                        {pipeline.map(option => (
                                            <MenuItem key={option.display_value} value={option.display_value}>
                                                {option.display_value}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            {/* Lead Source (Select dropdown) */}
                            <Grid item='true' xs={12}>
                                <FormControl fullWidth sx={{ minWidth: 300, m: 1 }} size="small">
                                    <InputLabel>Lead Source</InputLabel>
                                    <Select
                                        fullWidth
                                        label="Lead Source:"
                                        disabled
                                        value={dealinfo?.LeadSource || '-None-'}
                                        onChange={e => setDealinfo({ ...dealinfo, LeadSource: e.target.value })}
                                    >
                                        {leadsource.map(option => (
                                            <MenuItem key={option.display_value} value={option.display_value}>
                                                {option.display_value}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            {/* Closing Date */}
                            <Grid item='true' xs={12}>
                                <LocalizationProvider dateAdapter={AdapterDayjs}>
                                    <DatePicker
                                        label="Closing Date*:"
                                        size="small"
                                        error={!dealinfo?.Expected_Close_Date}
                                        sx={{ m: 1 }}
                                        value={dealinfo?.Expected_Close_Date ? dayjs(dealinfo?.Expected_Close_Date) : null}
                                        onChange={newDate => {
                                            setDealinfo({
                                                ...dealinfo,
                                                Expected_Close_Date: newDate ? newDate.format('YYYY-MM-DD') : null,
                                            });
                                        }}
                                        inputFormat="YYYY-MM-DD"
                                        textField={params => <TextField {...params} fullWidth />}
                                    />
                                </LocalizationProvider>
                            </Grid>

                            {/* Scoring (Rating component) */}
                            <Grid item='true' xs={12} sx={{ m: 1 }}>
                                <span style={{ marginRight: '10px' }}>Scoring*</span>
                                <Rating
                                    name="scoring"
                                    size="small"
                                    precision={1}
                                    value={dealinfo?.Scoring || 0}
                                    onChange={(event, newValue) => setDealinfo({ ...dealinfo, Scoring: newValue })}
                                />
                            </Grid>
                            <Grid item='true' xs={12}>
                                <TextField
                                    fullWidth
                                    disabled
                                    size="small"
                                    sx={{ m: 1 }}
                                    label="Converted Date"
                                    variant="outlined"
                                    value={isocurrentTime}
                                />
                            </Grid>
                            {/* Owner of the New Records */}
                            <Grid item='true' xs={12}>
                                <TextField
                                    fullWidth
                                    disabled
                                    size="small"
                                    sx={{ m: 1 }}
                                    label="Owner of the New Records:"
                                    variant="outlined"
                                    name="Owner"
                                    value={dealinfo?.Owner?.name}
                                />
                            </Grid>
                        </Grid>

                        <Box mt={2}>
                            <Stack spacing={2} direction="row">
                                <Button variant="contained" color="primary" disabled={isconverted} onClick={handleSave}>
                                    CONVERT
                                </Button>
                                <Button variant="outlined" color="secondary" onClick={() => window.ZOHO.CRM.UI.Popup.closeReload()}>
                                    CANCEL
                                </Button>
                            </Stack>
                        </Box>
                    </Box>
                </Box>
            )}
        </>
    );

}


export default App;