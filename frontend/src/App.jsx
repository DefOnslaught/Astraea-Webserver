import { BrowserRouter, Routes, Route } from "react-router-dom";

import './App.css';

import Login from "./pages/Authentication/Login";
import Logout from "./pages/Authentication/Logout";
import Register from "./pages/Authentication/Register";
import Dashboard from "./pages/Dashboard/Dashboard";
import Servers from "./pages/Servers/Servers";
import InspectServer from "./pages/InspectServer/InspectServer";
import Packages from "./pages/Packages/Packages";
import PackageVersionDetail from "./pages/Packages/PackageVersionDetail";
import Configuration from "./pages/Configuration/Configuration";
import Administration from "./pages/Administration/Administration";
import UserInspection from "./pages/InspectUser/UserInspection";
import Profile from "./pages/Profile/Profile";
import VerifyLink from "./pages/Verification/VerifyLink";
import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";
import ForgotPasswordReset from "./pages/ForgotPassword/ForgotPasswordReset";
import Reports from "./pages/Reports/Reports";
import About from "./pages/About/About";
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
              <Route path="/servers" element={<Servers />} />
              <Route path="/inspect/:server_id/" element={<InspectServer />} />
              <Route path="/packages" element={<Packages />} />
              <Route path="/packages/:packageName/instances" element={<PackageVersionDetail />} />
              <Route path="/configuration" element={<Configuration />} />
              <Route path="/administration" element={<Administration />} />
              <Route path="/administration/users/inspect/:username" element={<UserInspection />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/about" element={<About />} />
              <Route path="/logout" element={<Logout />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            
            {/* --- PUBLIC ONLY ROUTES (Redirects to / if logged in) --- */}
            <Route element={<PublicRoute />} >
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/verify/:token" element={<VerifyLink />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/forgot-password/:token" element={<ForgotPasswordReset />} />
            </Route>

            {/* 404 Not Found */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App;