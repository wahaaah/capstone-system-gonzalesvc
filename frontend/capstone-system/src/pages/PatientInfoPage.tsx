import { useState, useEffect } from 'react';
import PatientDirectory from '../component/PatientDirectory';
import PatientHistory from '../component/PatientHistory';
import {
  patientService,
  type Patient
} from '../services/patientService';
import {
  appointmentService,
  type Appointment
} from '../services/appointmentService';

interface PatientInfoPageProps {
  selectedPatientId: string | null;
  onBack: () => void;
}

// =========================================================
// DATE FORMATTER
// =========================================================

const formatDate = (
  dateString?: string | null
) => {
  if (!dateString) return 'No visits';

  return new Date(dateString).toLocaleDateString(
    'en-US',
    {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }
  );
};

export default function PatientInfoPage({
  selectedPatientId,
  onBack
}: PatientInfoPageProps) {

  const [patient, setPatient] =
    useState<Patient | null>(null);

  const [appointments, setAppointments] =
    useState<Appointment[]>([]);

  const [isLoading, setIsLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  // =========================================================
  // LOAD PATIENT PROFILE
  // =========================================================

  useEffect(() => {

    if (!selectedPatientId) {
      setPatient(null);
      return;
    }

    loadProfile(selectedPatientId);

  }, [selectedPatientId]);

  const loadProfile = async (
    id: string
  ) => {

    setIsLoading(true);
    setError('');

    try {

      const [
        patientData,
        allAppointments
      ] = await Promise.all([
        patientService.getById(id),
        appointmentService.getAll()
      ]);

      setPatient(patientData);
      setAppointments(allAppointments);

    } catch (err: any) {

      setError(
        err.message ||
        'Failed to load patient record.'
      );

      setPatient(null);

    } finally {

      setIsLoading(false);

    }
  };

  return (

    <div className="w-full min-w-0 space-y-4 sm:space-y-6">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="min-w-0">

        <h2
          className="
            text-xl
            sm:text-2xl
            font-bold
            tracking-tight
            text-slate-900
            break-words
          "
        >
          {selectedPatientId
            ? `Patient Profile: ${selectedPatientId}`
            : 'Patient Information'}
        </h2>

        <p
          className="
            text-xs
            sm:text-sm
            text-slate-500
            mt-1
            break-words
          "
        >
          {selectedPatientId
            ? 'Viewing detailed medical and appointment history.'
            : 'Manage patient records, contact info, and history.'}
        </p>

      </div>

      {/* =====================================================
          PATIENT PROFILE
      ===================================================== */}

      {selectedPatientId ? (

        <div className="w-full min-w-0 space-y-4">

          {/* =================================================
              BACK BUTTON
          ================================================= */}

          <button
            type="button"
            onClick={onBack}
            className="
              text-sm
              font-semibold
              text-blue-600
              hover:text-blue-800
              flex
              items-center
              gap-1
            "
          >
            ← Back to Patient Directory
          </button>

          {/* =================================================
              LOADING
          ================================================= */}

          {isLoading ? (

            <div className="w-full bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm">

              <p className="text-sm text-slate-400">
                Loading patient record...
              </p>

            </div>

          ) : error ? (

            /* =================================================
               ERROR
            ================================================= */

            <div className="w-full bg-white p-4 sm:p-6 rounded-xl border border-red-200 shadow-sm">

              <p className="text-sm text-red-500 break-words">
                {error}
              </p>

            </div>

          ) : patient ? (

            <>

              {/* =================================================
                  PATIENT DATA CARD
              ================================================= */}

              <div
                className="
                  w-full
                  min-w-0
                  bg-white
                  p-4
                  sm:p-6
                  rounded-xl
                  border
                  border-slate-200
                  shadow-sm
                "
              >

                {/* =================================================
                    PATIENT HEADER
                ================================================= */}

                <div
                  className="
                    flex
                    flex-col
                    sm:flex-row
                    sm:justify-between
                    sm:items-center
                    gap-3
                    border-b
                    pb-4
                    mb-4
                  "
                >

                  <div className="min-w-0">

                    <h3
                      className="
                        text-base
                        sm:text-lg
                        font-bold
                        text-slate-800
                        break-words
                      "
                    >
                      {patient.name}
                    </h3>

                    <p className="text-xs text-slate-400 break-all">
                      Patient ID: {patient.patient_id}
                    </p>

                  </div>

                  {/* STATUS */}

                  <span
                    className={`
                      self-start
                      sm:self-auto
                      inline-flex
                      items-center
                      text-xs
                      px-2
                      py-1
                      rounded
                      font-bold
                      whitespace-nowrap
                      ${
                        patient.status === 'Active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : patient.status === 'Pending'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                      }
                    `}
                  >
                    {patient.status}
                  </span>

                </div>

                {/* =================================================
                    PATIENT INFORMATION

                    Desktop:
                    2 columns

                    Mobile:
                    1 column
                ================================================= */}

                <div
                  className="
                    grid
                    grid-cols-1
                    sm:grid-cols-2
                    gap-4
                    text-sm
                  "
                >

                  {/* CONTACT INFORMATION */}

                  <div className="min-w-0">

                    <p
                      className="
                        text-slate-500
                        text-xs
                        uppercase
                        font-bold
                      "
                    >
                      Contact info
                    </p>

                    <p className="mt-1 text-slate-800 break-words">
                      Phone: {patient.contact || '—'}
                    </p>

                    <p className="text-slate-800">
                      Age: {patient.age ?? '—'}
                    </p>

                    <p className="text-slate-800">
                      Gender: {patient.gender || '—'}
                    </p>

                  </div>

                  {/* LAST VISIT */}

                  <div className="min-w-0">

                    <p
                      className="
                        text-slate-500
                        text-xs
                        uppercase
                        font-bold
                      "
                    >
                      Last visit
                    </p>

                    <p className="mt-1 text-slate-800 break-words">
                      {formatDate(patient.last_visit)}
                    </p>

                  </div>

                </div>

              </div>

              {/* =================================================
                  APPOINTMENT HISTORY + PRESCRIPTIONS
              ================================================= */}

              <div className="w-full min-w-0">

                <PatientHistory
                  patientId={patient.patient_id}
                  allAppointments={appointments}
                />

              </div>

            </>

          ) : null}

        </div>

      ) : (

        /* =====================================================
           PATIENT DIRECTORY
        ===================================================== */

        <div className="w-full min-w-0">

          <PatientDirectory />

        </div>

      )}

    </div>
  );
}