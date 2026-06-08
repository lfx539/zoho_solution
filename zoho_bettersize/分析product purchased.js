1. Case_Module 和 Deal 的关联
Case_Module 是否有字段关联到 Deal？（比如 Deal_Name lookup 字段） 有的，Deal字段
一个 Case 是否只关联一个 Deal？ 是的
2. Products_Purchased 模块
这是一个独立模块，还是 Case 的子表？ 是一个独立模块，也在case和deals里各自有子表
它如何与 Case 和 Deal 关联？有 Lookup 字段吗？ case和deal子表里的product name关联product purchased模块里的product name
3. 子表记录的对应关系
Case 的 Product_Purchased 子表记录，如何匹配到 Products_Purchased 模块的记录？case和deal子表里的product name关联product purchased模块里的product name
通过 Serial_Number？
通过 Product_Name？这个是对的
还是有其他唯一标识？
4. Deal 的子表 
Deal 的 Product_Purchased_deal 子表结构是否和 Case 的子表一样？对的
Case 子表记录如何匹配到 Deal 子表记录？通过case的Deal字段，这个字段是lookup字段