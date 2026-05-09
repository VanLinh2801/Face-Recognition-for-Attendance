@echo off
REM Script tạo consumer groups cho Redis streams
REM Chạy: redis-cli < setup_redis_groups.sql
REM Hoặc chạy từng lệnh bên dưới

echo [*] Creating consumer groups for Redis streams...

REM Stream: ai_backend - cho backend consume từ AI service
redis-cli XGROUP CREATE ai_backend backend-consumers $ MKSTREAM

REM Stream: pipeline_ai - cho AI service consume từ pipeline
redis-cli XGROUP CREATE pipeline_ai ai-consumers $ MKSTREAM

echo [+] Done!
