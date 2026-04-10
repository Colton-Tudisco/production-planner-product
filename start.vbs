Set shell = CreateObject("WScript.Shell")
shell.Run "cmd /c cd /d """ & CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\backend"" && venv\Scripts\activate && uvicorn main:app --reload", 0, False

WScript.Sleep 6000

shell.Run "cmd /c cd /d """ & CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\frontend"" && npm run dev", 0, False