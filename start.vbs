Dim fso, projectDir, shell
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

projectDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Start backend using venv's uvicorn directly (no activate needed)
shell.Run "cmd /c cd /d """ & projectDir & "\backend"" && venv\Scripts\uvicorn.exe main:app --reload", 0, False

WScript.Sleep 6000

' Start frontend
shell.Run "cmd /c cd /d """ & projectDir & "\frontend"" && npm run dev", 0, False
