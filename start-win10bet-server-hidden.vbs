Set shell = CreateObject("WScript.Shell")
base = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
cmd = "cmd /c cd /d """ & base & """ && set ADMIN_USER=win10bet-admin&& set ADMIN_PASSWORD=W10b@Admin-728419&& set PORT=4180&& ""C:\Users\alden\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"" win10bet-server.js >> win10bet-server.log 2>>&1"
shell.Run cmd, 0, False
MsgBox "Win10bet server is starting in background." & vbCrLf & "Front: http://127.0.0.1:4180/win10bet.html" & vbCrLf & "Admin: http://127.0.0.1:4180/admin.html", 64, "Win10bet"
