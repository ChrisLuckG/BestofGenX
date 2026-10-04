export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-scope" style={{ background: '#fff', minHeight: '100vh' }}>
      {children}
    </div>
  );
}
