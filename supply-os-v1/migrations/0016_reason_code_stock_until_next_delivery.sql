-- ============================================================
-- Pita Supply OS — migration 0016: reason code STOCK_UNTIL_NEXT_DELIVERY
-- (week1-feedback-targets)
--
-- ADDITIVE ONLY (one more allowed value in an existing CHECK).
--
-- Week-1 feedback (Browary, 2026-09-06): a Captain ordering for the whole
-- week ahead of a fixed delivery day (Pago / Coca-Cola on Tuesday) had no
-- honest reason to pick and used EVENT_HIGH_TRAFFIC. That poisons the
-- deviation statistics the suggestion learning loop (FR-012) reads.
-- STOCK_UNTIL_NEXT_DELIVERY names that case.
--
-- ORDER OF OPERATIONS: apply this BEFORE deploying the code that adds the
-- enum member (app/models.py ReasonCode + frontend REASON_CODES). With the
-- old CHECK in place, the first submit carrying the new code would fail the
-- INSERT into order_lines (IntegrityError -> 500).
--
-- Rollback (only while no order_lines row carries the new code):
--   ALTER TABLE order_lines DROP CONSTRAINT order_lines_reason_code_check;
--   ALTER TABLE order_lines ADD CONSTRAINT order_lines_reason_code_check
--       CHECK (reason_code IS NULL OR reason_code IN (
--           'EVENT_HIGH_TRAFFIC','WEEKEND_HIGH_TRAFFIC','LOW_STORAGE',
--           'PACKAGING_LIMITATION','SUPPLIER_UNDERDELIVERS',
--           'SYSTEM_SUGGESTION_WRONG','OTHER'));
-- ============================================================

ALTER TABLE order_lines DROP CONSTRAINT IF EXISTS order_lines_reason_code_check;
ALTER TABLE order_lines ADD CONSTRAINT order_lines_reason_code_check
    CHECK (reason_code IS NULL OR reason_code IN (
        'EVENT_HIGH_TRAFFIC','WEEKEND_HIGH_TRAFFIC','STOCK_UNTIL_NEXT_DELIVERY',
        'LOW_STORAGE','PACKAGING_LIMITATION','SUPPLIER_UNDERDELIVERS',
        'SYSTEM_SUGGESTION_WRONG','OTHER'));
