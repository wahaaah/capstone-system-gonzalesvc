import { useState, useEffect } from 'react';
import PatientDirectory from '../component/PatientDirectory'; // Note: check if it's 'component' or 'components' in your folder structure
import PatientHistory from '../component/PatientHistory';
import { patientService, type Patient } from '../services/patientService';
import { appointmentService, type Appointment } from '../services/appointmentService';

interface PatientInfoPageProps {
  selectedPatientId: string | null;
  // 1. NEW: We declare that this component expects an onBack function
  onBack: () => void;
}

export default function PatientInfoPage({ selectedPatientId, onBack }: PatientInfoPageProps) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selectedPatientId) {
      setPatient(null);
      return;
    }
    loadProfile(selectedPatientId);
  }, [selectedPatientId]);

  const loadProfile = async (id: string) => {
    setIsLoading(true);
    setError('');
    try {
      const [patientData, allAppointments] = await Promise.all([
        patientService.getById(id),
        appointmentService.getAll(),
      ]);
      setPatient(patientData);
      setAppointments(allAppointments);
    } catch (err: any) {
      setError(err.message || 'Failed to load patient record.');
      setPatient(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Header Block */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          {selectedPatientId ? `Patient Profile: ${selectedPatientId}` : "Patient Information"}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {selectedPatientId
            ? "Viewing detailed medical and appointment history."
            : "Manage patient records, contact info, and history."}
        </p>
      </div>

      {/* Logic: Show Details OR Directory */}
      {selectedPatientId ? (

        <div className="space-y-4">
          {/* 2. The Back Button that triggers the reset in App.tsx */}
          <button
            onClick={onBack}
            className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center"
          >
            ← Back to Patient Directory
          </button>

          {isLoading ? (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-400">Loading patient record...</p>
            </div>
          ) : error ? (
            <div className="bg-white p-6 rounded-xl border border-red-200 shadow-sm">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          ) : patient ? (
            <>
              {/* 3. Real fetched patient data, not placeholder text */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center border-b pb-4 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">
                      {patient.name}
                    </h3>
                    <p className="text-xs text-slate-400">Patient ID: {patient.patient_id}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded font-bold ${
                    patient.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                    patient.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {patient.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs uppercase font-bold">Contact info</p>
                    <p className="mt-1 text-slate-800">Phone: {patient.contact || '—'}</p>
                    <p className="text-slate-800">Age: {patient.age ?? '—'}</p>
                    <p className="text-slate-800">Gender: {patient.gender || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase font-bold">Last visit</p>
                    <p className="mt-1 text-slate-800">
                      {patient.last_visit ? patient.last_visit.split('T')[0] : 'No visits recorded yet.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Appointment history + prescription records — was built but never wired in before */}
              <PatientHistory patientId={patient.patient_id} allAppointments={appointments} />
            </>
          ) : null}
        </div>

      ) : (
        /* If no ID is selected, show the full list */
        <PatientDirectory />
      )}

    </div>
  );
}
