' Aide Visio : lanceur Windows sans fenetre de console.
' - Relance le programme « Son du PC » s'il ne tourne plus (ws://127.0.0.1:47800).
' - Ouvre l'appli dans un Chrome a part (dossier Chrome-AideVisio, profil « AideVisio ») :
'   ses fenetres ne sont pas celles du profil personnel, elles restent visibles
'   quand le PC masque ce profil (mode « Audrey » du Phone Hub).
Option Explicit
Dim sh, fso, here, sonPc, py, chrome, dataDir, url, wmi, p, running, c

Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
url = "https://cmssmc-code.github.io/aide-visio/"
If WScript.Arguments.Count > 0 Then url = WScript.Arguments(0)

' --- Son du PC
sonPc = here & "\son-pc\aidevisio_son_pc.py"
If fso.FileExists(sonPc) Then
  running = False
  On Error Resume Next
  Set wmi = GetObject("winmgmts:\\.\root\cimv2")
  For Each p In wmi.ExecQuery("SELECT CommandLine FROM Win32_Process WHERE Name='pythonw.exe' OR Name='python.exe'")
    If Not IsNull(p.CommandLine) Then
      If InStr(1, p.CommandLine, "aidevisio_son_pc.py", vbTextCompare) > 0 Then running = True
    End If
  Next
  On Error GoTo 0
  If Not running Then
    py = ""
    For Each c In Array(sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\Python\Python312\pythonw.exe", _
                        sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\Python\Python313\pythonw.exe", _
                        sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\Python\Python311\pythonw.exe")
      If py = "" And fso.FileExists(c) Then py = c
    Next
    If py = "" Then py = "pythonw.exe"
    On Error Resume Next
    sh.Run """" & py & """ """ & sonPc & """", 0, False
    On Error GoTo 0
  End If
End If

' --- Chrome a part
chrome = ""
For Each c In Array(sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\Google\Chrome\Application\chrome.exe", _
                    sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Google\Chrome\Application\chrome.exe", _
                    sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Google\Chrome\Application\chrome.exe")
  If chrome = "" And fso.FileExists(c) Then chrome = c
Next
If chrome = "" Then
  sh.Run url, 1, False
  WScript.Quit 0
End If
dataDir = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Google\Chrome-AideVisio\User Data"
sh.Run """" & chrome & """ --user-data-dir=""" & dataDir & """ --profile-directory=AideVisio --no-first-run --no-default-browser-check --start-maximized --app=" & url, 1, False
