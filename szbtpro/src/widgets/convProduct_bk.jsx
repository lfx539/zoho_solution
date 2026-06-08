import React, { useCallback, useEffect, useState } from "react";
import {
    Button,
    Typography,
    Box,
    Stack,
    CircularProgress,
    Checkbox,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
} from '@mui/material';
import { getCrmRecordFromSql, putdata } from '../util/util.js';
import Swal from 'sweetalert2'


const App = (props) => {
    const [isLoading, setIsLoading] = useState(false);
    const [dealInfo, setDealInfo] = useState({});  // Deal 信息
    const [productInterestList, setProductInterestList] = useState([]);  // 产品兴趣列表
    const [selectedIds, setSelectedIds] = useState(new Set());  // 选中的行 ID
    const [isConverted, setIsConverted] = useState(false);  // 是否已转换
    const [isClosedWon, setIsClosedWon] = useState(false);  // 是否为 Closed Won 状态

    // 获取当前时间
    const currentDate = new Date();
    const timeZoneOffset = currentDate.getTimezoneOffset();
    const offsetHours = String(Math.floor(Math.abs(timeZoneOffset) / 60)).padStart(2, '0');
    const offsetMinutes = String(Math.abs(timeZoneOffset) % 60).padStart(2, '0');
    const isoDateTimeWithoutMillis = currentDate.toISOString().split('.')[0];
    const isocurrentTime = isoDateTimeWithoutMillis.replace('Z', `+${offsetHours}:${offsetMinutes}`);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            let entityId = props?.data?.EntityId?.[0];
            let entity = props?.data?.Entity;
            console.log('entityId:', entityId, 'entity:', entity);

            // 获取 Deal 信息
            let dealResult = await window.ZOHO.CRM.API.getRecord({
                Entity: entity,
                approved: "both",
                RecordID: entityId
            });

            console.log('dealResult:', dealResult);

            if (Array.isArray(dealResult?.data) && dealResult?.data?.length > 0) {
                let dealData = dealResult.data[0];
                console.log('dealData:', dealData);
                setDealInfo(dealData);

                // 检查 Stage 是否为 Closed Won
                if (dealData?.Stage !== 'Closed Won') {
                    setIsClosedWon(false);
                    setIsLoading(false);
                    Swal.fire({
                        icon: "warning",
                        title: "Cannot Convert",
                        text: `Current stage is "${dealData?.Stage || 'Unknown'}". Only deals with "Closed Won" stage can be converted.`,
                    }).then(() => {
                        window.ZOHO.CRM.UI.Popup.close();
                    });
                    return;
                }
                setIsClosedWon(true);

                // 检查是否已转换
                if (dealData?.IsConvertedToProductPurchased) {
                    setIsConverted(true);
                }

                // 获取子表 Product_Interested_deal 数据
                let productInterestData = dealData?.Product_Interested_deal || [];
                console.log('productInterestData:', productInterestData);
                setProductInterestList(productInterestData);
            }
        } catch (error) {
            console.log(`fetchData发生错误：${error}`);
        } finally {
            setIsLoading(false);
        }
    }, [props]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // 处理复选框选择
    const handleSelect = (rowId) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(rowId)) {
                newSet.delete(rowId);
            } else {
                newSet.add(rowId);
            }
            return newSet;
        });
    };

    // 全选/取消全选
    const handleSelectAll = () => {
        if (selectedIds.size === productInterestList.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(productInterestList.map(item => item.id)));
        }
    };

    // 转换处理
    const handleConvert = async () => {
        if (selectedIds.size === 0) {
            Swal.fire({
                text: "Please select at least one product to convert.",
                icon: "warning"
            });
            return;
        }

        if (isConverted) {
            Swal.fire({
                text: "This deal has already been converted. Cannot convert again.",
                icon: "warning"
            });
            return;
        }

        setIsLoading(true);
        try {
            const selectedProducts = productInterestList.filter(item => selectedIds.has(item.id));
            let dealId = dealInfo.id;
            let dealName = dealInfo?.Deal_Name || dealId;
            let accountId = dealInfo?.Account_Name?.id || null;
            let leadId = dealInfo?.leadIdCopy || null;

            // 1. 创建 Products_Purchased 记录，并保存返回的 ID
            let productsPurchasedMap = {};  // productId -> productsPurchasedId

            for (let product of selectedProducts) {
                let originalProductId = product?.Product_Name?.id;

                let purchasedData = {
                    Name: dealName,
                    Product_Name: originalProductId ? { id: originalProductId } : null,
                    Account_Name: accountId ? { id: accountId } : null,
                    Deal_Name: { id: dealId },
                };

                let result = await window.ZOHO.CRM.API.insertRecord({
                    Entity: "Products_Purchased",
                    APIData: purchasedData,
                    Trigger: ["workflow", "approval", "blueprint"]
                });

                console.log('Products_Purchased result:', result);

                if (result?.data?.[0]?.details?.id) {
                    let newPurchasedId = result.data[0].details.id;
                    if (originalProductId) {
                        productsPurchasedMap[originalProductId] = newPurchasedId;
                    }
                } else {
                    console.log(`Create Products_Purchased failed: ${JSON.stringify(result)}`);
                }
            }

            console.log('Products_Purchased Map:', productsPurchasedMap);

            // 2. 查找或创建 Case_Module
            // 先按 Deal 查找，如果没有再按 Lead 查找（处理通过 Lead 创建的 Case）
            let caseSql = `select id from Case_Module where Deal = ${dealId}`;
            let existingCases = await getCrmRecordFromSql(caseSql);

            // 如果按 Deal 没找到，且有 leadId，则按 Lead 查找
            if (existingCases.length === 0 && leadId) {
                let caseSqlByLead = `select id from Case_Module where Lead = ${leadId}`;
                existingCases = await getCrmRecordFromSql(caseSqlByLead);
            }

            let caseId = null;

            if (existingCases.length > 0) {
                // 已存在 Case，更新子表
                caseId = existingCases[0].id;

                // 获取现有 Case 子表数据
                let caseResult = await window.ZOHO.CRM.API.getRecord({
                    Entity: "Case_Module",
                    approved: "both",
                    RecordID: caseId
                });
                let existingSubformData = caseResult?.data?.[0]?.Product_Purchased || [];

                // 添加新选中的产品到子表（关联到 Products_Purchased）
                let newSubformData = selectedProducts
                    .filter(product => {
                        let originalProductId = product?.Product_Name?.id;
                        return originalProductId && productsPurchasedMap[originalProductId];
                    })
                    .map(product => ({
                        Purchase_Name: { id: productsPurchasedMap[product.Product_Name.id] },
                        Product_Name: { id: product.Product_Name.id },
                        Comments: product?.Comments || '',
                    }));

                let updatedSubform = [...existingSubformData, ...newSubformData];

                let updateCaseData = {
                    id: caseId,
                    Deal: { id: dealId },  // 确保 Deal 字段也被写入
                    Product_Purchased: updatedSubform,
                };

                await window.ZOHO.CRM.API.updateRecord({
                    Entity: "Case_Module",
                    APIData: updateCaseData,
                    Trigger: ["workflow", "approval", "blueprint"]
                });

            } else {
                // 创建新 Case
                let caseData = {
                    Name: dealName,
                    Deal: { id: dealId },
                    Lead: leadId ? { id: leadId } : null,
                    Product_Purchased: selectedProducts
                        .filter(product => {
                            let originalProductId = product?.Product_Name?.id;
                            return originalProductId && productsPurchasedMap[originalProductId];
                        })
                        .map(product => ({
                            Purchase_Name: { id: productsPurchasedMap[product.Product_Name.id] },
                            Product_Name: { id: product.Product_Name.id },
                            Comments: product?.Comments || '',
                        })),
                };

                let caseResult = await window.ZOHO.CRM.API.insertRecord({
                    Entity: "Case_Module",
                    APIData: caseData,
                    Trigger: ["workflow", "approval", "blueprint"]
                });

                if (caseResult?.data?.[0]?.message === "record added") {
                    caseId = caseResult?.data?.[0]?.details?.id;
                }
            }

            // 3. 更新 Deal 子表 Product_Interested_deal 的 Converted_To_Sales 字段
            let updatedInterestSubform = productInterestList.map(item => ({
                id: item.id,
                Converted_To_Sales: selectedIds.has(item.id),
            }));

            // 4. 更新 Deal 子表 Product_Purchased_deal（关联到 Products_Purchased）
            // 获取现有子表数据
            let existingPurchasedDeal = dealInfo?.Product_Purchased_deal || [];

            let newPurchasedDealItems = selectedProducts
                .filter(product => {
                    let originalProductId = product?.Product_Name?.id;
                    return originalProductId && productsPurchasedMap[originalProductId];
                })
                .map(product => ({
                    Purchase_Name: { id: productsPurchasedMap[product.Product_Name.id] },  // 关联 Products_Purchased
                    Product_Name: { id: product.Product_Name.id },  // 关联 Products（显示产品名）
                    Comments: product?.Comments || '',
                }));

            let updatedPurchasedDealSubform = [...existingPurchasedDeal, ...newPurchasedDealItems];

            // 5. 更新 Deal 标记为已转换
            let updateDealData = {
                "data": [{
                    id: dealId,
                    IsConvertedToProductPurchased: true,
                    Product_Interested_deal: updatedInterestSubform,
                    Product_Purchased_deal: updatedPurchasedDealSubform,
                }],
                "trigger": []
            };

            await putdata("Deals", updateDealData);

            setIsConverted(true);
            Swal.fire({
                icon: "success",
                title: "Conversion Successful!",
                showConfirmButton: true,
            }).then(() => {
                window.ZOHO.CRM.UI.Popup.closeReload();
            });

        } catch (error) {
            console.log(`转换时发生错误：${error}`);
            Swal.fire({
                icon: 'error',
                title: 'Conversion failed!',
                text: `${error}`,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                    <CircularProgress />
                </Box>
            ) : (
                <Box sx={{ position: 'relative', margin: 'auto', padding: 2, minWidth: 400 }}>
                    {isConverted ? (
                        <Typography variant="h6" color="warning.main" sx={{ mb: 2 }}>
                            This deal has already been converted to Products Purchased.
                        </Typography>
                    ) : (
                        <>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                Product Interest to Product Purchased
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 2 }}>
                                Deal: {dealInfo?.Deal_Name}
                            </Typography>

                            {productInterestList.length > 0 ? (
                                <>
                                    <TableContainer component={Paper} sx={{ mb: 2 }}>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell padding="checkbox">
                                                        <Checkbox
                                                            indeterminate={selectedIds.size > 0 && selectedIds.size < productInterestList.length}
                                                            checked={selectedIds.size === productInterestList.length}
                                                            onChange={handleSelectAll}
                                                        />
                                                    </TableCell>
                                                    <TableCell>Product Name</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {productInterestList.map((item) => (
                                                    <TableRow key={item.id} hover>
                                                        <TableCell padding="checkbox">
                                                            <Checkbox
                                                                checked={selectedIds.has(item.id)}
                                                                onChange={() => handleSelect(item.id)}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            {item?.Product_Name?.name || item?.Product_Name?.id || '-'}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>

                                    <Typography variant="body2" sx={{ mb: 2 }}>
                                        Selected: {selectedIds.size} of {productInterestList.length} products
                                    </Typography>
                                </>
                            ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    No product interest data found.
                                </Typography>
                            )}

                            <Box mt={2}>
                                <Stack spacing={2} direction="row">
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        onClick={handleConvert}
                                        disabled={isConverted || selectedIds.size === 0}
                                    >
                                        CONVERT
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        color="secondary"
                                        onClick={() => window.ZOHO.CRM.UI.Popup.closeReload()}
                                    >
                                        CANCEL
                                    </Button>
                                </Stack>
                            </Box>
                        </>
                    )}
                </Box>
            )}
        </>
    );
};

export default App;
