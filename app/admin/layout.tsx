// app/admin/layout.js - Admin Panel Layout

import AdminNavbar from "./adminNavbar";


export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <AdminNavbar />
      <main className="container mx-auto py-8 px-4">
        {children}
      </main>
    </div>
  );
}