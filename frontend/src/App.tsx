import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { api } from "./services/api";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import type { User } from "./types/email";

function AppRoutes() { const [user,setUser]=useState<User|null>(null); const [loading,setLoading]=useState(true); const navigate=useNavigate(); useEffect(()=>{api.me().then(setUser).catch(()=>setUser(null)).finally(()=>setLoading(false));},[]); async function logout(){await api.logout().catch(()=>undefined);setUser(null);navigate("/login");} if(loading)return <div className="flex min-h-screen items-center justify-center text-sm text-zinc-500">Loading…</div>; return <Routes><Route path="/login" element={user?<Navigate to="/dashboard" replace/>:<Login/>}/><Route path="/dashboard" element={user?<Dashboard user={user} onLogout={logout}/>:<Navigate to="/login" replace/>}/><Route path="*" element={<Navigate to={user?"/dashboard":"/login"} replace/>}/></Routes>; }
export default function App(){return <BrowserRouter><AppRoutes/></BrowserRouter>}
