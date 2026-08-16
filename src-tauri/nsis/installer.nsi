; Custom NSIS hooks for the LedgerFlow installer (see bundle.windows.nsis.installerHooks).
;
; An upgrade install over an older build must NOT leave the previous app or its
; sidecar backend running: the old backend keeps holding port 3000, and the new
; app would either reuse a stale backend or fail to bind. Kill every running
; LedgerFlow process before files are replaced so the fresh build starts clean.

!macro NSIS_HOOK_PREINSTALL
  ; Kill the app window(s) first, then the backend sidecar (which the app may
  ; have spawned detached). /T kills the whole tree, /F forces it.
  nsExec::ExecToLog 'taskkill /IM ledgerflow.exe /F /T'
  nsExec::ExecToLog 'taskkill /IM ledgerflow-backend.exe /F /T'
  ; A previous build also shipped the backend as ledgerflow-backend-x64.exe
  nsExec::ExecToLog 'taskkill /IM ledgerflow-backend-x64.exe /F /T'
  ; Give the OS a moment to release the port before the new app starts.
  Sleep 1000
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Same cleanup before uninstall so the next install never finds a live old
  ; process squatting on the backend port.
  nsExec::ExecToLog 'taskkill /IM ledgerflow.exe /F /T'
  nsExec::ExecToLog 'taskkill /IM ledgerflow-backend.exe /F /T'
  nsExec::ExecToLog 'taskkill /IM ledgerflow-backend-x64.exe /F /T'
  Sleep 1000
!macroend
