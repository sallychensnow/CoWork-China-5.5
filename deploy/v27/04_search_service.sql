-- CoWork China v27 - 04 Cortex Search 服务 (run after data is loaded)

create or replace cortex search service COWORK.DATA.DOC_SEARCH_SERVICE
	ON CONTENT
	attributes TITLE,CATEGORY
	warehouse='COWORK_WH'
	target_lag='1 hour'
	refresh_mode=INCREMENTAL
	as (SELECT CONTENT, TITLE, CATEGORY FROM COWORK.DATA.KNOWLEDGE_BASE);
