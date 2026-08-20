
@echo off
echo 正在清理__pycache__文件夹...
for /r %%d in (__pycache__) do (
    if exist "%%d" (
        echo 删除文件夹: %%d
        rmdir /s /q "%%d"
    )
)
echo 清理完成
pause
