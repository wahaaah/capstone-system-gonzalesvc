import { useMemo, useState, useEffect } from 'react';
import { type Appointment } from '../services/appointmentService';
import { prescriptionService,type Prescription} from '../services/prescriptionService';

export default function PatientHistory({
  patientId,
  allAppointments
}: {
  patientId: string;
  allAppointments: Appointment[];
}) {
  const [prescriptions, setPrescriptions] =
    useState<Prescription[]>([]);

  useEffect(() => {
    if (!patientId) return;

    prescriptionService
      .getForPatient(patientId)
      .then(setPrescriptions)
      .catch(() => setPrescriptions([]));
  }, [patientId]);

  const patientAppointments = useMemo(() => {
    return allAppointments
      .filter(a => a.patient_id === patientId)
      .sort(
        (a, b) =>
          new Date(b.appointment_date).getTime() -
          new Date(a.appointment_date).getTime()
      );
  }, [patientId, allAppointments]);

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm w-full min-w-0">

      {/* =====================================================
          CLINICAL APPOINTMENT LOGS
      ===================================================== */}

      <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">
        Clinical Appointment Logs
      </h3>

      {patientAppointments.length > 0 ? (
        <div className="space-y-3">

          {patientAppointments.map((appt) => (
            <div
              key={
                appt.id ||
                `${appt.appointment_date}-${appt.appointment_time}`
              }
              className="
                grid
                grid-cols-1
                sm:grid-cols-4
                items-center
                p-3
                bg-slate-50
                rounded-lg
                border
                border-slate-100
                gap-3
                sm:gap-4
              "
            >

              {/* =================================================
                  DATE & TIME
              ================================================= */}

              <div className="sm:col-span-1 min-w-0">

                <p className="text-xs font-bold text-slate-800 break-words">
                  {appt.appointment_date.split('T')[0]}
                </p>

                <p className="text-[10px] text-slate-500">
                  {appt.appointment_time.substring(0, 5)}
                </p>

              </div>

              {/* =================================================
                  PURPOSE
              ================================================= */}

              <div className="sm:col-span-2 min-w-0">

                <p
                  className="
                    text-xs
                    font-medium
                    text-slate-700
                    break-words
                    sm:truncate
                  "
                >
                  {appt.purpose_of_visit}
                </p>

              </div>

              {/* =================================================
                  STATUS
              ================================================= */}

              <div className="sm:col-span-1 flex justify-start sm:justify-end">

                <span
                  className={`
                    inline-flex
                    items-center
                    px-2
                    py-1
                    rounded
                    text-[9px]
                    font-bold
                    uppercase
                    whitespace-nowrap
                    ${
                      appt.appointment_status ===
                      'Cancelled'
                        ? 'bg-red-100 text-red-600'
                        : appt.appointment_status ===
                          'Completed'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-emerald-100 text-emerald-600'
                    }
                  `}
                >
                  {appt.appointment_status ||
                    'Pending'}
                </span>

              </div>

            </div>
          ))}

        </div>
      ) : (
        <p className="text-xs text-slate-400 italic">
          No appointment history found for this ID.
        </p>
      )}

      {/* =====================================================
          PRESCRIPTION RECORDS
      ===================================================== */}

      <h3 className="text-sm font-bold text-slate-800 mb-4 mt-6 uppercase tracking-wider">
        Prescription Records
      </h3>

      {prescriptions.length > 0 ? (
        <div className="space-y-3">

          {prescriptions.map((rx) => (
            <div
              key={rx.prescription_id}
              className="
                p-3
                bg-slate-50
                rounded-lg
                border
                border-slate-100
                text-xs
              "
            >

              {/* =================================================
                  PRESCRIPTION VALUES
              ================================================= */}

              <div
                className="
                  grid
                  grid-cols-2
                  sm:grid-cols-4
                  gap-3
                  sm:gap-2
                  mb-1
                "
              >

                <span className="text-slate-400 min-w-0">
                  OD SPH:{' '}
                  <b className="text-slate-700">
                    {rx.od_sph || '—'}
                  </b>
                </span>

                <span className="text-slate-400 min-w-0">
                  OD CYL:{' '}
                  <b className="text-slate-700">
                    {rx.od_cyl || '—'}
                  </b>
                </span>

                <span className="text-slate-400 min-w-0">
                  OS SPH:{' '}
                  <b className="text-slate-700">
                    {rx.os_sph || '—'}
                  </b>
                </span>

                <span className="text-slate-400 min-w-0">
                  OS CYL:{' '}
                  <b className="text-slate-700">
                    {rx.os_cyl || '—'}
                  </b>
                </span>

              </div>

              {rx.notes && (
                <p className="text-slate-500 italic mt-2 break-words">
                  {rx.notes}
                </p>
              )}

            </div>
          ))}

        </div>
      ) : (
        <p className="text-xs text-slate-400 italic">
          No prescription records found for this ID.
        </p>
      )}

    </div>
  );
}