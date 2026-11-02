import { Routes, Route } from 'react-router'
import Home from './pages/Home'
import Login from "./pages/Login"
import ForgotPassword from "./pages/ForgotPassword"
import ResetPassword from "./pages/ResetPassword"
import EmailSettings from "./pages/EmailSettings"
import NotFound from "./pages/NotFound"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/admin/email-settings" element={<EmailSettings />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

