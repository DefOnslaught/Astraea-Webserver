import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"

import './App.css';

import Login from "./pages/Authentication/Login"
import Logout from "./pages/Authentication/Logout";
import Register from "./pages/Authentication/Register"
import Home from "./pages/Home"
import NotFound from "./pages/ErrorPages/NotFound"

import ProtectedRoute from "./components/route/ProtectedRoute"
import PublicRoute from "./components/route/PublicRoute";
import Layout from "./components/Layout";

function RegisterAndLogout() {
  localStorage.clear()
  return <Register />
}

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          {/* --- PROTECTED ROUTES --- */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Home />} />
            <Route path="/logout"element={<Logout />} />
          </Route>
          
          {/* --- PUBLIC ONLY ROUTES (Redirects to / if logged in) --- */}
          <Route element={<PublicRoute />} >
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<RegisterAndLogout />} />
          </Route>

          {/* 404 Not Found */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
