import { BrowserRouter, Routes, Route } from "react-router-dom";

import './App.css';

import Login from "./pages/Authentication/Login";
import Logout from "./pages/Authentication/Logout";
import Register from "./pages/Authentication/Register";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile/Profile";
import NotFound from "./pages/ErrorPages/NotFound";

import { AuthProvider } from "./utils/AuthContext";
import ProtectedRoute from "./components/route/ProtectedRoute"
import PublicRoute from "./components/route/PublicRoute";
import Layout from "./components/Layout";


function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout>
          <Routes>
            {/* --- PROTECTED ROUTES --- */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/logout" element={<Logout />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            
            {/* --- PUBLIC ONLY ROUTES (Redirects to / if logged in) --- */}
            <Route element={<PublicRoute />} >
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>

            {/* 404 Not Found */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App