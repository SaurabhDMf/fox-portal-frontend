export default function Reports() {
  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Reports</h1><p className="page-subtitle">Business analytics and insights</p></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {['Sales Funnel by Stage', 'Revenue Over Time', 'Lead Conversion Rates', 'Team Leaderboard'].map(title => (
          <div key={title} className="glass-card p-5 h-64 flex items-center justify-center">
            <div className="text-center">
              <div className="text-sm font-medium mb-1">{title}</div>
              <p className="text-xs text-muted-foreground">Chart coming soon</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
