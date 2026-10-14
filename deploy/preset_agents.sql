-- CoWork China - Preset Demo Agents
USE DATABASE COWORK;
USE SCHEMA APP;

INSERT INTO AGENTS (id, name, description, semantic_models, search_services, tools, system_prompt, icon, skills)
SELECT 'retail_analyst', '零售分析师', '电商销售数据分析，支持订单、客户、产品查询',
    PARSE_JSON('["@COWORK.APP.SEMANTIC_MODELS/retail_model.yaml"]'),
    PARSE_JSON('["COWORK.DATA.DOC_SEARCH_SERVICE"]'),
    PARSE_JSON('["cortex_analyst","cortex_search","deep_research"]'),
    '你是电商零售数据分析专家。你可以查询销售订单、客户信息、产品数据，也可以检索公司政策和产品文档。请用中文回答。',
    '🛍️',
    PARSE_JSON('[]');

INSERT INTO AGENTS (id, name, description, semantic_models, search_services, tools, system_prompt, icon, skills)
SELECT 'logistics_mgr', '物流管家', '物流运输数据分析，支持运单、车辆、仓库查询',
    PARSE_JSON('["@COWORK.APP.SEMANTIC_MODELS/logistics_model.yaml"]'),
    PARSE_JSON('["COWORK.DATA.DOC_SEARCH_SERVICE"]'),
    PARSE_JSON('["cortex_analyst","cortex_search","deep_research"]'),
    '你是物流运输管理专家。你可以查询运单时效、承运商表现、仓库利用率，也可以检索物流管理规范和操作标准。请用中文回答。',
    '🚛',
    PARSE_JSON('[]');

INSERT INTO AGENTS (id, name, description, semantic_models, search_services, tools, system_prompt, icon, skills)
SELECT 'procurement_asst', '采购助手', '采购供应链分析，支持采购订单、供应商、物料查询',
    PARSE_JSON('["@COWORK.APP.SEMANTIC_MODELS/procurement_model.yaml"]'),
    PARSE_JSON('["COWORK.DATA.DOC_SEARCH_SERVICE"]'),
    PARSE_JSON('["cortex_analyst","cortex_search","deep_research"]'),
    '你是采购供应链管理专家。你可以查询采购订单、供应商评级、物料库存，也可以检索采购流程规范和合同管理制度。请用中文回答。',
    '📋',
    PARSE_JSON('[]');

INSERT INTO AGENTS (id, name, description, semantic_models, search_services, tools, system_prompt, icon, skills)
SELECT 'mfg_quality', '制造质量官', '制造业生产质量分析，支持工单、产线、质检查询',
    PARSE_JSON('["@COWORK.APP.SEMANTIC_MODELS/manufacturing_model.yaml"]'),
    PARSE_JSON('["COWORK.DATA.DOC_SEARCH_SERVICE"]'),
    PARSE_JSON('["cortex_analyst","cortex_search","deep_research"]'),
    '你是制造业质量管理专家。你可以查询产线良品率、生产工单、质检记录，也可以检索质量管理体系和SPC标准。请用中文回答。',
    '🏭',
    PARSE_JSON('[]');
