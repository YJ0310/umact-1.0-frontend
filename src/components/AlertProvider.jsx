import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const AlertContext = createContext({ showAlert: () => {}, clearAlert: () => {} })

export function useAlert() {
  return useContext(AlertContext)
}

export default function AlertProvider({ children }) {
  const [alert, setAlert] = useState(null)

  const showAlert = useCallback((message, type = 'info') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 4500)
  }, [])

  const clearAlert = useCallback(() => setAlert(null), [])

  const value = useMemo(() => ({ showAlert, clearAlert }), [showAlert, clearAlert])

  return (
    <AlertContext.Provider value={value}>
      {alert && (
        <div className={`global-alert global-alert-${alert.type}`} role="alert">
          <span>{alert.message}</span>
          <button className="btn btn-ghost btn-sm" onClick={clearAlert} aria-label="Dismiss alert">
            x
          </button>
        </div>
      )}
      {children}
    </AlertContext.Provider>
  )
}
