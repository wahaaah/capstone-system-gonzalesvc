import AppointmentScheduler from '../component/AppointmentScheduler';

export default function SchedulingPage({ onNavigate }: { onNavigate: any }) {
  return (
    <div className="space-y-6">
      {/* Title block formatted in clean Sentence Case */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Appointment scheduling</h2>
        <p className="text-sm text-slate-500 mt-1">Monitor time intervals, prevent booking overlaps, and manage clinic slots.</p>
      </div>
      
      {/* Renders your live calendar grid and booking form */}
    <AppointmentScheduler onNavigate={onNavigate} />
    </div>
  );
}